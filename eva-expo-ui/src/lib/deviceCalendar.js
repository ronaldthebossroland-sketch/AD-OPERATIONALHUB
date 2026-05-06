import { Platform } from "react-native";
import * as Calendar from "expo-calendar";
import { requestCalendarPermissions, checkCalendarPermissions } from "./devicePermissions";
import { parseMeetingReminderMinutes, resolveMeetingDateRange } from "./meetingDateTime";

const EVA_CALENDAR_TITLE = "EVA";
const EVA_CALENDAR_COLOR = "#38BDF8";

export async function getAvailableCalendars({ requestPermission = false } = {}) {
  const permission = requestPermission
    ? await requestCalendarPermissions()
    : await checkCalendarPermissions();

  if (!permission.granted) {
    return {
      ok: false,
      status: permission.status === "denied" ? "permission_denied" : "permission_required",
      permission,
      calendars: [],
    };
  }

  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return { ok: true, status: "connected", permission, calendars };
  } catch (error) {
    return {
      ok: false,
      status: "unavailable",
      permission,
      calendars: [],
      message: error?.message || "Device calendars are unavailable.",
    };
  }
}

export async function findBestWritableCalendar() {
  const result = await getAvailableCalendars({ requestPermission: true });

  if (!result.ok) {
    return result;
  }

  const writableCalendars = result.calendars.filter(isWritableCalendar);
  const existingEvaCalendar = writableCalendars.find((calendar) =>
    isNamedCalendar(calendar, EVA_CALENDAR_TITLE)
  );

  if (existingEvaCalendar) {
    return {
      ok: true,
      status: "connected",
      calendar: existingEvaCalendar,
      calendars: result.calendars,
      permission: result.permission,
    };
  }

  const createdEvaCalendar = await createEvaCalendar(result.calendars);
  if (createdEvaCalendar) {
    return {
      ok: true,
      status: "connected",
      calendar: createdEvaCalendar,
      calendars: result.calendars,
      permission: result.permission,
      createdCalendar: true,
    };
  }

  const fallbackCalendar = writableCalendars
    .slice()
    .sort((a, b) => scoreCalendar(b) - scoreCalendar(a))[0];

  if (!fallbackCalendar) {
    return {
      ok: false,
      status: "no_writable_calendar",
      calendars: result.calendars,
      permission: result.permission,
      message: "No writable device calendar is available.",
    };
  }

  return {
    ok: true,
    status: "connected",
    calendar: fallbackCalendar,
    calendars: result.calendars,
    permission: result.permission,
  };
}

export async function createDeviceCalendarEvent(meeting) {
  const calendarResult = await findBestWritableCalendar();

  if (!calendarResult.ok) {
    return calendarSyncFailure(calendarResult.status, calendarResult.message);
  }

  const range = resolveMeetingDateRange(meeting);
  if (!range) {
    return calendarSyncFailure("missing_date_time", "Meeting date or time is missing.");
  }

  try {
    const reminderMinutes = parseMeetingReminderMinutes(meeting, 15);
    const eventId = await Calendar.createEventAsync(calendarResult.calendar.id, {
      title: meeting.title || "EVA meeting",
      startDate: range.startDate,
      endDate: range.endDate,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location: meeting.location || "",
      notes: buildMeetingNotes(meeting),
      alarms:
        reminderMinutes > 0
          ? [{ relativeOffset: -reminderMinutes, method: Calendar.AlarmMethod?.ALERT }]
          : [],
    });

    return {
      ok: true,
      device_calendar_event_id: eventId,
      calendar_sync_status: "synced",
      calendar_name: calendarResult.calendar.title || calendarResult.calendar.name || "Phone calendar",
    };
  } catch (error) {
    return calendarSyncFailure(
      "sync_failed",
      error?.message || "Could not create the phone calendar event."
    );
  }
}

export async function updateDeviceCalendarEvent(meeting) {
  if (!meeting?.deviceCalendarEventId && !meeting?.device_calendar_event_id) {
    return calendarSyncFailure("not_synced", "No device calendar event is linked.");
  }

  const range = resolveMeetingDateRange(meeting);
  if (!range) {
    return calendarSyncFailure("missing_date_time", "Meeting date or time is missing.");
  }

  try {
    await Calendar.updateEventAsync(
      meeting.deviceCalendarEventId || meeting.device_calendar_event_id,
      {
        title: meeting.title || "EVA meeting",
        startDate: range.startDate,
        endDate: range.endDate,
        location: meeting.location || "",
        notes: buildMeetingNotes(meeting),
      }
    );

    return {
      ok: true,
      calendar_sync_status: "synced",
      device_calendar_event_id: meeting.deviceCalendarEventId || meeting.device_calendar_event_id,
      calendar_name: meeting.calendarName || meeting.calendar_name || "Phone calendar",
    };
  } catch (error) {
    return calendarSyncFailure(
      "update_failed",
      error?.message || "Could not update the phone calendar event."
    );
  }
}

export async function deleteDeviceCalendarEvent(meeting) {
  const eventId = meeting?.deviceCalendarEventId || meeting?.device_calendar_event_id;

  if (!eventId) {
    return { ok: true, calendar_sync_status: "not_synced" };
  }

  try {
    await Calendar.deleteEventAsync(eventId);
    return {
      ok: true,
      device_calendar_event_id: "",
      calendar_sync_status: "deleted",
    };
  } catch (error) {
    return calendarSyncFailure(
      "delete_failed",
      error?.message || "Could not delete the phone calendar event."
    );
  }
}

async function createEvaCalendar(calendars) {
  try {
    const baseCalendar = calendars.find(isWritableCalendar) || calendars[0];
    const details = {
      title: EVA_CALENDAR_TITLE,
      color: EVA_CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
    };

    if (Platform.OS === "ios") {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      details.sourceId = defaultCalendar?.source?.id;
      details.source = defaultCalendar?.source;
    } else {
      const source =
        baseCalendar?.source || {
          isLocalAccount: true,
          name: EVA_CALENDAR_TITLE,
          type: "LOCAL",
        };

      details.name = "eva";
      details.source = source;
      details.ownerAccount =
        baseCalendar?.ownerAccount || source.name || EVA_CALENDAR_TITLE;
      details.accessLevel = Calendar.CalendarAccessLevel.OWNER;
    }

    const id = await Calendar.createCalendarAsync(details);
    const refreshed = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return refreshed.find((calendar) => calendar.id === id) || {
      id,
      title: EVA_CALENDAR_TITLE,
      allowsModifications: true,
    };
  } catch (error) {
    console.warn("EVA calendar creation skipped.", error?.message || error);
    return null;
  }
}

function buildMeetingNotes(meeting = {}) {
  const attendees = Array.isArray(meeting.attendees)
    ? meeting.attendees.join(", ")
    : meeting.attendees || "";
  return [
    meeting.briefing || meeting.agenda || meeting.details || "",
    attendees ? `Attendees: ${attendees}` : "",
    "Created by EVA.",
  ]
    .filter(Boolean)
    .join("\n");
}

function calendarSyncFailure(status, message = "") {
  return {
    ok: false,
    device_calendar_event_id: "",
    calendar_sync_status: status || "sync_failed",
    calendar_name: "",
    message,
  };
}

function isWritableCalendar(calendar = {}) {
  if (!calendar.allowsModifications) {
    return false;
  }

  const level = String(calendar.accessLevel || "").toLowerCase();
  return !["read", "freebusy", "respond", "none"].includes(level);
}

function isNamedCalendar(calendar = {}, title) {
  const name = String(calendar.title || calendar.name || "").trim().toLowerCase();
  return name === title.toLowerCase();
}

function scoreCalendar(calendar = {}) {
  const text = [
    calendar.title,
    calendar.name,
    calendar.ownerAccount,
    calendar.source?.name,
    calendar.source?.type,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (calendar.isPrimary) score += 40;
  if (calendar.isSynced) score += 20;
  if (text.includes("google")) score += 18;
  if (text.includes("samsung")) score += 14;
  if (text.includes("local") || calendar.source?.isLocalAccount) score += 10;
  if (calendar.isVisible !== false) score += 6;
  return score;
}
