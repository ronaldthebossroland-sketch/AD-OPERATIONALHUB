import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const AI_SYSTEM_PROMPT = `
You are the AI assistant for an Esteemed AD operational command center.
Respond in a concise, executive, ministry-appropriate tone.
`.trim();

const DEFAULT_AI_PROVIDER = "gemini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

let geminiClient = null;
let openaiClient = null;

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

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

function getPrompt(command) {
  return `${AI_SYSTEM_PROMPT}

User command:
${command}`;
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
    "The AI service is not configured. Add GEMINI_API_KEY or OPENAI_API_KEY on the backend."
  );
  error.code = "AI_NOT_CONFIGURED";
  return error;
}

async function askWithFallback(primaryName, primaryAsk, fallbackName, fallbackAsk) {
  try {
    return await primaryAsk();
  } catch (primaryError) {
    const canFallback =
      typeof fallbackAsk === "function" &&
      (isQuotaOrAvailabilityError(primaryError) ||
        isConfigurationError(primaryError));

    if (!canFallback) {
      if (isQuotaOrAvailabilityError(primaryError)) {
        throw createAIUnavailableError();
      }

      if (isConfigurationError(primaryError)) {
        throw createAIConfigurationError();
      }

      throw primaryError;
    }

    try {
      console.warn(
        `${primaryName} is unavailable or quota-limited. Falling back to ${fallbackName}.`
      );
      return await fallbackAsk();
    } catch (fallbackError) {
      if (isQuotaOrAvailabilityError(fallbackError)) {
        throw createAIUnavailableError();
      }

      if (isConfigurationError(fallbackError)) {
        throw createAIConfigurationError();
      }

      throw fallbackError;
    }
  }
}

async function askGemini(prompt) {
  const gemini = getGeminiClient();

  if (!gemini) {
    throw createAIConfigurationError();
  }

  const response = await gemini.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    contents: prompt,
  });

  return response.text || "I could not generate a response.";
}

async function askOpenAI(prompt) {
  const openai = getOpenAIClient();

  if (!openai) {
    throw createAIConfigurationError();
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    input: prompt,
  });

  return response.output_text || "I could not generate a response.";
}

export async function askAI(command) {
  const provider = (process.env.AI_PROVIDER || DEFAULT_AI_PROVIDER)
    .trim()
    .toLowerCase();
  const prompt = getPrompt(command);

  if (provider === "openai") {
    return askWithFallback(
      "OpenAI",
      () => askOpenAI(prompt),
      "Gemini",
      getGeminiClient() ? () => askGemini(prompt) : null
    );
  }

  if (provider === "gemini") {
    return askWithFallback(
      "Gemini",
      () => askGemini(prompt),
      "OpenAI",
      getOpenAIClient() ? () => askOpenAI(prompt) : null
    );
  }

  console.warn(`Unsupported AI_PROVIDER "${provider}". Using Gemini.`);
  return askWithFallback(
    "Gemini",
    () => askGemini(prompt),
    "OpenAI",
    getOpenAIClient() ? () => askOpenAI(prompt) : null
  );
}
