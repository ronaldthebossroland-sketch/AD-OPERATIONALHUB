const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function resolveMeetingDateRange(meeting = {}, options = {}) {
  const startDate = parseMeetingDate(meeting.date || meeting.meeting_date);
  const startTime = parseMeetingTime(meeting.time || meeting.start_time);

  if (!startDate || !startTime) {
    return null;
  }

  startDate.setHours(startTime.hours, startTime.minutes, 0, 0);

  const durationMinutes =
    parsePositiveInteger(meeting.durationMinutes || meeting.duration_minutes) ||
    parseDurationMinutes(meeting.briefing || meeting.details) ||
    options.durationMinutes ||
    30;
  const endTime = parseMeetingTime(meeting.endTime || meeting.end_time);
  const endDate = new Date(startDate);

  if (endTime) {
    endDate.setHours(endTime.hours, endTime.minutes, 0, 0);
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
  } else {
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  }

  return { startDate, endDate, durationMinutes };
}

export function parseMeetingReminderMinutes(meeting = {}, fallback = 15) {
  const value =
    meeting.reminderMinutes ||
    meeting.reminder_minutes ||
    meeting.reminder ||
    meeting.reminder_time;
  const minutes = parsePositiveInteger(value);
  return minutes === null ? fallback : minutes;
}

export function parseTaskReminderDate(task = {}) {
  const date = parseMeetingDate(task.due || task.due_date);
  if (!date) {
    return null;
  }

  const time = parseMeetingTime(task.time || task.reminder_time) || {
    hours: 9,
    minutes: 0,
  };
  date.setHours(time.hours, time.minutes, 0, 0);
  return date;
}

function parseMeetingDate(value) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  if (!text || lower === "today") {
    return date;
  }

  if (lower === "tomorrow") {
    date.setDate(date.getDate() + 1);
    return date;
  }

  if (lower === "next week") {
    date.setDate(date.getDate() + 7);
    return date;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const monthDayMatch = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/
  );
  if (monthDayMatch) {
    return new Date(date.getFullYear(), MONTHS[monthDayMatch[1]], Number(monthDayMatch[2]));
  }

  const dayMatch = lower.match(/\b(?:day|on|by|due)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayMatch) {
    return new Date(date.getFullYear(), date.getMonth(), Number(dayMatch[1]));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  return null;
}

function parseMeetingTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);
    return isValidTime(hours, minutes) ? { hours, minutes } : null;
  }

  const twelveHour = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)$/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2] || "0");
    const period = twelveHour[3].replace(/\./g, "").toLowerCase();

    if (period === "pm" && hours !== 12) {
      hours += 12;
    }
    if (period === "am" && hours === 12) {
      hours = 0;
    }

    return isValidTime(hours, minutes) ? { hours, minutes } : null;
  }

  return null;
}

function parseDurationMinutes(value) {
  const match = String(value || "").match(/\b(\d{1,3})\s*(?:minute|minutes|min|mins)\b/i);
  return match ? parsePositiveInteger(match[1]) : null;
}

function parsePositiveInteger(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }

  const match = String(value || "").match(/(\d{1,4})/);
  return match ? Number(match[1]) : null;
}

function isValidTime(hours, minutes) {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
