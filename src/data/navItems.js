import {
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileText,
  Mail,
  Mic,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export const navItems = [
  { key: "settings", label: "Settings", icon: Settings, adminOnly: true },
  { key: "assistant", label: "Assistant", icon: Mic },
  { key: "dashboard", label: "Dashboard", icon: Sparkles },
  { key: "calendar", label: "Calendar", icon: CalendarClock },
  { key: "meetings", label: "Meetings", icon: CalendarDays },
  { key: "tasks", label: "Tasks", icon: ClipboardList },
  { key: "approvals", label: "Approvals", icon: ShieldCheck },
  { key: "transcripts", label: "Transcripts", icon: FileText },
  { key: "projects", label: "Projects", icon: ClipboardList },
  { key: "partners", label: "Partners", icon: Users },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "operations", label: "Operations", icon: Building2 },
];
