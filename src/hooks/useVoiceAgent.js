import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createTranscriptionSession,
  runAICommand,
  runScheduleAssistant,
  synthesizeVoiceAudio,
  TRANSCRIPTION_WS_URL,
} from "../services/api";

const AUTO_FINALIZE_MS = 2400;

const completedStatuses = new Set([
  "created",
  "already_exists",
  "drafted",
  "generated",
  "completed",
  "started",
]);

function float32ToInt16Buffer(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < float32Array.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[index]));
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
  }

  return buffer;
}

function parseSocketMessage(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return {
      type: "error",
      error: "Unexpected voice agent message from the backend.",
    };
  }
}

export function cleanVoiceText(value) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

export function actionTypeLabel(type) {
  const labels = {
    meeting: "Meeting",
    alarm: "Reminder",
    operation_alert: "Alert",
    email_draft: "Email Draft",
    report: "Report",
    transcript_summary: "Transcript Summary",
    briefing: "Briefing",
    task: "Task",
    partner: "Partner",
    calendar_event: "Calendar Event",
    general_ai: "AI",
    transcription: "Transcription",
  };

  return labels[type] || String(type || "Action").replaceAll("_", " ");
}

export function getActionDetail(action) {
  const data = action.data || {};

  return cleanVoiceText(
    action.message ||
      data.output ||
      data.summary ||
      data.draft?.subject ||
      data.alarm?.reminder_time ||
      data.task?.detail ||
      data.task?.deadline ||
      data.meeting?.time ||
      data.alert?.detail ||
      data.operation?.detail ||
      ""
  );
}

export function isCompletedAction(action) {
  return completedStatuses.has(action.status);
}

function commandWantsTranscription(command) {
  return /\b(start|begin|open)\s+(live\s+)?(transcrib\w*|transcription)\b/i.test(
    command
  );
}

function isTranscriptionOnlyCommand(command) {
  const remaining = cleanVoiceText(command)
    .replace(
      /\b(start|begin|open)\s+(live\s+)?(transcrib\w*|transcription)\b/gi,
      ""
    )
    .replace(/\b(please|now|and|then|also)\b/gi, "")
    .trim();

  return !remaining;
}

function needsMeetingDateTime(command) {
  return (
    /\b(schedule|create|book|set up)\b/i.test(command) &&
    /\bmeeting\b/i.test(command) &&
    !/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at|by|for\s+\d|am|pm|\d{1,2}:\d{2})\b/i.test(
      command
    )
  );
}

function hasMeetingSchedulingIntent(command) {
  return (
    /\b(schedule|create|book|set up|set|arrange)\b.*\b(meeting|appointment|call)\b/i.test(
      command
    ) || /\bmeeting\s+with\b/i.test(command)
  );
}

function hasCalendarSchedulingIntent(command) {
  return (
    /\b(add|create|schedule|book|put|place|set up)\b.*\b(calendar|event|appointment)\b/i.test(
      command
    ) || /\bput\b.*\bon\s+my\s+calendar\b/i.test(command)
  );
}

function hasDateOrTime(text) {
  return /\b(today|tomorrow|tonight|morning|afternoon|evening|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+\w+|this\s+\w+|this\s+month|next\s+month|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:this|next)\s+month|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)|in\s+(?:a|an|one|\d+)\s+(?:minute|minutes|hour|hours|day|days)|at\s+\d{1,2}|by\s+\d{1,2}|for\s+\d{1,2}|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i.test(
    text
  );
}

const spokenHourValues = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

const weekdayPattern =
  "sun(?:day)?|mon(?:day)?|tue(?:s|sday|day)?|wed(?:nesday)?|thu(?:r|rs|rsday|rday|day)?|fri(?:day)?|sat(?:urday)?";
const monthNamePattern =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

function extractRelativeTimePhrase(text) {
  const match = cleanVoiceText(text).match(
    /\b(in\s+(?:a|an|one|\d+)\s+(?:minute|minutes|min|mins|hour|hours|hr|hrs|day|days))\b/i
  );

  return match ? match[1].replace(/\s+/g, " ").toLowerCase() : "";
}

function formatLocalDatePhrase(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function resolveDayOfMonthPhrase(dayText, monthModifier = "") {
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return "";
  }

  const now = new Date();
  const date = new Date(now);

  date.setHours(0, 0, 0, 0);
  date.setDate(1);

  if (/next/i.test(monthModifier)) {
    date.setMonth(date.getMonth() + 1);
  }

  date.setDate(day);

  if (!monthModifier && date.getTime() < now.setHours(0, 0, 0, 0)) {
    date.setMonth(date.getMonth() + 1);
  }

  return formatLocalDatePhrase(date);
}

function extractDayPhrase(text) {
  const value = cleanVoiceText(text).replace(/\s+/g, " ").trim();

  if (!value) {
    return "";
  }

  const relativeDayMatch = value.match(
    /\b(day after tomorrow|tomorrow|today|tonight|next week)\b/i
  );

  if (relativeDayMatch) {
    return relativeDayMatch[1].toLowerCase();
  }

  const monthReferenceMatch = value.match(
    /\b(?:on\s+|by\s+|due\s+|deadline\s+|the\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*:)\s+(?:of\s+)?((?:this|next)\s+month)\b/i
  );

  if (monthReferenceMatch) {
    return resolveDayOfMonthPhrase(monthReferenceMatch[1], monthReferenceMatch[2]);
  }

  const ordinalDayMatch = value.match(
    /\b(?:on\s+|by\s+|due\s+|deadline\s+|the\s+)(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)(?!\s*:)\b/i
  );

  if (ordinalDayMatch) {
    return resolveDayOfMonthPhrase(ordinalDayMatch[1]);
  }

  const weekdayMatch = value.match(
    new RegExp(`\\b((?:next|this)\\s+(?:${weekdayPattern})|(?:${weekdayPattern}))\\b`, "i")
  );

  if (weekdayMatch) {
    return weekdayMatch[1].toLowerCase();
  }

  const monthFirstMatch = value.match(
    new RegExp(`\\b((?:${monthNamePattern})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?)\\b`, "i")
  );
  const dayFirstMatch = value.match(
    new RegExp(`\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNamePattern})(?:,?\\s+\\d{4})?)\\b`, "i")
  );
  const numericDateMatch = value.match(/\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/);

  return cleanVoiceText(
    monthFirstMatch?.[1] || dayFirstMatch?.[1] || numericDateMatch?.[1]
  );
}

function extractMeridiem(text) {
  const value = cleanVoiceText(text);

  if (/\b(midnight|a\.?m\.?|morning)\b/i.test(value)) {
    return "AM";
  }

  if (/\b(noon|p\.?m\.?|afternoon|evening|tonight|night)\b/i.test(value)) {
    return "PM";
  }

  return "";
}

function normalizeClockText(hour, minute = "00") {
  const numericHour = Number.parseInt(
    spokenHourValues[String(hour).toLowerCase()] || hour,
    10
  );

  if (!Number.isFinite(numericHour)) {
    return "";
  }

  return `${numericHour}:${String(minute || "00").padStart(2, "0")}`;
}

function extractClockPhrase(text) {
  const value = cleanVoiceText(text)
    .replace(/\b(\d{1,2})\s*:\s*([0-5]\d)\b/g, "$1:$2")
    .replace(/\s+/g, " ")
    .trim();

  if (/\b(noon|midday)\b/i.test(value)) {
    return "12:00";
  }

  if (/\bmidnight\b/i.test(value)) {
    return "12:00";
  }

  const colonMatch = value.match(
    /\b((?:[01]?\d|2[0-3]):[0-5]\d)\s*(?:a\.?m\.?|p\.?m\.?)?\b/i
  );

  if (colonMatch) {
    return colonMatch[1];
  }

  const spacedTimeMatch = value.match(
    /\b((?:[01]?\d|2[0-3])\s+[0-5]\d)\s*(?:a\.?m\.?|p\.?m\.?)?\b/i
  );

  if (spacedTimeMatch) {
    const [hour, minute] = spacedTimeMatch[1].split(/\s+/);
    return normalizeClockText(hour, minute);
  }

  const meridiemHourMatch = value.match(
    new RegExp(
      `\\b((?:1[0-2]|0?[1-9])|${Object.keys(spokenHourValues).join("|")})\\s*(?:a\\.?m\\.?|p\\.?m\\.?)\\b`,
      "i"
    )
  );

  if (meridiemHourMatch) {
    return normalizeClockText(meridiemHourMatch[1]);
  }

  const prefixedHourMatch = value.match(
    new RegExp(
      `\\b(?:at|by|around|for)\\s+((?:2[0-3]|1[0-9]|0?[1-9])|${Object.keys(spokenHourValues).join("|")})\\b(?!\\s*(?:minutes?|mins?|hours?|hrs?|days?))`,
      "i"
    )
  );

  if (prefixedHourMatch) {
    return normalizeClockText(prefixedHourMatch[1]);
  }

  const shortReplyMatch = value.match(
    new RegExp(`^((?:1[0-2]|0?[1-9])|${Object.keys(spokenHourValues).join("|")})$`, "i")
  );

  return shortReplyMatch ? normalizeClockText(shortReplyMatch[1]) : "";
}

function mergeTimeDetails(previousDetails, text) {
  const previous = previousDetails || {
    day: "",
    clock: "",
    meridiem: "",
    relative: "",
  };
  const relative = extractRelativeTimePhrase(text);
  const day = extractDayPhrase(text);
  const clock = extractClockPhrase(text);
  const meridiem = extractMeridiem(text);

  if (relative && !day && !clock && !meridiem) {
    return {
      day: "",
      clock: "",
      meridiem: "",
      relative,
    };
  }

  return {
    day: day || previous.day || "",
    clock: clock || previous.clock || "",
    meridiem: meridiem || previous.meridiem || "",
    relative: "",
  };
}

function clockNeedsMeridiem(clock, meridiem) {
  if (!clock || meridiem) {
    return false;
  }

  const hour = Number.parseInt(clock.split(":")[0], 10);
  return hour >= 1 && hour <= 12;
}

function formatClockForQuestion(clock) {
  return cleanVoiceText(clock).replace(/^0(?=\d)/, "");
}

function formatTimeForQuestion(details) {
  const clock = formatClockForQuestion(details?.clock || "that time");
  const suffix = details?.meridiem ? ` ${details.meridiem}` : "";

  return details?.day ? `${details.day} at ${clock}${suffix}` : `${clock}${suffix}`;
}

function buildResolvedTimePhrase(details) {
  if (!details) {
    return "";
  }

  if (details.relative) {
    return details.relative;
  }

  if (!details.day || !details.clock || clockNeedsMeridiem(details.clock, details.meridiem)) {
    return "";
  }

  const clock = formatClockForQuestion(details.clock);
  const suffix = details.meridiem ? ` ${details.meridiem}` : "";
  return `${details.day} at ${clock}${suffix}`;
}

function getNextTimeDetailStep(details, options) {
  const nextDetails = details || {};

  if (nextDetails.relative) {
    return null;
  }

  if (!nextDetails.day) {
    return {
      asking: `${options.prefix}Day`,
      question: nextDetails.clock
        ? options.dayWithClock(formatClockForQuestion(nextDetails.clock))
        : options.day,
    };
  }

  if (!nextDetails.clock) {
    return {
      asking: `${options.prefix}Time`,
      question: options.time(nextDetails.day),
    };
  }

  if (clockNeedsMeridiem(nextDetails.clock, nextDetails.meridiem)) {
    return {
      asking: `${options.prefix}Meridiem`,
      question: options.meridiem(formatTimeForQuestion(nextDetails)),
    };
  }

  return null;
}

function isTimeDetailQuestion(asking, prefix) {
  return [`${prefix}Day`, `${prefix}Time`, `${prefix}Meridiem`].includes(asking);
}

function extractMeetingTitle(text) {
  const cleanTextValue = cleanVoiceText(text);
  const withMatch = cleanTextValue.match(
    /\b(?:meeting|appointment|call)\s+with\s+(.+?)(?:\s+(?:today|tomorrow|tonight|on|at|by|for|around|from|next|this|in\s+\d+)\b|[,.;]|$)/i
  );
  const titledMatch = cleanTextValue.match(
    /\b(?:called|titled|about|regarding)\s+(.+?)(?:\s+(?:today|tomorrow|tonight|on|at|by|for|around|from|next|this|in\s+\d+)\b|[,.;]|$)/i
  );

  const candidate = cleanVoiceText(withMatch?.[1] || titledMatch?.[1]);

  if (!candidate || /^(me|myself|it)$/i.test(candidate)) {
    return "";
  }

  return /^meeting\b/i.test(candidate) ? candidate : `Meeting with ${candidate}`;
}

function cleanMeetingTimeReply(text) {
  return cleanVoiceText(text)
    .replace(/^(it'?s|make it|set it|schedule it|for|at)\s+/i, "")
    .trim();
}

function extractMeetingTimePhrase(text) {
  const cleanTextValue = cleanVoiceText(text);
  const day = extractDayPhrase(cleanTextValue);

  if (day) {
    const dayClock = extractClockPhrase(cleanTextValue);
    const meridiem = extractMeridiem(cleanTextValue);

    if (dayClock) {
      return `${day} at ${formatClockForQuestion(dayClock)}${meridiem ? ` ${meridiem}` : ""}`;
    }

    return day;
  }

  const dateWords =
    "today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\\s+\\w+|this\\s+\\w+";
  const clock = "\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?";
  const patterns = [
    /\b(in\s+(?:a|an|one|\d+)\s+(?:minute|minutes|hour|hours|day|days))\b/i,
    new RegExp(`\\b((?:${dateWords})\\s+(?:at|by|around|for)?\\s*${clock})\\b`, "i"),
    new RegExp(`\\b((?:at|by|around|for)\\s+${clock}\\s*(?:${dateWords})?)\\b`, "i"),
    new RegExp(`\\b(${clock}\\s+(?:${dateWords}))\\b`, "i"),
    new RegExp(`\\b(${clock})\\b`, "i"),
    new RegExp(`\\b(${dateWords})\\b`, "i"),
  ];

  for (const pattern of patterns) {
    const match = cleanTextValue.match(pattern);

    if (match) {
      return cleanMeetingTimeReply(match[1]);
    }
  }

  return "";
}

const reminderNumberWords = {
  zero: 0,
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  couple: 2,
  three: 3,
  few: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function parseReminderAmount(value) {
  const cleanValue = cleanVoiceText(value)
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\bof\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanValue) {
    return null;
  }

  const numeric = Number.parseFloat(cleanValue);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  if (cleanValue === "half") {
    return 0.5;
  }

  if (cleanValue === "quarter") {
    return 0.25;
  }

  const tokens = cleanValue.split(" ");
  const hasFraction = tokens.includes("half") || tokens.includes("quarter");
  const hasScale = tokens.includes("hundred") || tokens.includes("thousand");
  let total = 0;
  let current = 0;
  let matched = false;

  for (const token of tokens) {
    if ((token === "a" || token === "an") && hasFraction && !hasScale) {
      continue;
    }

    if (token === "half") {
      current += 0.5;
      matched = true;
      continue;
    }

    if (token === "quarter") {
      current += 0.25;
      matched = true;
      continue;
    }

    if (token === "hundred") {
      current = Math.max(current, 1) * 100;
      matched = true;
      continue;
    }

    if (token === "thousand") {
      total += Math.max(current, 1) * 1000;
      current = 0;
      matched = true;
      continue;
    }

    const valueFromWord = reminderNumberWords[token];

    if (valueFromWord === undefined) {
      continue;
    }

    current += valueFromWord;
    matched = true;
  }

  return matched ? total + current : null;
}

function normalizeReminderUnit(unit) {
  const cleanUnit = cleanVoiceText(unit).toLowerCase();

  if (/^d(?:ay|ays)?$/.test(cleanUnit)) {
    return "days";
  }

  if (/^h(?:our|ours|r|rs)?$/.test(cleanUnit)) {
    return "hours";
  }

  if (/^(m|mins?|minu?t?e?s?|minues|mintes|mns?)$/.test(cleanUnit)) {
    return "minutes";
  }

  return "";
}

function singularizeReminderUnit(unit, amount) {
  if (Number(amount) === 1) {
    return unit.replace(/s$/, "");
  }

  return unit;
}

function formatReminderLead(amount, unit) {
  if (!Number.isFinite(amount) || amount <= 0 || !unit) {
    return "";
  }

  const roundedAmount = Number.isInteger(amount)
    ? amount
    : Number.parseFloat(amount.toFixed(2));

  return `${roundedAmount} ${singularizeReminderUnit(unit, roundedAmount)} before`;
}

function extractReminderLead(text) {
  const cleanTextValue = cleanVoiceText(text);

  if (/\b(?:a\s+)?quarter\s+(?:of\s+)?(?:an?\s+)?hour\b/i.test(cleanTextValue)) {
    return "15 minutes before";
  }

  if (/\b(?:a\s+)?half\s+(?:of\s+)?(?:an?\s+)?hour\b/i.test(cleanTextValue)) {
    return "30 minutes before";
  }

  const numericMatch = cleanTextValue.match(
    /\b(\d+(?:\.\d+)?)\s*(m|mins?|minu?t?e?s?|minues|mintes|mns?|h|hrs?|hours?|d|days?)\b(?:\s*(?:before|early|earlier|ahead|prior|pre|notice|advance))?/i
  );

  if (numericMatch) {
    const unit = normalizeReminderUnit(numericMatch[2]);
    const amount = Number.parseFloat(numericMatch[1]);
    return formatReminderLead(amount, unit);
  }

  const wordMatch = cleanTextValue.match(
    /\b((?:(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|couple|few|half|quarter|and|of)[-\s]*)+)\s*(minutes?|mins?|minu?t?e?s?|minues|mintes|mns?|hours?|hrs?|days?)\b(?:\s*(?:before|early|earlier|ahead|prior|pre|notice|advance))?/i
  );

  if (wordMatch) {
    const unit = normalizeReminderUnit(wordMatch[2]);
    const amount = parseReminderAmount(wordMatch[1]);
    return formatReminderLead(amount, unit);
  }

  return "";
}

function extractImplicitMinuteReminderLead(text) {
  const cleanTextValue = cleanVoiceText(text)
    .toLowerCase()
    .replace(/\b(about|around|just|please|before|early|earlier|ahead|prior)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const numberWordPattern = [
    "a",
    "an",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "thirty",
    "forty",
    "fourty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
    "hundred",
    "thousand",
    "couple",
    "few",
    "half",
    "quarter",
    "and",
    "of",
  ].join("|");
  const match =
    cleanTextValue.match(/^(\d+(?:\.\d+)?)$/) ||
    cleanTextValue.match(new RegExp(`^((?:(?:${numberWordPattern})\\s*)+)$`, "i"));

  if (!match) {
    return "";
  }

  return formatReminderLead(parseReminderAmount(match[1]), "minutes");
}

function extractExplicitReminderTimePhrase(text) {
  const cleanTextValue = cleanVoiceText(text);
  const reminderTimeMatch =
    cleanTextValue.match(
      /\b(?:reminder|alarm|alert)\s+(?:at|by|around|for)\s+(.+?)(?:\s+(?:for|about|to)\b|[,.;]|$)/i
    ) ||
    cleanTextValue.match(
      /\bremind\s+me\s+(?:at|by|around|for)\s+(.+?)(?:\s+(?:for|about|to)\b|[,.;]|$)/i
    );

  return reminderTimeMatch ? extractMeetingTimePhrase(reminderTimeMatch[1]) : "";
}

function getReminderPreference(text) {
  if (isNegativeReply(text) || /\b(without|skip|no)\s+(a\s+)?(reminder|alarm|alert)\b/i.test(text)) {
    return { wantsReminder: false, lead: "", absoluteTime: "" };
  }

  const lead = extractReminderLead(text);
  const absoluteTime = extractExplicitReminderTimePhrase(text);

  if (lead || absoluteTime || /\b(yes|yeah|yep|sure|please|remind|reminder|alarm|alert)\b/i.test(text)) {
    return {
      wantsReminder: true,
      lead,
      absoluteTime,
    };
  }

  return { wantsReminder: null, lead: "", absoluteTime: "" };
}

function createMeetingConversation(command) {
  const title = extractMeetingTitle(command);
  const timeDetails = mergeTimeDetails(null, command);
  const time = buildResolvedTimePhrase(timeDetails);
  const reminderPreference = getReminderPreference(command);
  const reminderTimeDetails = reminderPreference.absoluteTime
    ? mergeTimeDetails(null, reminderPreference.absoluteTime)
    : null;
  const reminderLead =
    reminderPreference.lead ||
    (reminderTimeDetails ? buildReminderLeadFromDetails(reminderTimeDetails) : "");

  return {
    type: "meeting",
    title,
    time,
    timeDetails,
    wantsReminder: reminderPreference.wantsReminder,
    reminderLead,
    reminderTimeDetails,
    asking: "",
  };
}

function buildReminderLeadFromDetails(details) {
  const resolved = buildResolvedTimePhrase(details);
  return resolved ? `at ${resolved}` : "";
}

function getNextMeetingStep(conversation) {
  const timeStep = getNextTimeDetailStep(conversation.timeDetails, {
    prefix: "meetingTime",
    day: "What day should I schedule the meeting for?",
    dayWithClock: (clock) =>
      `What day should I schedule the meeting for at ${clock}?`,
    time: (day) => `What exact time should I use for ${day}?`,
    meridiem: (time) => `Is that ${time} AM or PM?`,
  });

  if (timeStep) {
    return timeStep;
  }

  if (!conversation.title) {
    return {
      asking: "title",
      question: "Who is the meeting with, or what should I call it?",
    };
  }

  if (conversation.wantsReminder === null) {
    return {
      asking: "reminder",
      question: "Do you want a reminder for it?",
    };
  }

  if (conversation.wantsReminder && conversation.reminderTimeDetails) {
    const reminderTimeStep = getNextTimeDetailStep(conversation.reminderTimeDetails, {
      prefix: "meetingReminderTime",
      day: "What day should I set that reminder for?",
      dayWithClock: (clock) =>
        `What day should I set that reminder for at ${clock}?`,
      time: (day) => `What exact reminder time should I use for ${day}?`,
      meridiem: (time) => `Is the reminder at ${time} AM or PM?`,
    });

    if (reminderTimeStep) {
      return reminderTimeStep;
    }
  }

  if (conversation.wantsReminder && !conversation.reminderLead) {
    return {
      asking: "reminderLead",
      question: "How long before the meeting should I remind you? You can say any amount, like 8 minutes before, 1 hour before, or 90 minutes before.",
    };
  }

  return null;
}

function updateMeetingConversation(conversation, reply) {
  const nextConversation = { ...conversation };
  const cleanReply = cleanVoiceText(reply);

  if (isTimeDetailQuestion(conversation.asking, "meetingTime")) {
    nextConversation.timeDetails = mergeTimeDetails(
      nextConversation.timeDetails,
      cleanReply
    );
    nextConversation.time = buildResolvedTimePhrase(nextConversation.timeDetails);
  }

  if (conversation.asking === "title") {
    const title = extractMeetingTitle(cleanReply);
    nextConversation.title =
      title ||
      (/^(with|for)\b/i.test(cleanReply)
        ? `Meeting ${cleanReply}`
        : cleanReply);
  }

  if (conversation.asking === "reminder") {
    const preference = getReminderPreference(cleanReply);
    const implicitLead = extractImplicitMinuteReminderLead(cleanReply);
    const absoluteReminderTime = hasDateOrTime(cleanReply)
      ? preference.absoluteTime || extractMeetingTimePhrase(cleanReply)
      : "";

    if (preference.wantsReminder === null && !absoluteReminderTime && !implicitLead) {
      return {
        conversation: nextConversation,
        question: "Should I add a reminder for this meeting?",
      };
    }

    nextConversation.wantsReminder =
      preference.wantsReminder === null ? true : preference.wantsReminder;
    nextConversation.reminderLead = preference.lead || implicitLead;
    nextConversation.reminderTimeDetails = absoluteReminderTime
      ? mergeTimeDetails(nextConversation.reminderTimeDetails, absoluteReminderTime)
      : null;
    nextConversation.reminderLead =
      nextConversation.reminderLead ||
      buildReminderLeadFromDetails(nextConversation.reminderTimeDetails);
  }

  if (conversation.asking === "reminderLead") {
    if (isNegativeReply(cleanReply)) {
      nextConversation.wantsReminder = false;
      nextConversation.reminderLead = "";
      nextConversation.reminderTimeDetails = null;
    } else {
      const lead =
        extractReminderLead(cleanReply) ||
        extractImplicitMinuteReminderLead(cleanReply);
      const absoluteReminderTime = hasDateOrTime(cleanReply)
        ? extractMeetingTimePhrase(cleanReply)
        : "";

      if (!lead && !absoluteReminderTime) {
        return {
          conversation: nextConversation,
          question: "How long before the meeting should I remind you? You can say 8 minutes before, 1 hour before, 90 minutes before, or no reminder.",
        };
      }

      nextConversation.reminderLead = lead;
      nextConversation.reminderTimeDetails = absoluteReminderTime
        ? mergeTimeDetails(nextConversation.reminderTimeDetails, absoluteReminderTime)
        : null;
      nextConversation.reminderLead =
        nextConversation.reminderLead ||
        buildReminderLeadFromDetails(nextConversation.reminderTimeDetails);
    }
  }

  if (isTimeDetailQuestion(conversation.asking, "meetingReminderTime")) {
    nextConversation.reminderTimeDetails = mergeTimeDetails(
      nextConversation.reminderTimeDetails,
      cleanReply
    );
    nextConversation.reminderLead = buildReminderLeadFromDetails(
      nextConversation.reminderTimeDetails
    );
  }

  const nextStep = getNextMeetingStep(nextConversation);

  if (nextStep) {
    return {
      conversation: { ...nextConversation, asking: nextStep.asking },
      question: nextStep.question,
    };
  }

  return {
    conversation: nextConversation,
    question: "",
  };
}

function buildMeetingConversationCommand(conversation) {
  const title = cleanVoiceText(conversation.title) || "New Meeting";
  const time = buildResolvedTimePhrase(conversation.timeDetails) || conversation.time;
  const reminderLead =
    cleanVoiceText(conversation.reminderLead) ||
    buildReminderLeadFromDetails(conversation.reminderTimeDetails);

  if (conversation.wantsReminder && /^at\s+/i.test(reminderLead)) {
    return [
      `Schedule a meeting titled "${title}" for ${time} without reminder.`,
      `Set a reminder titled "${title} Reminder" ${reminderLead} for that meeting.`,
    ].join(" ");
  }

  const reminderText = conversation.wantsReminder
    ? ` with a reminder ${reminderLead}`
    : " without reminder";

  return `Schedule a meeting titled "${title}" for ${time}${reminderText}.`;
}

function noOptionalValue(text) {
  return (
    isNegativeReply(text) ||
    /\b(no|none|skip|leave it|not now|no deadline|no due date|no owner|no email|no phone)\b/i.test(
      text
    )
  );
}

function extractPriority(text, fallback = "") {
  if (/\b(high|urgent|critical|top priority)\b/i.test(text)) return "High";
  if (/\b(low)\b/i.test(text)) return "Low";
  if (/\b(medium|normal|standard)\b/i.test(text)) return "Medium";
  return fallback;
}

function extractEmail(text) {
  return cleanVoiceText(text).match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "";
}

function extractPhone(text) {
  return cleanVoiceText(text).match(/\+?\d[\d\s().-]{6,}\d/)?.[0]?.trim() || "";
}

function stripKnownTime(text) {
  const time = extractMeetingTimePhrase(text);
  return cleanVoiceText(text)
    .replace(time, "")
    .replace(/\b(?:today|tomorrow|tonight|by|at|for|around|due|deadline|in)\b\s*$/i, "")
    .trim();
}

function hasStandaloneReminderIntent(command) {
  return /\b(remind\s+me|set\s+(?:a\s+)?reminder|create\s+(?:a\s+)?reminder|set\s+(?:an?\s+)?alarm)\b/i.test(
    command
  );
}

function extractStandaloneReminderTitle(command) {
  const text = stripKnownTime(command)
    .replace(/\b(?:please|can you|could you|i want you to)\b/gi, "")
    .replace(/\b(?:set|create|add)\s+(?:a|an)?\s*(?:reminder|alarm)\b/gi, "")
    .replace(/\bremind\s+me\s+(?:to|about)?\b/gi, "")
    .replace(/\b(?:for|at|by|in)\s*$/i, "")
    .trim();

  return /^(me|reminder|alarm|it)$/i.test(text) ? "" : text;
}

function createReminderConversation(command) {
  const timeDetails = mergeTimeDetails(null, command);

  return {
    type: "reminder",
    title: extractStandaloneReminderTitle(command),
    time: buildResolvedTimePhrase(timeDetails),
    timeDetails,
    asking: "",
  };
}

function getNextReminderStep(conversation) {
  const timeStep = getNextTimeDetailStep(conversation.timeDetails, {
    prefix: "reminderTime",
    day: "What day should I set the reminder for?",
    dayWithClock: (clock) =>
      `What day should I set the reminder for at ${clock}?`,
    time: (day) => `What exact time should I remind you on ${day}?`,
    meridiem: (time) => `Is the reminder at ${time} AM or PM?`,
  });

  if (timeStep) {
    return timeStep;
  }

  if (!conversation.title) {
    return { asking: "title", question: "What should I remind you about?" };
  }

  return null;
}

function updateReminderConversation(conversation, reply) {
  const nextConversation = { ...conversation };
  const cleanReply = cleanVoiceText(reply);

  if (isTimeDetailQuestion(conversation.asking, "reminderTime")) {
    nextConversation.timeDetails = mergeTimeDetails(
      nextConversation.timeDetails,
      cleanReply
    );
    nextConversation.time = buildResolvedTimePhrase(nextConversation.timeDetails);
  }

  if (conversation.asking === "title") {
    nextConversation.title = cleanReply;
  }

  const nextStep = getNextReminderStep(nextConversation);
  return nextStep
    ? {
        conversation: { ...nextConversation, asking: nextStep.asking },
        question: nextStep.question,
      }
    : { conversation: nextConversation, question: "" };
}

function buildReminderConversationCommand(conversation) {
  const time = buildResolvedTimePhrase(conversation.timeDetails) || conversation.time;
  return `Set a reminder titled "${conversation.title}" for ${time}.`;
}

function hasTaskIntent(command) {
  return /\b(create|add|make|set up|set|assign|log)\b.*\b(task|todo|to do|action item)\b/i.test(command);
}

function extractDatePhraseForRecord(text) {
  const timePhrase = extractMeetingTimePhrase(text);
  const dayPhrase = extractDayPhrase(text);

  return timePhrase || dayPhrase || "";
}

function extractDuePhrase(text) {
  const cleanTextValue = cleanVoiceText(text);
  const match = cleanTextValue.match(
    /\b(?:due(?:\s+date)?|deadline|by|on)\s*(?:should\s+be|is|for|at|to)?\s+(.+?)(?:\s+(?:priority|owner|status|severity|level)\b|[,.;]|$)/i
  );
  const candidate = cleanVoiceText(match?.[1] || cleanTextValue);

  return extractDatePhraseForRecord(candidate);
}

function isGenericTaskTitle(title) {
  const normalized = cleanVoiceText(title).toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    /^(a|new|task|todo|to do|it|and|the)$/i.test(normalized) ||
    /\b(set|create|add|make|log)\s+(?:a\s+)?(?:task|todo|to do|action item)\s+(?:for\s+)?me\b/i.test(
      normalized
    ) ||
    /\b(i would love|i want|can you|could you|please)\b.*\b(task|todo|action item)\b/i.test(
      normalized
    )
  );
}

function extractTaskOwner(text) {
  const match = cleanVoiceText(text).match(
    /\b(?:owner|owned by|assign(?:ed)? to|for)\s+(?:is\s+|should\s+be\s+)?(.+?)(?:\s+(?:due|deadline|priority|detail|details|notes?|status)\b|[,.;]|$)/i
  );
  const owner = cleanVoiceText(match?.[1])
    .replace(/^me$/i, "Me")
    .trim();

  return /^(task|todo|it)$/i.test(owner) ? "" : owner;
}

function extractTaskDetail(text) {
  const cleanTextValue = cleanVoiceText(text);
  const match = cleanTextValue.match(
    /\b(?:detail|details|note|notes|description)\s*(?:is|are|should\s+be|:)?\s+(.+?)(?:\s+(?:due|deadline|priority|owner|status)\b|[,.;]|$)/i
  );

  return cleanVoiceText(match?.[1]);
}

function cleanTaskTitleCandidate(text) {
  return cleanVoiceText(text)
    .replace(/\s+\b(?:with\s+deadline|due(?:\s+date)?|deadline|by|on)\b.+$/i, "")
    .replace(/\s+\b(?:priority|owner|detail|details|note|notes|status)\b.+$/i, "")
    .replace(/\b(?:for\s+)?me\b/gi, "")
    .replace(/\b(?:and\s+)?(?:the\s+)?$/i, "")
    .replace(/^(to|for)\s+/i, "")
    .trim();
}

function extractTaskTitle(command) {
  const cleanCommand = cleanVoiceText(command);
  const match = cleanCommand.match(
    /\b(?:task|todo|to do|action item)\s+(?:to|for|called|titled)?\s*(.+?)(?:\s+(?:with\s+deadline|by|due(?:\s+date)?|deadline|priority|owner)\b|[,.;]|$)/i
  );
  const title = cleanTaskTitleCandidate(match?.[1]);

  return isGenericTaskTitle(title) ? "" : title;
}

function createTaskConversation(command) {
  return {
    type: "task",
    title: extractTaskTitle(command),
    deadline: extractDuePhrase(command) || null,
    priority: extractPriority(command),
    owner: extractTaskOwner(command) || null,
    detail: extractTaskDetail(command) || null,
    asking: "",
  };
}

function getNextTaskStep(conversation) {
  if (!conversation.title) {
    return { asking: "title", question: "What task should I create?" };
  }

  if (conversation.deadline === undefined || conversation.deadline === null) {
    return { asking: "deadline", question: "When is it due? You can say no deadline." };
  }

  if (!conversation.priority) {
    return { asking: "priority", question: "What priority should I use: high, medium, or low?" };
  }

  if (conversation.owner === undefined || conversation.owner === null) {
    return { asking: "owner", question: "Who owns this task? You can say me or no owner." };
  }

  if (conversation.detail === undefined || conversation.detail === null) {
    return { asking: "detail", question: "Any extra detail for the task? You can say no details." };
  }

  return null;
}

function updateTaskConversation(conversation, reply) {
  const nextConversation = { ...conversation };
  const cleanReply = cleanVoiceText(reply);

  if (conversation.asking === "title") {
    nextConversation.title =
      extractTaskTitle(cleanReply) || cleanTaskTitleCandidate(cleanReply) || cleanReply;
    nextConversation.deadline ||= extractDuePhrase(cleanReply) || null;
    nextConversation.priority ||= extractPriority(cleanReply);
    nextConversation.owner ||= extractTaskOwner(cleanReply) || null;
    nextConversation.detail ||= extractTaskDetail(cleanReply) || null;
  }

  if (conversation.asking === "deadline") {
    nextConversation.deadline = noOptionalValue(cleanReply)
      ? ""
      : extractDuePhrase(cleanReply) || cleanReply;
  }

  if (conversation.asking === "priority") {
    nextConversation.priority = extractPriority(cleanReply, "Medium");
  }

  if (conversation.asking === "owner") {
    nextConversation.owner = noOptionalValue(cleanReply)
      ? ""
      : extractTaskOwner(cleanReply) || cleanReply;
  }

  if (conversation.asking === "detail") {
    nextConversation.detail = noOptionalValue(cleanReply)
      ? ""
      : extractTaskDetail(cleanReply) || cleanReply;
  }

  const nextStep = getNextTaskStep(nextConversation);
  return nextStep
    ? {
        conversation: { ...nextConversation, asking: nextStep.asking },
        question: nextStep.question,
      }
    : { conversation: nextConversation, question: "" };
}

function buildTaskConversationCommand(conversation) {
  return [
    `Create a task titled "${conversation.title}"`,
    conversation.deadline ? `with deadline ${conversation.deadline}` : "with no deadline",
    `and priority ${conversation.priority || "Medium"}.`,
    conversation.owner ? `Owner: ${conversation.owner}.` : "No owner.",
    conversation.detail ? `Detail: ${conversation.detail}.` : "No extra detail.",
  ].join(" ");
}

function hasOperationIntent(command) {
  return /\b(create|add|raise|log|mark)\b.*\b(operation|alert|risk|issue|repair|incident|outage)\b/i.test(command);
}

function extractOperationTitle(command) {
  const match = cleanVoiceText(command).match(
    /\b(?:operation|alert|risk|issue|repair|incident|outage)\s+(?:for|about|called|titled)?\s*(.+?)(?:\s+(?:severity|priority|level|due|by|area)\b|[,.;]|$)/i
  );

  return cleanVoiceText(match?.[1]).replace(/^(for|about)\s+/i, "");
}

function createOperationConversation(command) {
  return {
    type: "operation",
    title: extractOperationTitle(command),
    severity: extractPriority(command),
    due: extractDuePhrase(command) || null,
    asking: "",
  };
}

function getNextOperationStep(conversation) {
  if (!conversation.title) {
    return { asking: "title", question: "What operation, risk, or issue should I log?" };
  }

  if (!conversation.severity) {
    return { asking: "severity", question: "How severe is it: high, medium, or low?" };
  }

  if (conversation.due === undefined || conversation.due === null) {
    return { asking: "due", question: "When does it need attention? You can say no deadline." };
  }

  return null;
}

function updateOperationConversation(conversation, reply) {
  const nextConversation = { ...conversation };
  const cleanReply = cleanVoiceText(reply);

  if (conversation.asking === "title") {
    nextConversation.title = cleanReply;
  }

  if (conversation.asking === "severity") {
    nextConversation.severity = extractPriority(cleanReply, "Medium");
  }

  if (conversation.asking === "due") {
    nextConversation.due = noOptionalValue(cleanReply)
      ? ""
      : extractDuePhrase(cleanReply) || cleanReply;
  }

  const nextStep = getNextOperationStep(nextConversation);
  return nextStep
    ? {
        conversation: { ...nextConversation, asking: nextStep.asking },
        question: nextStep.question,
      }
    : { conversation: nextConversation, question: "" };
}

function buildOperationConversationCommand(conversation) {
  return [
    `Create an operation alert titled "${conversation.title}"`,
    `with severity ${conversation.severity || "Medium"}`,
    conversation.due ? `due ${conversation.due}.` : "with no deadline.",
  ].join(" ");
}

function hasPartnerIntent(command) {
  return /\b(create|add|save|register)\b.*\b(partner|vendor|sponsor|partnership)\b/i.test(command);
}

function extractPartnerName(command) {
  const match = cleanVoiceText(command).match(
    /\b(?:partner|vendor|sponsor|partnership)\s+(?:named|called|for|with)?\s*(.+?)(?:\s+(?:email|phone|next step|milestone)\b|[,.;]|$)/i
  );

  return cleanVoiceText(match?.[1]).replace(/^(named|called|for|with)\s+/i, "");
}

function createPartnerConversation(command) {
  const email = extractEmail(command);

  return {
    type: "partner",
    name: extractPartnerName(command),
    email: email || null,
    phone: extractPhone(command),
    nextStep: null,
    asking: "",
  };
}

function getNextPartnerStep(conversation) {
  if (!conversation.name) {
    return { asking: "name", question: "What is the partner name?" };
  }

  if (conversation.email === undefined || conversation.email === null) {
    return { asking: "email", question: "What email should I save for them? You can say no email." };
  }

  if (conversation.nextStep === undefined || conversation.nextStep === null) {
    return { asking: "nextStep", question: "What is the next step with this partner? You can say no next step." };
  }

  return null;
}

function updatePartnerConversation(conversation, reply) {
  const nextConversation = { ...conversation };
  const cleanReply = cleanVoiceText(reply);

  if (conversation.asking === "name") {
    nextConversation.name = cleanReply;
  }

  if (conversation.asking === "email") {
    nextConversation.email = noOptionalValue(cleanReply) ? "" : extractEmail(cleanReply) || cleanReply;
  }

  if (conversation.asking === "nextStep") {
    nextConversation.nextStep = noOptionalValue(cleanReply) ? "" : cleanReply;
  }

  const nextStep = getNextPartnerStep(nextConversation);
  return nextStep
    ? {
        conversation: { ...nextConversation, asking: nextStep.asking },
        question: nextStep.question,
      }
    : { conversation: nextConversation, question: "" };
}

function buildPartnerConversationCommand(conversation) {
  return [
    `Create a partner named "${conversation.name}".`,
    conversation.email ? `Email: ${conversation.email}.` : "No email.",
    conversation.phone ? `Phone: ${conversation.phone}.` : "",
    conversation.nextStep ? `Next step: ${conversation.nextStep}.` : "No next step.",
  ]
    .filter(Boolean)
    .join(" ");
}

function conversationNeedsConfirmation(conversation) {
  return ["meeting", "reminder", "task", "operation", "partner"].includes(
    conversation?.type
  );
}

function confirmationQuestionForConversation(conversation) {
  if (conversation.type === "meeting") {
    const time =
      buildResolvedTimePhrase(conversation.timeDetails) ||
      conversation.time ||
      "the selected time";
    const reminderLead =
      cleanVoiceText(conversation.reminderLead) ||
      buildReminderLeadFromDetails(conversation.reminderTimeDetails);
    const reminderText = conversation.wantsReminder
      ? `with a reminder ${reminderLead}`
      : "with no reminder";

    return `Just to confirm: create "${conversation.title}" for ${time}, ${reminderText}. Should I create it?`;
  }

  if (conversation.type === "reminder") {
    const time =
      buildResolvedTimePhrase(conversation.timeDetails) ||
      conversation.time ||
      "the selected time";

    return `Just to confirm: remind you about "${conversation.title}" at ${time}. Should I create it?`;
  }

  if (conversation.type === "task") {
    const deadline = conversation.deadline || "no deadline";
    const owner = conversation.owner || "no owner";
    const detail = conversation.detail || "no extra detail";

    return `Just to confirm: create task "${conversation.title}", due ${deadline}, priority ${conversation.priority || "Medium"}, owner ${owner}, with ${detail}. Should I create it?`;
  }

  if (conversation.type === "operation") {
    const due = conversation.due || "no deadline";

    return `Just to confirm: create operation alert "${conversation.title}", severity ${conversation.severity || "Medium"}, due ${due}. Should I create it?`;
  }

  if (conversation.type === "partner") {
    const email = conversation.email || "no email";
    const nextStep = conversation.nextStep || "no next step";

    return `Just to confirm: create partner "${conversation.name}", email ${email}, next step ${nextStep}. Should I create it?`;
  }

  return "Just to confirm, should I create it?";
}

function hasSoftTranscriptionIntent(command) {
  return /\b(transcribe|transcription|record\s+(?:this\s+)?meeting|take\s+notes)\b/i.test(command);
}

function isSensitiveCommand(command) {
  return /\b(send|delete|archive|remove|deactivate|approve|reject)\b/i.test(
    command
  );
}

function isPositiveReply(text) {
  return /\b(yes|yeah|yep|confirm|approved|go ahead|continue|do it)\b/i.test(
    text
  );
}

function isNegativeReply(text) {
  return /\b(no|cancel|stop|never mind|don't|do not)\b/i.test(text);
}

function isGreeting(text) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)[.!?]*$/i.test(
    cleanVoiceText(text)
  );
}

function getNavigationIntent(command) {
  if (!/\b(open|go to|show|view)\b/i.test(command)) {
    return null;
  }

  if (/\b(assistant|voice|home)\b/i.test(command)) return "assistant";
  if (/\bdashboard\b/i.test(command)) return "dashboard";
  if (/\bcalendar|schedule\b/i.test(command)) return "calendar";
  if (/\bmeetings?\b/i.test(command)) return "meetings";
  if (/\btasks?|kanban|board\b/i.test(command)) return "tasks";
  if (/\bapprovals?|approve|review queue\b/i.test(command)) return "approvals";
  if (/\b(transcripts?|transcrib)/i.test(command)) return "transcripts";
  if (/\bprojects?\b/i.test(command)) return "projects";
  if (/\bpartners?|partnerships?|vendors?\b/i.test(command)) return "partners";
  if (/\bemails?|gmail|inbox\b/i.test(command)) return "emails";
  if (/\boperations?|actions?|repairs?|issues?|queue\b/i.test(command)) {
    return "operations";
  }
  if (/\bsettings?|users?|access\b/i.test(command)) return "settings";

  return null;
}

function navigationLabel(view) {
  const labels = {
    assistant: "the assistant",
    dashboard: "the dashboard",
    calendar: "calendar",
    meetings: "meetings",
    tasks: "tasks",
    approvals: "approvals",
    transcripts: "transcripts",
    projects: "projects",
    partners: "partners",
    emails: "emails",
    operations: "operations",
    settings: "settings",
  };

  return labels[view] || view;
}

function normalizeSpokenCommand(text) {
  return cleanVoiceText(text)
    .replace(/\b(ready|okay|ok)\.?\s*(i\s+am|i'm)?\s*listening\.?/gi, " ")
    .replace(/\b(i\s+am|i'm)\s+listening\.?/gi, " ")
    .replace(/\bvoice\s+agent\s+ready\.?/gi, " ")
    .replace(/\bpress\s+start\s+voice\s+agent\s+and\s+speak\s+naturally\b/gi, " ")
    .replace(
      /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/gi,
      " "
    )
    .replace(/[^a-z0-9:,\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCasualGreetingOnly(originalText, normalizedText) {
  return (
    isGreeting(originalText) ||
    !normalizedText
  );
}

function missingFieldQuestion(action) {
  const missing = action.missing || [];
  const type = action.type;

  if (missing.includes("reminder_time")) {
    return "What time should I use for that reminder?";
  }

  if (missing.includes("gmail_connection")) {
    return "Gmail is not connected yet. Should I create a standalone draft instead?";
  }

  if (missing.includes("source_email")) {
    return action.message || "Which email should I use for that draft?";
  }

  if (missing.includes("title")) {
    return `What should I call this ${actionTypeLabel(type).toLowerCase()}?`;
  }

  if (missing.includes("transcript")) {
    return "Which saved transcript should I use?";
  }

  return `I need a little more detail for ${action.title || actionTypeLabel(type)}. What should I use?`;
}

function getFollowUpQuestion(result, originalCommand) {
  const needsClarification = (result.actions || []).find(
    (action) => action.status === "needs_clarification"
  );

  if (needsClarification) {
    return missingFieldQuestion(needsClarification);
  }

  if (needsMeetingDateTime(originalCommand)) {
    return "What day and time should I schedule that meeting?";
  }

  return "";
}

function buildPendingApprovals(actions) {
  return (actions || [])
    .filter((action) => {
      if (action.type === "email_draft" && action.status === "drafted") {
        return true;
      }

      return action.status === "needs_clarification";
    })
    .map((action) => ({
      title: action.title || actionTypeLabel(action.type),
      detail:
        action.type === "email_draft"
          ? "Review before sending. The voice agent will not send it automatically."
          : action.message || "Needs more detail before completion.",
    }));
}

function createAssistantMessage(text, result = null) {
  const actions = result?.actions || [];

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text,
    actions,
    pendingApprovals: buildPendingApprovals(actions),
  };
}

function createUserMessage(text) {
  return {
    id: crypto.randomUUID(),
    role: "user",
    text,
    actions: [],
    pendingApprovals: [],
  };
}

function withUnderstood(summary) {
  const cleanSummary = cleanVoiceText(summary || "Done.");

  if (/^understood\b/i.test(cleanSummary)) {
    return cleanSummary;
  }

  return `Understood. ${cleanSummary.replace(/^done\.\s*/i, "")}`;
}

function friendlyCommandError(data) {
  const detail = cleanVoiceText(data?.summary || data?.error || "");

  if (/503|high demand|unavailable|quota|billing/i.test(detail)) {
    return "The AI model is busy right now. I am ready to try again in a moment.";
  }

  return detail || "I could not complete that command.";
}

export default function useVoiceAgent({
  onAction,
  onNavigate,
  onResult,
  onStartTranscribing,
} = {}) {
  const [messages, setMessages] = useState([
    createAssistantMessage("Ready."),
  ]);
  const [status, setStatus] = useState("ready");
  const [isListening, setIsListening] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [typedReply, setTypedReply] = useState("");
  const [pendingConversation, setPendingConversation] = useState(null);
  const [pendingFollowUp, setPendingFollowUp] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const mediaStreamRef = useRef(null);
  const socketRef = useRef(null);
  const speechAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const gainRef = useRef(null);
  const voiceFinalRef = useRef("");
  const voiceInterimRef = useRef("");
  const silenceTimerRef = useRef(null);
  const runCommandRef = useRef(null);
  const startListeningRef = useRef(null);
  const pendingConversationRef = useRef(null);
  const pendingFollowUpRef = useRef(null);
  const pendingConfirmationRef = useRef(null);
  const continuousModeRef = useRef(false);

  const hasPendingQuestion = Boolean(
    pendingConversation || pendingFollowUp || pendingConfirmation
  );

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    pendingConversationRef.current = pendingConversation;
  }, [pendingConversation]);

  useEffect(() => {
    pendingFollowUpRef.current = pendingFollowUp;
  }, [pendingFollowUp]);

  useEffect(() => {
    pendingConfirmationRef.current = pendingConfirmation;
  }, [pendingConfirmation]);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
  }, [continuousMode]);

  function appendMessage(message) {
    setMessages((previous) => [...previous.slice(-9), message]);
  }

  function getVisibleVoiceCommand() {
    return [voiceFinalRef.current, voiceInterimRef.current]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const closeVoiceAudioGraph = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
    }

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;

    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  }, []);

  const closeVoiceResources = useCallback(() => {
    window.clearTimeout(silenceTimerRef.current);
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current = null;
    }
    closeVoiceAudioGraph();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send("stop");
      socketRef.current.close();
    } else if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      socketRef.current.close();
    }

    socketRef.current = null;
  }, [closeVoiceAudioGraph]);

  useEffect(() => {
    return () => {
      closeVoiceResources();
    };
  }, [closeVoiceResources]);

  function speakWithBrowserVoice(text, resolve) {
    if (!window.speechSynthesis || !text) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.94;
    utterance.pitch = 0.98;

    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferredVoice = voices.find((voice) =>
      /natural|aria|jenny|samantha|serena|female/i.test(voice.name)
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  }

  function speakAsync(text) {
    return new Promise((resolve) => {
      if (!text) {
        resolve();
        return;
      }

      setStatus("speaking");

      synthesizeVoiceAudio(text)
        .then((audioBlob) => {
          if (!audioBlob?.size) {
            throw new Error("Empty Deepgram audio response.");
          }

          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          speechAudioRef.current = audio;

          const cleanup = () => {
            URL.revokeObjectURL(audioUrl);
            if (speechAudioRef.current === audio) {
              speechAudioRef.current = null;
            }
          };

          const finish = () => {
            cleanup();
            resolve();
          };

          audio.onended = finish;
          audio.onerror = () => {
            cleanup();
            speakWithBrowserVoice(text, resolve);
          };
          audio.play().catch(() => {
            cleanup();
            speakWithBrowserVoice(text, resolve);
          });
        })
        .catch(() => {
          speakWithBrowserVoice(text, resolve);
        });
    });
  }

  async function respond(text, result = null, options = {}) {
    const { continueListening = true } = options;

    appendMessage(createAssistantMessage(text, result));
    await speakAsync(text);
    setStatus("ready");

    if (continueListening && continuousModeRef.current) {
      window.setTimeout(() => {
        startListeningRef.current?.({ greet: false });
      }, 350);
    }
  }

  async function executeCommandText(commandToRun) {
    setIsRunning(true);
    setStatus("executing");

    try {
      if (
        commandWantsTranscription(commandToRun) &&
        isTranscriptionOnlyCommand(commandToRun)
      ) {
        const result = {
          summary: "Understood. I started live transcription.",
          actions: [
            {
              type: "transcription",
              status: "started",
              title: "Live transcription",
              data: {},
            },
          ],
        };

        onStartTranscribing?.();
        onResult?.(result);
        await respond(result.summary, result);
        return;
      }

      const data = await runAICommand(commandToRun);

      if (!data.ok) {
        await respond(friendlyCommandError(data));
        return;
      }

      const actions = data.actions || [];
      actions.forEach((action) => onAction?.(action));

      const followUpQuestion = getFollowUpQuestion(data, commandToRun);

      if (followUpQuestion) {
        setPendingFollowUp({ command: commandToRun, question: followUpQuestion });
      }

      const responseText = followUpQuestion || withUnderstood(data.summary);
      const result = {
        summary: responseText,
        actions,
      };

      onResult?.(result);
      await respond(responseText, result);
    } catch {
      await respond("I could not connect to the command engine.");
    } finally {
      setIsRunning(false);
    }
  }

  async function executeScheduleCommandText(commandToRun) {
    setIsRunning(true);
    setStatus("executing");

    try {
      const data = await runScheduleAssistant(commandToRun);

      if (!data.ok) {
        await respond(
          data.summary ||
            data.error ||
            "I need a little more calendar detail before I can schedule that."
        );
        return;
      }

      const actions = [
        data.event
          ? {
              type: "calendar_event",
              status: "created",
              title: data.event.title || "Calendar Event",
              data: { event: data.event },
            }
          : null,
        data.meeting
          ? {
              type: "meeting",
              status: "created",
              title: data.meeting.title || data.event?.title || "Meeting",
              data: {
                event: data.event,
                meeting: data.meeting,
                alarm: data.alarm,
              },
            }
          : null,
        data.alarm && !data.meeting
          ? {
              type: "alarm",
              status: "created",
              title: data.alarm.title || "Reminder",
              data: { alarm: data.alarm },
            }
          : null,
      ].filter(Boolean);

      actions.forEach((action) => onAction?.(action));

      const responseText = withUnderstood(data.summary || "Calendar event scheduled.");
      const result = {
        summary: responseText,
        actions,
      };

      onResult?.(result);
      await respond(responseText, result);
    } catch {
      await respond("I could not connect to the calendar assistant.");
    } finally {
      setIsRunning(false);
    }
  }

  function updatePendingConversation(conversation, reply) {
    if (conversation.asking === "confirm" && conversation.type !== "transcription") {
      if (isNegativeReply(reply)) {
        return {
          conversation,
          question: "",
          cancelled: true,
        };
      }

      if (isPositiveReply(reply)) {
        return {
          conversation: { ...conversation, confirmed: true },
          question: "",
        };
      }

      return {
        conversation,
        question: "Please say yes to create it, or no to cancel.",
      };
    }

    if (conversation.type === "meeting") {
      return updateMeetingConversation(conversation, reply);
    }

    if (conversation.type === "reminder") {
      return updateReminderConversation(conversation, reply);
    }

    if (conversation.type === "task") {
      return updateTaskConversation(conversation, reply);
    }

    if (conversation.type === "operation") {
      return updateOperationConversation(conversation, reply);
    }

    if (conversation.type === "partner") {
      return updatePartnerConversation(conversation, reply);
    }

    if (conversation.type === "transcription") {
      if (isNegativeReply(reply)) {
        return {
          conversation,
          question: "",
          cancelled: true,
        };
      }

      if (isPositiveReply(reply) || /\b(start|begin|yes|now)\b/i.test(reply)) {
        return {
          conversation,
          question: "",
          command: "start live transcription",
        };
      }

      return {
        conversation,
        question: "Should I start live transcription now?",
      };
    }

    return { conversation, question: "" };
  }

  function commandForConversation(conversation) {
    if (conversation.type === "meeting") {
      return buildMeetingConversationCommand(conversation);
    }

    if (conversation.type === "reminder") {
      return buildReminderConversationCommand(conversation);
    }

    if (conversation.type === "task") {
      return buildTaskConversationCommand(conversation);
    }

    if (conversation.type === "operation") {
      return buildOperationConversationCommand(conversation);
    }

    if (conversation.type === "partner") {
      return buildPartnerConversationCommand(conversation);
    }

    return "";
  }

  async function continuePendingConversation(reply) {
    const conversation = pendingConversationRef.current;

    if (!conversation) {
      return false;
    }

    const update = updatePendingConversation(conversation, reply);

    if (update.question) {
      setPendingConversation(update.conversation);
      await respond(update.question);
      return true;
    }

    setPendingConversation(null);

    if (update.cancelled) {
      await respond("Okay. I cancelled that.");
      return true;
    }

    if (
      conversationNeedsConfirmation(update.conversation) &&
      !update.conversation.confirmed
    ) {
      const confirmationConversation = {
        ...update.conversation,
        asking: "confirm",
      };

      setPendingConversation(confirmationConversation);
      await respond(confirmationQuestionForConversation(confirmationConversation));
      return true;
    }

    await executeCommandText(update.command || commandForConversation(update.conversation));
    return true;
  }

  function createConversationForCommand(command, normalizedCommand) {
    if (hasMeetingSchedulingIntent(normalizedCommand)) {
      return {
        conversation: createMeetingConversation(command),
        getNextStep: getNextMeetingStep,
      };
    }

    if (hasStandaloneReminderIntent(normalizedCommand)) {
      return {
        conversation: createReminderConversation(command),
        getNextStep: getNextReminderStep,
      };
    }

    if (hasTaskIntent(normalizedCommand)) {
      return {
        conversation: createTaskConversation(command),
        getNextStep: getNextTaskStep,
      };
    }

    if (hasOperationIntent(normalizedCommand)) {
      return {
        conversation: createOperationConversation(command),
        getNextStep: getNextOperationStep,
      };
    }

    if (hasPartnerIntent(normalizedCommand)) {
      return {
        conversation: createPartnerConversation(command),
        getNextStep: getNextPartnerStep,
      };
    }

    if (
      hasSoftTranscriptionIntent(normalizedCommand) &&
      !commandWantsTranscription(normalizedCommand)
    ) {
      return {
        conversation: { type: "transcription", asking: "confirm" },
        getNextStep: () => ({
          asking: "confirm",
          question: "Should I start live transcription now?",
        }),
      };
    }

    return null;
  }

  async function startConversation(command, normalizedCommand) {
    const setup = createConversationForCommand(command, normalizedCommand);

    if (!setup) {
      return false;
    }

    const { conversation, getNextStep } = setup;
    const nextStep = getNextStep(conversation);

    if (nextStep) {
      setPendingConversation({ ...conversation, asking: nextStep.asking });
      await respond(nextStep.question);
      return true;
    }

    setPendingConversation(null);
    if (conversationNeedsConfirmation(conversation)) {
      const confirmationConversation = {
        ...conversation,
        asking: "confirm",
      };

      setPendingConversation(confirmationConversation);
      await respond(confirmationQuestionForConversation(confirmationConversation));
      return true;
    }

    await executeCommandText(commandForConversation(conversation));
    return true;
  }

  async function runCommand(commandText) {
    const heardCommand = cleanVoiceText(commandText);
    const finalCommand = normalizeSpokenCommand(heardCommand);

    if (!heardCommand) {
      await respond("I did not catch a command. Please try again.");
      return;
    }

    appendMessage(createUserMessage(heardCommand));
    setLiveTranscript("");
    setTypedReply("");

    if (await continuePendingConversation(heardCommand)) {
      return;
    }

    if (isCasualGreetingOnly(heardCommand, finalCommand)) {
      await respond("Hi. I am listening and ready for your next command.");
      return;
    }

    const navigationIntent = getNavigationIntent(finalCommand);

    if (navigationIntent) {
      onNavigate?.(navigationIntent);
      await respond(`Opening ${navigationLabel(navigationIntent)}.`);
      return;
    }

    if (await startConversation(heardCommand, finalCommand)) {
      return;
    }

    if (hasCalendarSchedulingIntent(finalCommand)) {
      await executeScheduleCommandText(heardCommand);
      return;
    }

    const pendingConfirmationValue = pendingConfirmationRef.current;
    const pendingFollowUpValue = pendingFollowUpRef.current;

    if (pendingConfirmationValue) {
      if (isNegativeReply(finalCommand)) {
        setPendingConfirmation(null);
        await respond("Cancelled. I will not take that action.");
        return;
      }

      if (!isPositiveReply(finalCommand)) {
        await respond("Please say yes to confirm, or no to cancel.");
        return;
      }
    } else if (isSensitiveCommand(finalCommand)) {
      const reply =
        "That may be sensitive. I will not send, delete, archive, or approve anything automatically. Should I continue with a safe draft or approval request only?";
      setPendingConfirmation({ command: finalCommand });
      await respond(reply);
      return;
    }

    if (!pendingFollowUpValue && needsMeetingDateTime(finalCommand)) {
      const reply = "What day and time should I schedule that meeting?";
      setPendingFollowUp({ command: finalCommand, question: reply });
      await respond(reply);
      return;
    }

    const commandToRun = pendingFollowUpValue
      ? `${pendingFollowUpValue.command}. ${finalCommand}`
      : pendingConfirmationValue
        ? `${pendingConfirmationValue.command}. Confirmed: create safe drafts or approval records only. Do not send, delete, archive, or approve automatically.`
        : finalCommand;

    setPendingFollowUp(null);
    setPendingConfirmation(null);
    await executeCommandText(commandToRun);
  }

  useEffect(() => {
    runCommandRef.current = runCommand;
  });

  async function finalizeListeningAndRun() {
    const spokenCommand = getVisibleVoiceCommand();
    closeVoiceResources();
    setIsListening(false);
    setStatus(spokenCommand ? "thinking" : "ready");
    voiceFinalRef.current = "";
    voiceInterimRef.current = "";

    await runCommandRef.current?.(spokenCommand);
  }

  function scheduleAutoFinalize() {
    window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      finalizeListeningAndRun();
    }, AUTO_FINALIZE_MS);
  }

  async function startListening({ greet = true } = {}) {
    if (isListening || isRunning || status === "speaking") {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
      await respond("Microphone is not available in this browser.", null, {
        continueListening: false,
      });
      return;
    }

    try {
      voiceFinalRef.current = "";
      voiceInterimRef.current = "";
      setLiveTranscript("");
      setIsListening(true);
      setStatus("listening");

      if (greet) {
        appendMessage(createAssistantMessage("Listening."));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const audioContext = new AudioContextClass();
      await audioContext.resume();
      const sessionData = await createTranscriptionSession(audioContext.sampleRate);

      if (!sessionData.ok || !sessionData.ticket) {
        closeVoiceResources();
        setIsListening(false);
        setStatus("ready");
        await respond(
          sessionData.error || "Could not start the voice agent session.",
          null,
          { continueListening: false }
        );
        return;
      }

      const socket = new WebSocket(
        `${TRANSCRIPTION_WS_URL}?ticket=${encodeURIComponent(sessionData.ticket)}`
      );

      socketRef.current = socket;
      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;

      socket.onopen = () => {
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const gain = audioContext.createGain();

        gain.gain.value = 0;
        processor.onaudioprocess = (event) => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              float32ToInt16Buffer(event.inputBuffer.getChannelData(0))
            );
          }
        };

        source.connect(processor);
        processor.connect(gain);
        gain.connect(audioContext.destination);

        sourceRef.current = source;
        processorRef.current = processor;
        gainRef.current = gain;
      };

      socket.onmessage = (event) => {
        const message = parseSocketMessage(event);

        if (message.type === "transcript") {
          const text = cleanVoiceText(message.text);

          if (!text) {
            return;
          }

          if (message.isFinal) {
            voiceFinalRef.current = [voiceFinalRef.current, text]
              .filter(Boolean)
              .join(" ");
            voiceInterimRef.current = "";
          } else {
            voiceInterimRef.current = text;
          }

          setLiveTranscript(getVisibleVoiceCommand());
          scheduleAutoFinalize();
        }

        if (message.type === "error") {
          appendMessage(
            createAssistantMessage(message.error || "Voice agent stream failed.")
          );
        }
      };

      socket.onerror = () => {
        appendMessage(createAssistantMessage("Voice connection failed. Please try again."));
        setStatus("ready");
      };

      socket.onclose = () => {
        closeVoiceAudioGraph();
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        socketRef.current = null;
        setIsListening(false);
      };
    } catch (error) {
      closeVoiceResources();
      setIsListening(false);
      setStatus("ready");
      const message =
        error?.name === "NotAllowedError" || error?.name === "SecurityError"
          ? "Microphone access is blocked. Allow microphone access and try again."
          : "Could not start the voice agent. Check microphone permission.";
      await respond(message, null, { continueListening: false });
    }
  }

  useEffect(() => {
    startListeningRef.current = startListening;
  });

  async function stopListening() {
    window.clearTimeout(silenceTimerRef.current);
    closeVoiceResources();
    setIsListening(false);
    setStatus("ready");
  }

  async function toggleListening() {
    if (isListening) {
      await stopListening();
      return;
    }

    await startListening();
  }

  function submitTypedReply() {
    runCommand(typedReply);
  }

  return {
    messages,
    status,
    isListening,
    isRunning,
    liveTranscript,
    typedReply,
    setTypedReply,
    continuousMode,
    setContinuousMode,
    hasPendingQuestion,
    lastAssistantMessage,
    toggleListening,
    submitTypedReply,
  };
}
