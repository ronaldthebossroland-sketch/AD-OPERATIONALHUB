import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createTranscriptionSession,
  runAICommand,
  synthesizeVoiceAudio,
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

function hasMeetingSchedulingIntent(command) {
  return (
    /\b(schedule|create|book|set up|set|arrange)\b.*\b(meeting|appointment|call)\b/i.test(
      command
    ) || /\bmeeting\s+with\b/i.test(command)
  );
}

function hasDateOrTime(text) {
  return /\b(today|tomorrow|tonight|morning|afternoon|evening|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+\w+|this\s+\w+|at\s+\d{1,2}|by\s+\d{1,2}|for\s+\d{1,2}|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i.test(
    text
  );
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
  const dateWords =
    "today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\\s+\\w+|this\\s+\\w+";
  const clock = "\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?";
  const patterns = [
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

function extractReminderLead(text) {
  const cleanTextValue = cleanVoiceText(text);

  if (/\bhalf\s+(an\s+)?hour\b/i.test(cleanTextValue)) {
    return "30 minutes before";
  }

  if (/\b(an|one)\s+hour\b/i.test(cleanTextValue)) {
    return "1 hour before";
  }

  const match = cleanTextValue.match(
    /\b(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\s*(before|early|ahead|prior)?\b/i
  );

  if (!match) {
    return "";
  }

  const unit = match[2]
    .toLowerCase()
    .replace(/^mins?$/, "minutes")
    .replace(/^hrs?$/, "hours");
  return `${match[1]} ${unit} before`;
}

function getReminderPreference(text) {
  if (isNegativeReply(text) || /\b(without|skip|no)\s+(a\s+)?(reminder|alarm|alert)\b/i.test(text)) {
    return { wantsReminder: false, lead: "" };
  }

  const lead = extractReminderLead(text);

  if (lead || /\b(yes|yeah|yep|sure|please|remind|reminder|alarm|alert)\b/i.test(text)) {
    return { wantsReminder: true, lead };
  }

  return { wantsReminder: null, lead: "" };
}

function createMeetingConversation(command) {
  const title = extractMeetingTitle(command);
  const time = hasDateOrTime(command) ? extractMeetingTimePhrase(command) : "";
  const reminderPreference = getReminderPreference(command);

  return {
    type: "meeting",
    title,
    time,
    wantsReminder: reminderPreference.wantsReminder,
    reminderLead: reminderPreference.lead,
    asking: "",
  };
}

function getNextMeetingStep(conversation) {
  if (!conversation.time) {
    return {
      asking: "time",
      question: "Okay. What time should I schedule it for?",
    };
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

  if (conversation.wantsReminder && !conversation.reminderLead) {
    return {
      asking: "reminderLead",
      question: "How long before the meeting should I remind you?",
    };
  }

  return null;
}

function updateMeetingConversation(conversation, reply) {
  const nextConversation = { ...conversation };
  const cleanReply = cleanVoiceText(reply);

  if (conversation.asking === "time") {
    if (!hasDateOrTime(cleanReply)) {
      return {
        conversation: nextConversation,
        question: "I need the meeting time first. What day and time should I use?",
      };
    }

    nextConversation.time =
      extractMeetingTimePhrase(cleanReply) || cleanMeetingTimeReply(cleanReply);
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

    if (preference.wantsReminder === null) {
      return {
        conversation: nextConversation,
        question: "Should I add a reminder for this meeting?",
      };
    }

    nextConversation.wantsReminder = preference.wantsReminder;
    nextConversation.reminderLead = preference.lead;
  }

  if (conversation.asking === "reminderLead") {
    if (isNegativeReply(cleanReply)) {
      nextConversation.wantsReminder = false;
      nextConversation.reminderLead = "";
    } else {
      const lead = extractReminderLead(cleanReply);

      if (!lead) {
        return {
          conversation: nextConversation,
          question: "How long before the meeting should I remind you? For example, 15 minutes before.",
        };
      }

      nextConversation.reminderLead = lead;
    }
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
  const reminderText = conversation.wantsReminder
    ? ` with a reminder ${conversation.reminderLead}`
    : " without reminder";

  return `Schedule a meeting titled "${title}" for ${conversation.time}${reminderText}.`;
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

  async function continueMeetingConversation(reply) {
    const conversation = pendingConversationRef.current;

    if (!conversation || conversation.type !== "meeting") {
      return false;
    }

    const update = updateMeetingConversation(conversation, reply);

    if (update.question) {
      setPendingConversation(update.conversation);
      await respond(update.question);
      return true;
    }

    setPendingConversation(null);
    await executeCommandText(buildMeetingConversationCommand(update.conversation));
    return true;
  }

  async function startMeetingConversation(command) {
    const conversation = createMeetingConversation(command);
    const nextStep = getNextMeetingStep(conversation);

    if (nextStep) {
      setPendingConversation({ ...conversation, asking: nextStep.asking });
      await respond(nextStep.question);
      return;
    }

    setPendingConversation(null);
    await executeCommandText(buildMeetingConversationCommand(conversation));
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

    if (await continueMeetingConversation(heardCommand)) {
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

    if (hasMeetingSchedulingIntent(finalCommand)) {
      await startMeetingConversation(heardCommand);
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
