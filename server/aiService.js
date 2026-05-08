import { GoogleGenAI } from "@google/genai";

const AI_SYSTEM_PROMPT = `
You are the AI assistant for an Esteemed AD operational command center.
Respond in a concise, executive, ministry-appropriate tone.
`.trim();

const DEFAULT_AI_PROVIDER = "gemini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

let geminiClient = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }

  return geminiClient;
}

function getPrompt(command) {
  return `${AI_SYSTEM_PROMPT}

User command:
${command}`;
}

function getConfiguredProvider() {
  return (process.env.AI_PROVIDER || DEFAULT_AI_PROVIDER).trim().toLowerCase();
}

function getGeminiModel() {
  return process.env.AI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

function getErrorStatus(error) {
  return error?.status || error?.response?.status || error?.error?.code;
}

function getErrorMessage(error) {
  if (typeof error?.message === "string") {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

function isQuotaOrAvailabilityError(error) {
  const status = getErrorStatus(error);
  const code = error?.code || error?.error?.code;
  const type = error?.type || error?.error?.type;
  const message = getErrorMessage(error).toLowerCase();

  return (
    status === 402 ||
    status === 429 ||
    status === 500 ||
    status === 503 ||
    code === "insufficient_quota" ||
    code === "RESOURCE_EXHAUSTED" ||
    type === "insufficient_quota" ||
    message.includes("insufficient_quota") ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("rate limit") ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("unavailable")
  );
}

function isConfigurationError(error) {
  const code = error?.code || error?.error?.code;
  const message = getErrorMessage(error).toLowerCase();

  return code === "AI_NOT_CONFIGURED" || message.includes("not configured");
}

function createAIUnavailableError() {
  const error = new Error(
    "The AI service is temporarily unavailable. Please try again shortly."
  );
  error.code = "AI_TEMPORARILY_UNAVAILABLE";
  return error;
}

function createAIConfigurationError() {
  const error = new Error(
    "The AI service is not configured. Add GEMINI_API_KEY on the backend."
  );
  error.code = "AI_NOT_CONFIGURED";
  return error;
}

async function normalizeAIError(error) {
  if (isQuotaOrAvailabilityError(error)) {
    throw createAIUnavailableError();
  }

  if (isConfigurationError(error)) {
    throw createAIConfigurationError();
  }

  throw error;
}

const ABBREVIATION_RE = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|approx|est|dept|govt|inc|corp|ltd)\.$/i;
const NUMBERED_LIST_RE = /\b\d+\.$/;

function flushSentences(buffer, isEnd = false) {
  const sentences = [];
  const pattern = /[.!?](\s+)/g;
  let last = 0;
  let m;

  while ((m = pattern.exec(buffer)) !== null) {
    const sentence = buffer.slice(last, m.index + 1).trim();
    last = m.index + 1 + m[1].length;
    if (
      sentence.length >= 8 &&
      !ABBREVIATION_RE.test(sentence) &&
      !NUMBERED_LIST_RE.test(sentence)
    ) {
      sentences.push(sentence);
    }
  }

  const remaining = buffer.slice(last);

  if (isEnd && remaining.trim().length >= 5) {
    return { sentences: [...sentences, remaining.trim()], remaining: "" };
  }

  return { sentences, remaining };
}

async function askGemini(prompt) {
  const gemini = getGeminiClient();

  if (!gemini) {
    throw createAIConfigurationError();
  }

  try {
    const response = await gemini.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
    });

    return response.text || "I could not generate a response.";
  } catch (error) {
    return normalizeAIError(error);
  }
}

async function askGeminiStream(prompt, onDone) {
  const gemini = getGeminiClient();

  if (!gemini) {
    throw createAIConfigurationError();
  }

  try {
    const stream = await gemini.models.generateContentStream({
      model: getGeminiModel(),
      contents: prompt,
    });

    let fullText = "";
    for await (const chunk of stream) {
      fullText += chunk.text || "";
    }

    await onDone(fullText.trim() || "I could not generate a response.");
  } catch (error) {
    return normalizeAIError(error);
  }
}

async function askGeminiSpeechStream(prompt, onSentence) {
  const gemini = getGeminiClient();

  if (!gemini) {
    throw createAIConfigurationError();
  }

  try {
    const stream = await gemini.models.generateContentStream({
      model: getGeminiModel(),
      contents: prompt,
    });

    let buffer = "";
    for await (const chunk of stream) {
      buffer += chunk.text || "";
      const { sentences, remaining } = flushSentences(buffer);
      buffer = remaining;
      for (const sentence of sentences) {
        await onSentence(sentence);
      }
    }

    const { sentences: tail } = flushSentences(buffer, true);
    for (const sentence of tail) {
      await onSentence(sentence);
    }
  } catch (error) {
    return normalizeAIError(error);
  }
}

export async function askAI(command) {
  const provider = getConfiguredProvider();
  const prompt = getPrompt(command);

  if (provider !== "gemini") {
    console.warn(`Unsupported AI_PROVIDER "${provider}". Using Gemini only.`);
  }

  return askGemini(prompt);
}

export async function askAIStream(command, onDone) {
  const prompt = getPrompt(command);
  return askGeminiStream(prompt, onDone);
}

export async function askAISpeechStream(prompt, onSentence) {
  return askGeminiSpeechStream(prompt, onSentence);
}
