import { Bell } from "lucide-react";

import useSmartAlarms from "../../hooks/useSmartAlarms";
import AlarmModal from "./AlarmModal";
import { Button } from "../ui/button";

export default function NotificationBell({
  alerts = [],
  meetings = [],
  reminders = [],
  operations = [],
  onMarkDone,
  onSnooze,
  onReschedule,
  onOpenRelated,
  onTrigger,
}) {
  const {
    activeNotification,
    alertCount,
    openFirst,
    closeActive,
    markDone,
    snooze,
    reschedule,
    openRelated,
  } = useSmartAlarms({
    alerts,
    meetings,
    reminders,
    operations,
    onMarkDone,
    onSnooze,
    onReschedule,
    onOpenRelated,
    onTrigger,
  });

  return (
    <>
      <Button
        onClick={openFirst}
        variant="outline"
        className="relative min-w-0 rounded-2xl bg-white px-3 py-3 text-xs sm:text-sm"
        title="Mission Control alerts"
      >
        <Bell className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">Alerts</span>
        {alertCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
            {alertCount}
          </span>
        )}
      </Button>

      <AlarmModal
        notification={activeNotification}
        onClose={closeActive}
        onMarkDone={markDone}
        onSnooze={snooze}
        onReschedule={reschedule}
        onOpenRelated={openRelated}
      />
    </>
  );
}
