export const assistantPrompts = [
  "Brief me for today",
  "What needs attention?",
  "Schedule a meeting",
  "Create a task",
  "Summarize notes",
  "Prepare my next move",
];

export const initialTasks = [
  {
    id: "task-1",
    title: "Confirm leadership briefing points",
    detail: "Prepare the three decisions needed before tomorrow morning.",
    priority: "High",
    status: "To do",
    due: "Today, 6:00 PM",
  },
  {
    id: "task-2",
    title: "Review follow-up actions",
    detail: "Check owners for pending ministry operations.",
    priority: "Medium",
    status: "In progress",
    due: "Tomorrow",
  },
];

export const initialMeetings = [
  {
    id: "meeting-1",
    title: "Leadership sync",
    date: "Today",
    time: "4:30 PM",
    attendees: "Executive team",
    briefing: "Decisions, risks, and follow-up owners.",
    reminder: "15 minutes before",
  },
];

export const initialDocuments = [
  {
    id: "doc-1",
    title: "Service planning notes",
    type: "Briefing note",
    updatedAt: "Today",
    content:
      "Media timeline, venue checklist, volunteer coverage, and budget approvals need review before the next leadership sync.",
    summary:
      "Planning is mostly stable. Media timeline and budget approval need confirmation.",
  },
];

export const initialReminders = [
  {
    id: "reminder-1",
    title: "Prepare leadership sync",
    due: "Today, 4:15 PM",
  },
];

export const quickActions = [
  {
    title: "Brief me",
    prompt: "Brief me for today",
    icon: "flash-outline",
  },
  {
    title: "New meeting",
    prompt: "Schedule a meeting",
    icon: "calendar-outline",
  },
  {
    title: "New task",
    prompt: "Create a task",
    icon: "checkbox-outline",
  },
  {
    title: "Summarize",
    prompt: "Summarize notes",
    icon: "document-text-outline",
  },
];

export const settingsItems = [
  {
    title: "Profile",
    description: "Your EVA account",
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
  {
    title: "Preview mode",
    description: "This device workspace",
    icon: "phone-portrait-outline",
  },
];
