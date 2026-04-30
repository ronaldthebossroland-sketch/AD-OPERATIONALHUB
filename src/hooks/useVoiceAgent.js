import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createTranscriptionSession,
  runAICommand,
  TRANSCRIPTION_WS_URL,
} from "../services/api";

const AUTO_FINALIZE_MS = 1800;

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
  onResult,
  onStartTranscribing,
} = {}) {
  const [messages, setMessages] = useState([
    createAssistantMessage("Voice agent ready. Press Start Voice Agent and speak naturally."),
  ]);
  const [status, setStatus] = useState("ready");
  const [isListening, setIsListening] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [typedReply, setTypedReply] = useState("");
  const [pendingFollowUp, setPendingFollowUp] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const mediaStreamRef = useRef(null);
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const gainRef = useRef(null);
  const voiceFinalRef = useRef("");
  const voiceInterimRef = useRef("");
  const silenceTimerRef = useRef(null);
  const runCommandRef = useRef(null);
  const startListeningRef = useRef(null);
  const pendingFollowUpRef = useRef(null);
  const pendingConfirmationRef = useRef(null);
  const continuousModeRef = useRef(false);

  const hasPendingQuestion = Boolean(pendingFollowUp || pendingConfirmation);

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

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

  function speakAsync(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !text) {
        resolve();
        return;
      }

      setStatus("speaking");
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }

  async function respond(text, result = null) {
    appendMessage(createAssistantMessage(text, result));
    await speakAsync(text);
    setStatus("ready");

    if (continuousModeRef.current) {
      window.setTimeout(() => {
        startListeningRef.current?.({ greet: false });
      }, 350);
    }
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

    if (isCasualGreetingOnly(heardCommand, finalCommand)) {
      await respond("Hi. I am listening and ready for your next command.");
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
      await respond("Microphone voice command is not supported in this browser.");
      return;
    }

    try {
      voiceFinalRef.current = "";
      voiceInterimRef.current = "";
      setLiveTranscript("");
      setIsListening(true);
      setStatus("listening");

      if (greet) {
        appendMessage(createAssistantMessage("Ready. I am listening."));
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
        await respond(sessionData.error || "Could not start the voice agent session.");
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
        appendMessage(createAssistantMessage("Voice agent connection failed."));
      };

      socket.onclose = () => {
        closeVoiceAudioGraph();
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        socketRef.current = null;
        setIsListening(false);
      };
    } catch {
      closeVoiceResources();
      setIsListening(false);
      setStatus("ready");
      await respond("Could not start the voice agent. Check microphone permission.");
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
