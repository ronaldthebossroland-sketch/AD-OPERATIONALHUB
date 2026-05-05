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

export async function askAI(command) {
  const provider = getConfiguredProvider();
  const prompt = getPrompt(command);

  if (provider !== "gemini") {
    console.warn(`Unsupported AI_PROVIDER "${provider}". Using Gemini only.`);
  }

  return askGemini(prompt);
}
