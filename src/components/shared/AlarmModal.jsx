import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Clock3, ExternalLink, Volume2, X } from "lucide-react";

import { playCalmVoiceAlert, stopBrowserSpeech } from "../../services/voicePlayback";
import { Button } from "../ui/button";

function playAlarmTone(stage) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const masterGain = audioContext.createGain();
  const notes = stage === "overdue" ? [392, 523.25, 659.25] : [440, 554.37, 659.25];
  const startedAt = audioContext.currentTime + 0.03;

  masterGain.gain.value = 0.0001;
  masterGain.connect(audioContext.destination);

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const noteStart = startedAt + index * 0.18;
    const noteEnd = noteStart + 0.42;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(stage === "overdue" ? 0.06 : 0.045, noteStart + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd);
  });

  window.setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 1200);
}

function toDatetimeLocalValue(date) {
  if (!date) {
    return "";
  }

  const nextDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return nextDate.toISOString().slice(0, 16);
}

export default function AlarmModal({
  notification,
  onClose,
  onMarkDone,
  onSnooze,
  onReschedule,
  onOpenRelated,
}) {
  const rescheduleValueRef = useRef("");
  const defaultRescheduleValue = useMemo(() => {
    if (!notification) {
      return "";
    }

    if (!notification.dueAt) {
      return "";
    }

    const defaultDate = new Date(notification.dueAt.getTime() + 10 * 60_000);

    return toDatetimeLocalValue(defaultDate);
  }, [notification]);

  useEffect(() => {
    if (!notification) {
      return;
    }

    let stopVoice = null;
    let isMounted = true;

    playAlarmTone(notification.stage);
    playCalmVoiceAlert(notification.speakText).then((stop) => {
      if (!isMounted) {
        stop?.();
        return;
      }

      stopVoice = stop;
    });

    return () => {
      isMounted = false;
      stopVoice?.();
      stopBrowserSpeech();
    };
  }, [notification]);

  const snoozeOptions = useMemo(
    () => (notification?.snoozeOptions || []).filter((option) => option.minutes),
    [notification]
  );
  const canReschedule =
    notification?.kind === "alarm" &&
    (notification?.snoozeOptions || []).some((option) => option.mode === "reschedule");

  if (!notification) {
    return null;
  }

  const isHighRisk =
    notification.highRisk ||
    notification.kind === "alert" ||
    notification.kind === "operation";
  const Icon = isHighRisk ? AlertTriangle : Clock3;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                  Executive Reminder
                </p>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
                  {notification.stageLabel}
                </span>
                {notification.highRisk && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                    High Risk
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {notification.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                {notification.message}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close alert"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-700">
            <Volume2 className="h-4 w-4" />
            Spoken briefing
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {notification.speakText}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {snoozeOptions.map((option) => (
              <Button
                key={option.minutes}
                onClick={() => onSnooze(notification, option.minutes)}
                className="rounded-2xl"
              >
                {option.label}
              </Button>
            ))}
            <Button
              onClick={() => onMarkDone(notification)}
              variant="outline"
              className="rounded-2xl bg-white"
            >
              Mark Done
            </Button>
            <Button
              onClick={() => onOpenRelated(notification)}
              variant="outline"
              className="rounded-2xl bg-white"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Related Record
            </Button>
          </div>

          {canReschedule && (
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-3 sm:flex-row">
              <input
                type="datetime-local"
                key={`${notification.id}-${defaultRescheduleValue}`}
                defaultValue={defaultRescheduleValue}
                onChange={(event) => {
                  rescheduleValueRef.current = event.target.value;
                }}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <Button
                onClick={() =>
                  onReschedule(
                    notification,
                    rescheduleValueRef.current || defaultRescheduleValue
                  )
                }
                variant="outline"
                className="rounded-2xl bg-white"
              >
                Reschedule
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
