import {
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Mic,
  Send,
  ShieldCheck,
  Square,
} from "lucide-react";

import useVoiceAgent, {
  actionTypeLabel,
  getActionDetail,
  isCompletedAction,
} from "../../hooks/useVoiceAgent";
import { Button } from "../ui/button";

const statusLabels = {
  ready: "Ready",
  listening: "Listening...",
  thinking: "Thinking...",
  executing: "Executing...",
  speaking: "Speaking...",
};

export default function VoiceAgent({
  onAction,
  onNavigate,
  onResult,
  onStartTranscribing,
}) {
  const {
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
  } = useVoiceAgent({
    onAction,
    onNavigate,
    onResult,
    onStartTranscribing,
  });

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-950">
              Conversational Voice Agent
            </p>
            <p className="text-xs text-slate-500">
              {hasPendingQuestion
                ? "Waiting for your answer"
                : "Deepgram listening with spoken replies"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
            {statusLabels[status] || "Ready"}
          </span>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={(event) => setContinuousMode(event.target.checked)}
              className="h-4 w-4"
            />
            Continuous
          </label>
          <Button
            onClick={toggleListening}
            disabled={isRunning || status === "speaking"}
            variant={isListening ? "default" : "outline"}
            className="rounded-2xl"
          >
            {isListening ? (
              <Square className="mr-2 h-4 w-4" />
            ) : (
              <Mic className="mr-2 h-4 w-4" />
            )}
            {isListening ? "Stop" : "Start Voice Agent"}
          </Button>
        </div>
      </div>

      {liveTranscript && (
        <div className="mt-4 rounded-2xl bg-slate-950 p-3 text-sm leading-6 text-white">
          {liveTranscript}
        </div>
      )}

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-2xl p-3 ${
              message.role === "user"
                ? "ml-8 bg-slate-950 text-white"
                : "mr-8 border border-slate-100 bg-slate-50 text-slate-700"
            }`}
          >
            <p className="text-sm leading-6">{message.text}</p>

            {message.actions?.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.actions.map((action, index) => (
                  <div
                    key={`${message.id}-${action.type}-${index}`}
                    className="rounded-xl bg-white p-3 text-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-slate-950">
                          {action.title || actionTypeLabel(action.type)}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500">
                          {actionTypeLabel(action.type)}
                        </p>
                      </div>
                      {isCompletedAction(action) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    {getActionDetail(action) && (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {getActionDetail(action)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {message.pendingApprovals?.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-800">
                <div className="flex items-center gap-2 text-xs font-black">
                  <ShieldCheck className="h-4 w-4" />
                  Pending Approval
                </div>
                {message.pendingApprovals.map((approval) => (
                  <p key={approval.title} className="mt-2 text-xs leading-5">
                    <span className="font-black">{approval.title}:</span>{" "}
                    {approval.detail}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasPendingQuestion && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={typedReply}
            onChange={(event) => setTypedReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitTypedReply();
            }}
            placeholder={lastAssistantMessage?.text || "Answer the follow-up"}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
          />
          <Button onClick={submitTypedReply} className="rounded-2xl">
            <Send className="mr-2 h-4 w-4" />
            Reply
          </Button>
        </div>
      )}
    </div>
  );
}
