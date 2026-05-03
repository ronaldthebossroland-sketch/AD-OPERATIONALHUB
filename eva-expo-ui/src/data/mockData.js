export const prompts = [
  "Brief me for today",
  "What needs attention?",
  "Schedule a meeting",
  "Summarize last transcript",
  "Prepare my next move",
];

export const chat = [
  {
    id: "1",
    role: "eva",
    text: "Good evening, Ronald. Your calendar is clear after 4:30 PM, and one operation needs attention.",
  },
  {
    id: "2",
    role: "user",
    text: "Prepare my next move.",
  },
  {
    id: "3",
    role: "eva",
    text: "I would start with the donor follow-up, then confirm tomorrow's leadership review.",
  },
];

export const meetings = [
  {
    id: "m1",
    time: "09:30",
    title: "Leadership sync",
    meta: "Strategy room",
    reminder: "10 min before",
  },
  {
    id: "m2",
    time: "13:00",
    title: "Operations review",
    meta: "Finance and facilities",
    reminder: "30 min before",
  },
  {
    id: "m3",
    time: "16:30",
    title: "Pastoral briefing",
    meta: "Decision prep",
    reminder: "15 min before",
  },
];

export const operations = [
  {
    id: "o1",
    status: "high",
    title: "Vendor approval pending",
    meta: "Budget exposure requires review before noon.",
  },
  {
    id: "o2",
    status: "attention",
    title: "Follow-up list is growing",
    meta: "Eight items need owner confirmation.",
  },
  {
    id: "o3",
    status: "stable",
    title: "Weekend service plan",
    meta: "Staffing and room preparation are on track.",
  },
];

export const transcriptActions = [
  "Confirm media team timeline",
  "Send venue checklist",
  "Move finance review to operations",
];

export const settingsItems = [
  {
    title: "Profile",
    description: "Ronald Roland",
    icon: "person-circle-outline",
  },
  {
    title: "Notifications",
    description: "Critical alerts and reminders",
    icon: "notifications-outline",
  },
  {
    title: "Voice settings",
    description: "Soothing voice, conversational follow-ups",
    icon: "mic-outline",
  },
  {
    title: "AI behavior",
    description: "Executive, concise, proactive",
    icon: "sparkles-outline",
  },
];
