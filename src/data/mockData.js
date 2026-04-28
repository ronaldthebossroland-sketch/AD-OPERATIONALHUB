import {
  Building2,
  CalendarDays,
  ClipboardList,
  Mail,
  Settings,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";

export const initialMeetings = [
  {
    id: 1,
    title: "Finance Review with Accounts Team",
    time: "10:30 AM",
    duration: "45 mins",
    location: "Conference Room A",
    briefing:
      "Review spending variance, vendor price increases, and pending approvals for outreach logistics.",
    risk: "Budget variance flagged",
    attendees: ["Finance Lead", "Procurement", "Executive Assistant"],
  },
  {
    id: 2,
    title: "Partnership Managers Check-in",
    time: "12:00 PM",
    duration: "1 hr",
    location: "Zoom",
    briefing:
      "Discuss partner follow-ups, top contributors, pending appreciation messages, and upcoming visitation plan.",
    risk: "3 follow-ups overdue",
    attendees: ["Partnership Managers", "Admin Officer"],
  },
  {
    id: 3,
    title: "Property Maintenance Review",
    time: "3:00 PM",
    duration: "30 mins",
    location: "Main Office",
    briefing:
      "Confirm repair status for generator room, AC servicing schedule, and lease renewal reminders.",
    risk: "Urgent repair pending",
    attendees: ["Facility Manager", "Technician Lead"],
  },
];

export const initialAlerts = [
  {
    id: 1,
    type: "Finance",
    title: "Vendor rate increased by 18%",
    detail: "Catering logistics estimate is above normal range.",
    severity: "High",
    icon: WalletCards,
  },
  {
    id: 2,
    type: "Property",
    title: "Urgent repair: Generator room",
    detail: "Technician report indicates risk of service disruption.",
    severity: "High",
    icon: Building2,
  },
  {
    id: 3,
    type: "Email",
    title: "7 emails require executive response",
    detail: "Finance, partnership, and HR threads need attention.",
    severity: "Medium",
    icon: Mail,
  },
];

export const projects = [
  {
    id: 1,
    name: "Healing Outreach Coordination",
    progress: 82,
    lead: "Operations Lead",
    status: "At Risk",
    blocker: "Transport budget approval pending",
  },
  {
    id: 2,
    name: "Partner Visitation Program",
    progress: 64,
    lead: "Partnership Lead",
    status: "On Track",
    blocker: "Awaiting final visitation schedule",
  },
  {
    id: 3,
    name: "Property Maintenance Cycle",
    progress: 48,
    lead: "Facility Manager",
    status: "Delayed",
    blocker: "Generator repair quote not approved",
  },
];

export const partnerBriefs = [
  {
    id: 1,
    name: "Esteemed Partner A",
    lastContact: "12 days ago",
    milestone: "Consistent sponsorship for three major outreaches",
    nextStep: "Send thank-you note and confirm next engagement meeting",
  },
  {
    id: 2,
    name: "Esteemed Partner B",
    lastContact: "1 month ago",
    milestone: "Supported regional program logistics",
    nextStep: "Partnership Manager should schedule appreciation call",
  },
];

export const churchActivities = [
  {
    id: 1,
    title: "Midweek Service",
    time: "Wednesday, 5:30 PM",
    location: "Main Auditorium",
  },
  {
    id: 2,
    title: "Outreach Visitation",
    time: "Saturday, 10:00 AM",
    location: "Zone 4",
  },
  {
    id: 3,
    title: "Departmental Prayer Meeting",
    time: "Friday, 7:00 AM",
    location: "Online",
  },
];

export const initialInboxItems = [
  {
    id: 1,
    from: "Finance Team",
    subject: "Approval needed for revised logistics budget",
    urgency: "High",
    summary:
      "Finance requires approval on updated logistics line items before outreach procurement proceeds.",
    draft: "",
  },
  {
    id: 2,
    from: "Partnership Office",
    subject: "Follow-up list for top partners",
    urgency: "Medium",
    summary:
      "Three key partners need appreciation messages before next week's engagement meetings.",
    draft: "",
  },
  {
    id: 3,
    from: "Facility Manager",
    subject: "Repair quote for generator room",
    urgency: "High",
    summary:
      "Facility team submitted repair quote and recommends urgent approval to avoid disruption.",
    draft: "",
  },
];

export const navItems = [
  { key: "settings", label: "Settings", icon: Settings, adminOnly: true },
  { key: "dashboard", label: "Dashboard", icon: Sparkles },
  { key: "meetings", label: "Meetings", icon: CalendarDays },
  { key: "projects", label: "Projects", icon: ClipboardList },
  { key: "partners", label: "Partners", icon: Users },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "operations", label: "Operations", icon: Building2 },
];
