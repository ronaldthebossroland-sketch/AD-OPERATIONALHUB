import { useEffect } from "react";
import { Loader2, Mic, Square } from "lucide-react";

import useVoiceAgent from "../../hooks/useVoiceAgent";
import { scheduleDeviceReminder } from "../../services/mobileCapabilities";

function VoiceIcon({ isListening, isRunning, status }) {
  if (isRunning || status === "speaking") {
    return <Loader2 className="h-12 w-12 animate-spin" />;
  }

  if (isListening) {
    return <Square className="h-12 w-12" />;
  }

  return <Mic className="h-12 w-12" />;
}

function buttonLabel({ isListening, isRunning, status }) {
  if (status === "speaking") {
    return "Speaking";
  }

  if (isRunning || status === "thinking" || status === "executing") {
    return "Thinking";
  }

  if (isListening) {
    return "Listening";
  }

  return "Talk";
}

export default function VoiceHomeView({
  onNavigate,
  onStartTranscribing,
  setAlerts,
  setMeetings,
  setOperations,
  setReminders,
}) {
  function applyVoiceAction(action) {
    const data = action.data || {};

    if (action.type === "meeting" && data.meeting) {
      setMeetings?.((previous) => [data.meeting, ...previous]);

      if (data.alarm) {
        setReminders?.((previous) => [data.alarm, ...previous]);
        scheduleDeviceReminder(data.alarm, { setNativeAlarm: true }).catch(
          (error) => {
            console.warn("Could not schedule device reminder:", error);
          }
        );
      }
    }

    if (action.type === "alarm" && data.alarm) {
      setReminders?.((previous) => [data.alarm, ...previous]);
      scheduleDeviceReminder(data.alarm, { setNativeAlarm: true }).catch(
        (error) => {
          console.warn("Could not schedule device reminder:", error);
        }
      );
    }

    if (action.type === "operation_alert") {
      if (data.alert) {
        setAlerts?.((previous) => [data.alert, ...previous]);
      }

      if (data.operation) {
        setOperations?.((previous) => [data.operation, ...previous]);
      }
    }

    if (action.type === "task" && data.operation) {
      setOperations?.((previous) => [data.operation, ...previous]);
    }
  }

  const {
    continuousMode,
    isListening,
    isRunning,
    setContinuousMode,
    status,
    toggleListening,
  } = useVoiceAgent({
    onAction: applyVoiceAction,
    onNavigate,
    onResult: () => {},
    onStartTranscribing,
  });

  useEffect(() => {
    if (!continuousMode) {
      setContinuousMode(true);
    }
  }, [continuousMode, setContinuousMode]);

  const disabled = isRunning || status === "speaking";

  return (
    <div className="voice-home grid min-h-[100dvh] place-items-center">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        className={`voice-home__button ${isListening ? "is-listening" : ""}`}
        aria-label={isListening ? "Stop voice agent" : "Start voice agent"}
      >
        <VoiceIcon
          isListening={isListening}
          isRunning={isRunning}
          status={status}
        />
        <span>{buttonLabel({ isListening, isRunning, status })}</span>
      </button>
    </div>
  );
}
