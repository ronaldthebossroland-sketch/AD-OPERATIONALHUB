import { useEffect, useMemo, useRef, useState } from "react";

import { playCalmVoiceAlert } from "../services/voicePlayback";

const CHECK_INTERVAL_MS = 30_000;
const MINUTE_MS = 60_000;
const RECENT_OVERDUE_MS = 24 * 60 * 60 * 1000;
const AMBIGUOUS_TIME_PAST_GRACE_MS = 2 * 60 * 60 * 1000;
const DISMISSED_STORAGE_KEY = "adHubDismissedMissionControlAlerts";

const stageOrder = {
  overdue: 0,
  critical: 1,
  urgent: 3,
  approaching: 4,
  upcoming: 5,
};

function toValidDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimeText(value) {
  const text = String(value || "");
  const match =
    text.match(
      /\b(?:at|by|before|around|for|starts?\s+at)\s+((?:[01]?\d|2[0-3]):[0-5]\d)\s*(AM|PM)?\b/i
    ) ||
    text.match(
      /\b(?:at|by|before|around|for|starts?\s+at)\s+((?:1[0-2]|0?[1-9])\s*(?:AM|PM))\b/i
    ) ||
    text.match(/\b((?:[01]?\d|2[0-3]):[0-5]\d)\s*(AM|PM)?\b/i) ||
    text.match(/\b((?:1[0-2]|0?[1-9])\s*(?:AM|PM))\b/i);

  if (!match) {
    return null;
  }

  const timeMatch = match[1]
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);

  if (!timeMatch) {
    return null;
  }

  let hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2] || "0", 10);
  const meridiem = (timeMatch[3] || match[2])?.toUpperCase();
  const hasMeridiem = Boolean(meridiem);

  if (!meridiem && !timeMatch[2]) {
    return null;
  }

  if (meridiem === "PM" && hour < 12) {
    hour += 12;
  }

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  const date = new Date();

  if (/\btomorrow\b/i.test(text)) {
    date.setDate(date.getDate() + 1);
  }

  date.setHours(hour, minute, 0, 0);

  if (hasMeridiem || hour >= 12) {
    return date;
  }

  const threshold = Date.now() - AMBIGUOUS_TIME_PAST_GRACE_MS;
  const candidates = [new Date(date)];
  const afternoon = new Date(date);
  afternoon.setHours(hour + 12, minute, 0, 0);
  candidates.push(afternoon);

  if (!/\btomorrow\b/i.test(text)) {
    const tomorrowMorning = new Date(date);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    candidates.push(tomorrowMorning);
  }

  return candidates.find((candidate) => candidate.getTime() >= threshold) || date;
}

function parseDueDate(...values) {
  let fallbackDate = null;

  for (const value of values) {
    const directDate = toValidDate(value);

    if (directDate) {
      if (directDate.getTime() >= Date.now() - RECENT_OVERDUE_MS) {
        return directDate;
      }

      fallbackDate ||= directDate;
      continue;
    }

    const parsedDate = parseTimeText(value);

    if (parsedDate) {
      return parsedDate;
    }
  }

  return fallbackDate;
}

export function parseSmartAlarmDueDate(...values) {
  return parseDueDate(...values);
}

function isOpenStatus(status) {
  return !["completed", "done", "resolved", "closed"].includes(
    String(status || "").toLowerCase()
  );
}

function isHighSeverity(value) {
  return /^(high|critical|urgent|top priority)$/i.test(String(value || ""));
}

function formatTime(date) {
  if (!date) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function classifyStage(dueAt, now) {
  if (!dueAt) {
    return "upcoming";
  }

  const msUntilDue = dueAt.getTime() - now.getTime();

  if (msUntilDue < 0) {
    return "overdue";
  }

  if (msUntilDue <= 2 * MINUTE_MS) {
    return "critical";
  }

  if (msUntilDue <= 10 * MINUTE_MS) {
    return "urgent";
  }

  if (msUntilDue <= 30 * MINUTE_MS) {
    return "approaching";
  }

  return "upcoming";
}

export function getSmartAlarmStage(dueAt, now = new Date()) {
  return classifyStage(dueAt, now);
}

function stageLabel(stage) {
  const labels = {
    upcoming: "Upcoming",
    approaching: "Approaching",
    urgent: "Urgent",
    critical: "Critical",
    overdue: "Overdue",
  };

  return labels[stage] || "Upcoming";
}

function voiceTitle(title) {
  return String(title || "this reminder")
    .replace(/\s+reminder$/i, "")
    .trim() || "this reminder";
}

function announcementFor(notification, stage) {
  const title = voiceTitle(notification.title);

  if (stage === "overdue") {
    return `${title} is now past its scheduled time. I can keep it visible while you mark it complete, snooze it, or choose a new time.`;
  }

  if (stage === "critical") {
    return `It is time for ${title}. I have it ready for your attention now.`;
  }

  if (stage === "urgent") {
    return `${title} is coming up in about ten minutes. I will keep it on your radar.`;
  }

  if (stage === "approaching") {
    return `${title} is coming up in about thirty minutes. You have a little time to prepare.`;
  }

  return notification.speakText || `${title} is on your schedule.`;
}

function snoozeOptionsFor(stage, dueAt, now) {
  const minutesUntilDue = dueAt
    ? Math.ceil((dueAt.getTime() - now.getTime()) / MINUTE_MS)
    : 31;

  if (stage === "overdue") {
    return [
      { label: "Snooze 5 Minutes", minutes: 5 },
      { label: "Snooze 10 Minutes", minutes: 10 },
      { label: "Reschedule", mode: "reschedule" },
    ];
  }

  if (minutesUntilDue <= 2) {
    return [
      { label: "Snooze 1 Minute", minutes: 1 },
      { label: "Snooze 2 Minutes", minutes: 2 },
    ];
  }

  if (minutesUntilDue <= 10) {
    return [
      { label: "Snooze 2 Minutes", minutes: 2 },
      { label: "Snooze 5 Minutes", minutes: 5 },
    ];
  }

  if (minutesUntilDue <= 30) {
    return [
      { label: "Snooze 5 Minutes", minutes: 5 },
      { label: "Snooze 10 Minutes", minutes: 10 },
    ];
  }

  return [
    { label: "Snooze 10 Minutes", minutes: 10 },
    { label: "Snooze 15 Minutes", minutes: 15 },
    { label: "Snooze 30 Minutes", minutes: 30 },
  ];
}

function buildAlarmNotification(alarm) {
  const dueAt = parseDueDate(alarm.due_at, alarm.reminder_time, alarm.notes);
  const title = alarm.title || "Reminder";
  const message = dueAt
    ? `${title} starts at ${formatTime(dueAt)}.`
    : alarm.notes || `${title} needs attention.`;

  return {
    id: `alarm-${alarm.id}`,
    recordId: alarm.id,
    kind: "alarm",
    title,
    message,
    dueAt,
    snoozedUntil: toValidDate(alarm.snoozed_until),
    severity: alarm.severity || "Medium",
    status: alarm.status,
    relatedType: alarm.related_type,
    relatedId: alarm.related_id,
    escalationLevel: Number.parseInt(alarm.escalation_level || 0, 10) || 0,
  };
}

function buildMeetingNotification(meeting) {
  const dueAt = parseDueDate(meeting.due_at, meeting.time, meeting.briefing);
  const title = meeting.title || "Meeting";
  const message = dueAt
    ? `${title} starts at ${formatTime(dueAt)}.`
    : `${title} needs attention.`;

  return {
    id: `meeting-${meeting.id}`,
    recordId: meeting.id,
    kind: "meeting",
    title,
    message,
    dueAt,
    severity: meeting.risk || "Medium",
    status: meeting.status,
    relatedType: "meeting",
    relatedId: meeting.id,
  };
}

function buildAlertNotification(alert) {
  const title = alert.title || "High risk alert";
  const dueAt = parseDueDate(alert.due_at, alert.deadline, alert.detail, title);

  return {
    id: `alert-${alert.id}`,
    recordId: alert.id,
    kind: "alert",
    title,
    message: alert.detail || "This alert requires attention.",
    dueAt,
    severity: alert.severity || "Medium",
    status: alert.status,
    relatedType: "alert",
    relatedId: alert.id,
  };
}

function buildOperationNotification(operation) {
  const title = operation.title || "Operation";
  const dueAt = parseDueDate(
    operation.due_at,
    operation.deadline,
    operation.detail,
    title
  );

  return {
    id: `operation-${operation.id}`,
    recordId: operation.id,
    kind: "operation",
    title,
    message: operation.detail || "This operation requires attention.",
    dueAt,
    severity: operation.severity || "Medium",
    status: operation.status,
    relatedType: "operation",
    relatedId: operation.id,
  };
}

function enrichNotification(notification, now) {
  const stage = classifyStage(notification.dueAt, now);
  const highRisk = isHighSeverity(notification.severity);
  const isSnoozed =
    notification.snoozedUntil && notification.snoozedUntil.getTime() > now.getTime();
  const hasTimedAlert = Boolean(notification.dueAt);
  const shouldShow =
    !isSnoozed &&
    (hasTimedAlert
      ? stage !== "upcoming" || highRisk
      : highRisk && ["alert", "operation"].includes(notification.kind));
  const shouldSpeak =
    hasTimedAlert && !isSnoozed && ["urgent", "critical", "overdue"].includes(stage);
  const shouldOpenModal =
    hasTimedAlert && !isSnoozed && ["critical", "overdue"].includes(stage);

  return {
    ...notification,
    stage,
    stageLabel: stageLabel(stage),
    highRisk,
    shouldShow,
    shouldSpeak,
    shouldOpenModal,
    speakText: announcementFor(notification, stage),
    snoozeOptions: snoozeOptionsFor(stage, notification.dueAt, now),
  };
}

function notificationSort(left, right) {
  const leftHighRank = left.highRisk ? 2 : 0;
  const rightHighRank = right.highRisk ? 2 : 0;
  const leftRank = (stageOrder[left.stage] ?? 9) - leftHighRank;
  const rightRank = (stageOrder[right.stage] ?? 9) - rightHighRank;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftTime = left.dueAt?.getTime() || Number.MAX_SAFE_INTEGER;
  const rightTime = right.dueAt?.getTime() || Number.MAX_SAFE_INTEGER;

  return leftTime - rightTime;
}

function loadDismissedNotifications() {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DISMISSED_STORAGE_KEY) || "[]"
    );

    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDismissedNotifications(dismissed) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify([...dismissed].slice(-250))
    );
  } catch {
    // Local storage can be unavailable in private browsing; dismissal still works in memory.
  }
}

export default function useSmartAlarms({
  alerts = [],
  meetings = [],
  reminders = [],
  operations = [],
  onMarkDone,
  onSnooze,
  onReschedule,
  onOpenRelated,
  onTrigger,
} = {}) {
  const [activeNotification, setActiveNotification] = useState(null);
  const [dismissed, setDismissed] = useState(loadDismissedNotifications);
  const [modalCooldowns, setModalCooldowns] = useState({});
  const [tick, setTick] = useState(() => Date.now());
  const spokenKeysRef = useRef(new Set());
  const triggeredKeysRef = useRef(new Set());

  const notifications = useMemo(() => {
    const now = new Date(tick);
    const nextNotifications = [
      ...reminders.filter((alarm) => isOpenStatus(alarm.status)).map(buildAlarmNotification),
      ...meetings.filter((meeting) => isOpenStatus(meeting.status)).map(buildMeetingNotification),
      ...alerts.filter((alert) => isOpenStatus(alert.status)).map(buildAlertNotification),
      ...operations
        .filter((operation) => isOpenStatus(operation.status))
        .map(buildOperationNotification),
    ];

    return nextNotifications
      .map((notification) => enrichNotification(notification, now))
      .sort(notificationSort);
  }, [alerts, meetings, operations, reminders, tick]);

  const visibleNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const localSnoozedUntil = modalCooldowns[notification.id] || 0;

        return (
          notification.shouldShow &&
          !dismissed.has(notification.id) &&
          localSnoozedUntil <= tick
        );
      }),
    [dismissed, modalCooldowns, notifications, tick]
  );

  useEffect(() => {
    saveDismissedNotifications(dismissed);
  }, [dismissed]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick(Date.now());
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    for (const notification of visibleNotifications) {
      if (!notification.shouldSpeak || notification.shouldOpenModal) {
        continue;
      }

      const key = `${notification.id}-${notification.stage}`;

      if (!spokenKeysRef.current.has(key)) {
        spokenKeysRef.current.add(key);
        playCalmVoiceAlert(notification.speakText).catch(() => {});
      }
    }
  }, [visibleNotifications]);

  useEffect(() => {
    for (const notification of visibleNotifications) {
      if (!notification.dueAt || notification.kind !== "alarm") {
        continue;
      }

      if (!["approaching", "urgent", "critical", "overdue"].includes(notification.stage)) {
        continue;
      }

      const key = `${notification.id}-${notification.stage}`;

      if (triggeredKeysRef.current.has(key)) {
        continue;
      }

      triggeredKeysRef.current.add(key);
      onTrigger?.(notification, {
        last_triggered_at: new Date().toISOString(),
        escalation_level:
          notification.stage === "overdue"
            ? Math.max(notification.escalationLevel + 1, 4)
            : Math.max(
                notification.escalationLevel,
                { approaching: 1, urgent: 2, critical: 3 }[notification.stage] || 0
              ),
        ...(notification.stage === "overdue" ? { status: "Overdue" } : {}),
      });
    }
  }, [onTrigger, visibleNotifications]);

  useEffect(() => {
    if (activeNotification) {
      return undefined;
    }

    const nextModalNotification = visibleNotifications.find(
      (notification) =>
        notification.shouldOpenModal &&
        (!modalCooldowns[notification.id] || modalCooldowns[notification.id] <= tick)
    );

    if (!nextModalNotification) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveNotification(nextModalNotification);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeNotification, modalCooldowns, tick, visibleNotifications]);

  function dismiss(notification) {
    if (!notification) {
      return;
    }

    setDismissed((previous) => new Set([...previous, notification.id]));
    setActiveNotification(null);
  }

  function closeActive() {
    if (activeNotification?.shouldOpenModal) {
      setModalCooldowns((previous) => ({
        ...previous,
        [activeNotification.id]: Date.now() + CHECK_INTERVAL_MS,
      }));
    }

    setActiveNotification(null);
  }

  async function snooze(notification, minutes) {
    const snoozedUntil = Date.now() + (minutes || 10) * MINUTE_MS;

    setModalCooldowns((previous) => ({
      ...previous,
      [notification.id]: snoozedUntil,
    }));

    await onSnooze?.(notification, minutes);
    setActiveNotification(null);
  }

  async function markDone(notification) {
    dismiss(notification);
    await onMarkDone?.(notification);
  }

  async function reschedule(notification, nextDate) {
    await onReschedule?.(notification, nextDate);
    setModalCooldowns((previous) => {
      const nextCooldowns = { ...previous };
      delete nextCooldowns[notification.id];
      return nextCooldowns;
    });
    setActiveNotification(null);
  }

  function openRelated(notification) {
    onOpenRelated?.(notification);
    dismiss(notification);
  }

  function openFirst() {
    setActiveNotification(
      visibleNotifications[0] ||
        notifications.find(
          (notification) =>
            !dismissed.has(notification.id) &&
            (modalCooldowns[notification.id] || 0) <= tick
        ) ||
        null
    );
  }

  return {
    activeNotification,
    notifications,
    visibleNotifications,
    alertCount: visibleNotifications.length,
    openFirst,
    closeActive,
    markDone,
    snooze,
    reschedule,
    openRelated,
  };
}
