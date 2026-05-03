import { Loader2, MessageSquareQuote, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { getConversationAdvice } from "../../services/api";
import { Button } from "../ui/button";
import SectionHeader from "../shared/SectionHeader";

const PLACEHOLDER = `Paste the conversation here — WhatsApp, email thread, Telegram, SMS, or any text exchange. Include as much context as possible for the best advice.

Example:
Person: Good afternoon sir, I wanted to follow up on the proposal we sent last week...
You: ...`;

export default function ConversationAdvisorView() {
  const [conversation, setConversation] = useState("");
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    if (!conversation.trim()) return;
    setError("");
    setAdvice(null);
    setLoading(true);

    try {
      const data = await getConversationAdvice(conversation.trim());

      if (!data.ok) {
        setError(data.error || "Could not analyze the conversation.");
        return;
      }

      setAdvice(data.advice);
    } catch {
      setError("Could not reach the AI service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setConversation("");
    setAdvice(null);
    setError("");
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Conversation Advisor"
        subtitle="Paste any conversation and get executive-level advice on how to respond."
      />

      <div className="luxury-panel rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-black text-slate-700">
          Paste conversation
        </label>
        <textarea
          value={conversation}
          onChange={(e) => setConversation(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
        />

        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={handleAnalyze}
            disabled={loading || !conversation.trim()}
            className="rounded-2xl px-6 py-3"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {loading ? "Analysing..." : "Get Advice"}
          </Button>

          {(conversation || advice) && (
            <Button
              onClick={handleClear}
              variant="outline"
              className="rounded-2xl px-5 py-3"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>

      {advice && (
        <div className="luxury-panel rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="luxury-soft-icon flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <MessageSquareQuote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">
                AI Advice
              </h2>
              <p className="text-xs text-slate-500">
                Powered by Gemini 2.5 Flash
              </p>
            </div>
          </div>

          <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-800">
            {advice}
          </div>
        </div>
      )}
    </div>
  );
}
