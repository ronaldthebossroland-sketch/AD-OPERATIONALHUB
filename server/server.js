import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import { google } from "googleapis";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { createServer } from "http";
import { DeepgramClient } from "@deepgram/sdk";
import { WebSocket, WebSocketServer } from "ws";
import { askAI } from "./aiService.js";

dotenv.config({ path: "./server/.env" });

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Africa/Lagos";
process.env.TZ ||= APP_TIME_ZONE;

const { supabaseAdmin } = await import("./supabaseClient.js");

const app = express();
const httpServer = createServer(app);
const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const PRODUCTION_APP_HOME_URL = "https://ad-operationalhub-seven.vercel.app";
const LOCAL_APP_HOME_URL = "http://localhost:5173";
const APP_HOME_URL = (
  process.env.APP_HOME_URL ||
  process.env.CLIENT_ORIGIN ||
  (process.env.NODE_ENV === "production"
    ? PRODUCTION_APP_HOME_URL
    : LOCAL_APP_HOME_URL)
).replace(/\/+$/, "");
const DEFAULT_APP_ORIGINS = [
  PRODUCTION_APP_HOME_URL,
  LOCAL_APP_HOME_URL,
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
];
const ALLOWED_ORIGINS = Array.from(
  new Set(
    [
      ...DEFAULT_APP_ORIGINS,
      APP_HOME_URL,
      ...(process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ].filter(Boolean)
  )
);
const VERCEL_DEPLOYMENT_ORIGIN_PATTERN =
  /^https:\/\/ad-operationalhub(?:-[a-z0-9-]+)?\.vercel\.app$/i;
const LOCALHOST_ORIGIN_PATTERN =
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;
const APP_USER_COLUMNS =
  "id,name,email,role,access,is_active,auth_provider,created_at";
const APP_USER_AUTH_COLUMNS = `${APP_USER_COLUMNS},password_hash`;
const ADMIN_ROLES = ["Super Admin", "Admin"];
const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
const transcriptionTickets = new Map();
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_LENGTH = 32;

function currentDateContextForPrompt() {
  const now = new Date();

  return [
    `Current UTC date/time: ${now.toISOString()}`,
    `Current local date/time (${APP_TIME_ZONE}): ${now.toLocaleString("en-US", {
      timeZone: APP_TIME_ZONE,
      dateStyle: "full",
      timeStyle: "medium",
    })}`,
    `Use ${APP_TIME_ZONE} as the local timezone for spoken times unless the user explicitly says another timezone.`,
  ].join("\n");
}

if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = origin?.replace(/\/+$/, "");

      if (
        !normalizedOrigin ||
        ALLOWED_ORIGINS.includes(normalizedOrigin) ||
        LOCALHOST_ORIGIN_PATTERN.test(normalizedOrigin) ||
        VERCEL_DEPLOYMENT_ORIGIN_PATTERN.test(normalizedOrigin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  return next(error);
});

function healthStatus() {
  return {
    status: "ok",
    message: "Executive Virtual AI Assistant API is running",
  };
}

app.get("/", (_req, res) => {
  res.json(healthStatus());
});

app.get("/api/health", (_req, res) => {
  res.json(healthStatus());
});

const SESSION_SECRET = process.env.SESSION_SECRET?.trim();
const SESSION_COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "true" ||
  process.env.NODE_ENV === "production";
const SESSION_COOKIE_SAME_SITE =
  process.env.SESSION_COOKIE_SAME_SITE ||
  (process.env.NODE_ENV === "production" ? "none" : "lax");

if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET is required in production.");
}

if (!SESSION_SECRET) {
  console.warn("SESSION_SECRET is not set. Using a local development secret.");
}

const sessionMiddleware = session({
  secret: SESSION_SECRET || "local-development-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: SESSION_COOKIE_SECURE,
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
  },
});

app.use(sessionMiddleware);

const deepgramApiKey = process.env.DEEPGRAM_API_KEY?.trim();
const deepgram = deepgramApiKey
  ? new DeepgramClient({ apiKey: deepgramApiKey })
  : null;

function createGoogleClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
    process.env.GOOGLE_REDIRECT_URI?.trim()
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function cleanRole(value) {
  return ["Super Admin", "Admin", "Viewer"].includes(value)
    ? value
    : "Viewer";
}

function defaultAccessForRole(role) {
  return role === "Viewer" ? "Limited Access" : "Full Access";
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    "sha256"
  ).toString("hex");

  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, iterations, salt, savedHash] = String(storedHash || "").split("$");

  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !savedHash) {
    return false;
  }

  const parsedIterations = Number.parseInt(iterations, 10);

  if (Number.isNaN(parsedIterations)) {
    return false;
  }

  const attemptedHash = pbkdf2Sync(
    password,
    salt,
    parsedIterations,
    PASSWORD_KEY_LENGTH,
    "sha256"
  );
  const savedHashBuffer = Buffer.from(savedHash, "hex");

  return (
    savedHashBuffer.length === attemptedHash.length &&
    timingSafeEqual(savedHashBuffer, attemptedHash)
  );
}

function setSessionUser(req, user) {
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "Viewer",
    access: user.access || defaultAccessForRole(user.role),
  };
}

async function getAppUserByEmail(email) {
  const finalEmail = normalizeEmail(email);

  if (!finalEmail) {
    return { user: null, error: null };
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .ilike("email", finalEmail)
    .maybeSingle();

  return { user: data || null, error };
}

async function getAppUserForPasswordLogin(email) {
  const finalEmail = normalizeEmail(email);

  if (!finalEmail) {
    return { user: null, error: null };
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(APP_USER_AUTH_COLUMNS)
    .ilike("email", finalEmail)
    .maybeSingle();

  return { user: data || null, error };
}

async function getActiveAppUserByEmail(email) {
  const { user, error } = await getAppUserByEmail(email);

  if (error) {
    return { user: null, error };
  }

  if (!user || user.is_active !== true) {
    return { user: null, error: null };
  }

  return { user, error: null };
}

async function getOrCreateGoogleUser(email, name) {
  const finalEmail = normalizeEmail(email);

  if (!finalEmail) {
    return { user: null, error: new Error("Google profile email is required.") };
  }

  const { user: existingUser, error: lookupError } =
    await getAppUserByEmail(finalEmail);

  if (lookupError) {
    return { user: null, error: lookupError };
  }

  if (existingUser) {
    return {
      user: existingUser.is_active === true ? existingUser : null,
      error: null,
      inactive: existingUser.is_active !== true,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert({
      name: cleanText(name) || finalEmail,
      email: finalEmail,
      role: "Viewer",
      access: "Limited Access",
      auth_provider: "google",
      is_active: true,
    })
    .select(APP_USER_COLUMNS)
    .single();

  return { user: data || null, error, created: Boolean(data) };
}

async function getGoogleProfile(oauth2Client, tokens) {
  if (tokens.id_token) {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID?.trim(),
    });
    const payload = ticket.getPayload();

    if (payload?.email) {
      return {
        email: payload.email,
        name: payload.name || payload.email,
      };
    }
  }

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: "v2",
  });
  const profile = await oauth2.userinfo.get();

  return {
    email: profile.data.email,
    name: profile.data.name || profile.data.email,
  };
}

function sendGoogleError(res, error, statusCode = 500) {
  const detail =
    error.response?.data?.error_description ||
    error.response?.data?.error ||
    error.message ||
    "Unknown Google OAuth error.";

  res.status(statusCode).send(`
    <!doctype html>
    <html>
      <head>
        <title>Google connection failed</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f1f5f9;
            color: #020617;
            font-family: Arial, sans-serif;
          }
          main {
            width: min(92vw, 520px);
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            background: white;
            padding: 28px;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
          }
          h1 { margin: 0; font-size: 24px; }
          p { color: #475569; line-height: 1.6; }
          code {
            display: block;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            border-radius: 16px;
            background: #f8fafc;
            padding: 14px;
            color: #334155;
          }
          a {
            display: inline-block;
            margin-top: 18px;
            border-radius: 16px;
            background: #020617;
            padding: 12px 16px;
            color: white;
            text-decoration: none;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Google connection failed</h1>
          <p>Google could not complete sign-in for this hub.</p>
          <code>${String(detail).replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</code>
          <p>Return to the app after confirming your account is active.</p>
          <a href="${APP_HOME_URL}">Return to Executive Virtual AI Assistant</a>
        </main>
      </body>
    </html>
  `);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  next();
}

function userHasRole(user, roles) {
  return Boolean(user && roles.includes(user.role));
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Not logged in" });
    }

    if (!userHasRole(req.session.user, roles)) {
      return res.status(403).json({ error: "Access restricted" });
    }

    next();
  };
}

function hasBodyField(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function clampProgress(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, parsed));
}

function parseAttendees(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parseAttendees(parsed);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function formatMeeting(row) {
  return {
    ...row,
    attendees: parseAttendees(row.attendees),
  };
}

function isMissingTableError(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.message?.toLowerCase().includes("could not find the table")
  );
}

function getMissingColumnName(error) {
  const message = error?.message || "";
  const details = error?.details || "";
  const text = `${message} ${details}`;
  const match =
    text.match(/column "([^"]+)" does not exist/i) ||
    text.match(/Could not find the '([^']+)' column/i) ||
    text.match(/'([^']+)' column/i);

  return match?.[1] || "";
}

function isMissingColumnError(error) {
  return Boolean(
    getMissingColumnName(error) ||
      error?.code === "42703" ||
      error?.code === "PGRST204"
  );
}

async function listTableRows(res, table, key, formatter = (row) => row) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return res.json({ [key]: [] });
    }

    console.error(`List ${table} error:`, error);
    return res.status(500).json({ error: `Could not load ${key}.` });
  }

  res.json({ [key]: (data || []).map(formatter) });
}

async function insertTableRow(res, table, key, payload, formatter = (row) => row) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(nextPayload)
      .select("*")
      .single();

    if (!error) {
      return res.status(201).json({ [key]: formatter(data) });
    }

    const missingColumn = getMissingColumnName(error);

    if (missingColumn && Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
      console.warn(`Skipping missing ${table}.${missingColumn} column for insert.`);
      const { [missingColumn]: _removed, ...remainingPayload } = nextPayload;
      void _removed;
      nextPayload = remainingPayload;
      continue;
    }

    console.error(`Insert ${table} error:`, error);
    return res.status(500).json({ error: `Could not save ${key}.` });
  }

  console.error(`Insert ${table} error: too many missing-column retries.`);
  return res.status(500).json({ error: `Could not save ${key}.` });
}

async function updateTableRow(
  res,
  table,
  key,
  id,
  payload,
  formatter = (row) => row
) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(nextPayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (!error) {
      if (!data) {
        return res.status(404).json({ error: `${key} not found.` });
      }

      return res.json({ [key]: formatter(data) });
    }

    const missingColumn = getMissingColumnName(error);

    if (missingColumn && Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
      console.warn(`Skipping missing ${table}.${missingColumn} column for update.`);
      const { [missingColumn]: _removed, ...remainingPayload } = nextPayload;
      void _removed;
      nextPayload = remainingPayload;
      continue;
    }

    console.error(`Update ${table} error:`, error);
    return res.status(500).json({ error: `Could not update ${key}.` });
  }

  console.error(`Update ${table} error: too many missing-column retries.`);
  return res.status(500).json({ error: `Could not update ${key}.` });
}

async function deleteTableRow(res, table, id) {
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);

  if (error) {
    console.error(`Delete ${table} error:`, error);
    return res.status(500).json({ error: "Could not delete record." });
  }

  res.json({ success: true });
}

function categorizeEmailRecord(email) {
  const text = [email.from, email.subject, email.snippet]
    .join(" ")
    .toLowerCase();

  if (/\b(urgent|asap|immediately|critical|high priority|deadline)\b/.test(text)) {
    return "urgent";
  }

  if (/\b(invoice|payment|finance|budget|receipt|expense|fund|donation)\b/.test(text)) {
    return "finance";
  }

  if (/\b(meeting|schedule|calendar|appointment|invite|call)\b/.test(text)) {
    return "meeting_request";
  }

  if (/\b(partner|partnership|sponsor|vendor|collaboration)\b/.test(text)) {
    return "partnership";
  }

  if (/\b(reply|respond|question|request|follow up|follow-up)\b/.test(text)) {
    return "needs_reply";
  }

  return "low_priority";
}

function emailUrgencyFromCategory(category) {
  if (category === "urgent") {
    return "High";
  }

  return category === "low_priority" ? "Low" : "Medium";
}

function hasGmailSendScope(tokens) {
  return String(tokens?.scope || "")
    .split(/\s+/)
    .includes("https://www.googleapis.com/auth/gmail.send");
}

function hasGmailReadScope(tokens) {
  return String(tokens?.scope || "")
    .split(/\s+/)
    .includes("https://www.googleapis.com/auth/gmail.readonly");
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalizedValue = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalizedValue.length % 4)) % 4);

  return Buffer.from(`${normalizedValue}${padding}`, "base64").toString("utf8");
}

function encodeOAuthState(payload) {
  return encodeBase64Url(JSON.stringify(payload));
}

function decodeOAuthState(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(value));

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isAllowedAppReturnUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const normalizedOrigin = parsedUrl.origin.replace(/\/+$/, "");

    return (
      ALLOWED_ORIGINS.includes(normalizedOrigin) ||
      VERCEL_DEPLOYMENT_ORIGIN_PATTERN.test(normalizedOrigin)
    );
  } catch {
    return false;
  }
}

function getSafeAppReturnUrl(value, fallbackPath = "/") {
  const fallbackUrl = `${APP_HOME_URL}${fallbackPath}`;
  const requestedUrl = cleanText(value);

  if (!requestedUrl) {
    return fallbackUrl;
  }

  try {
    const parsedUrl = new URL(requestedUrl, APP_HOME_URL);

    return isAllowedAppReturnUrl(parsedUrl.toString())
      ? parsedUrl.toString()
      : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

function getProviderTokenExpiry(expiresAt, expiresIn) {
  const parsedExpiresAt = Number.parseInt(expiresAt, 10);

  if (!Number.isNaN(parsedExpiresAt) && parsedExpiresAt > 0) {
    return parsedExpiresAt < 1000000000000
      ? parsedExpiresAt * 1000
      : parsedExpiresAt;
  }

  const parsedExpiresIn = Number.parseInt(expiresIn, 10);

  if (!Number.isNaN(parsedExpiresIn) && parsedExpiresIn > 0) {
    return Date.now() + parsedExpiresIn * 1000;
  }

  return undefined;
}

function getGoogleProviderTokens(body) {
  const providerToken = cleanText(
    body.googleProviderToken || body.providerToken
  );

  if (!providerToken) {
    return null;
  }

  const providerRefreshToken = cleanText(
    body.googleProviderRefreshToken || body.providerRefreshToken
  );
  const providerScope =
    cleanText(body.googleProviderScope || body.providerScope) ||
    GMAIL_OAUTH_SCOPES.join(" ");
  const expiryDate = getProviderTokenExpiry(
    body.googleProviderExpiresAt || body.providerExpiresAt,
    body.googleProviderExpiresIn || body.providerExpiresIn
  );

  return {
    access_token: providerToken,
    ...(providerRefreshToken ? { refresh_token: providerRefreshToken } : {}),
    ...(expiryDate ? { expiry_date: expiryDate } : {}),
    scope: providerScope,
    token_type: "Bearer",
  };
}

async function attachGmailTokensFromProvider(req, expectedEmail) {
  const tokens = getGoogleProviderTokens(req.body);

  if (!tokens) {
    return false;
  }

  const oauth2Client = createGoogleClient();
  oauth2Client.setCredentials(tokens);

  const profile = await getGoogleProfile(oauth2Client, tokens);
  const profileEmail = normalizeEmail(profile.email);

  if (!profileEmail || profileEmail !== expectedEmail) {
    throw new Error("Google Gmail account must match the signed-in account.");
  }

  req.session.tokens = tokens;
  req.session.gmail = {
    connectedAt: new Date().toISOString(),
    connectedEmail: profileEmail,
    readEnabled: hasGmailReadScope(tokens),
    sendEnabled: hasGmailSendScope(tokens),
  };

  return true;
}

const WEEKDAY_INDEX = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTH_INDEX = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function startOfLocalDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseTimeParts(text) {
  const value = cleanText(text);
  const timeCandidate =
    value.match(
      /\b(?:at|by|before|around|for)\s+((?:[01]?\d|2[0-3]):[0-5]\d)\s*(AM|PM)?\b/i
    ) ||
    value.match(
      /\b(?:at|by|before|around|for)\s+((?:1[0-2]|0?[1-9])\s*(?:AM|PM))\b/i
    ) ||
    value.match(/\b((?:[01]?\d|2[0-3]):[0-5]\d)\s*(AM|PM)?\b/i) ||
    value.match(/\b((?:1[0-2]|0?[1-9])\s*(?:AM|PM))\b/i);

  if (timeCandidate) {
    const timeMatch = timeCandidate[1]
      .replace(/\s+/g, " ")
      .trim()
      .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);

    if (timeMatch) {
      return {
        hour: Number.parseInt(timeMatch[1], 10),
        minute: Number.parseInt(timeMatch[2] || "0", 10),
        meridiem: (timeMatch[3] || timeCandidate[2] || "").toUpperCase(),
      };
    }
  }

  const spokenMatch = value.match(
    /\b(?:at|by|before|around|for)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s?(am|pm)?\b/i
  );
  const wordNumbers = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };

  if (spokenMatch) {
    return {
      hour:
        wordNumbers[spokenMatch[1].toLowerCase()] ||
        Number.parseInt(spokenMatch[1], 10),
      minute: 0,
      meridiem: (spokenMatch[2] || "").toUpperCase(),
    };
  }

  return null;
}

function parseDateAnchor(text, baseDate = new Date()) {
  const value = cleanText(text);
  const lower = value.toLowerCase();
  const base = startOfLocalDay(baseDate);

  if (/\bday after tomorrow\b/i.test(value)) {
    const date = new Date(base);
    date.setDate(date.getDate() + 2);
    return date;
  }

  if (/\btomorrow\b/i.test(value)) {
    const date = new Date(base);
    date.setDate(date.getDate() + 1);
    return date;
  }

  if (/\btoday\b/i.test(value)) {
    return new Date(base);
  }

  if (/\bnext week\b/i.test(value)) {
    const date = new Date(base);
    date.setDate(date.getDate() + 7);
    return date;
  }

  const monthReferenceMatch = lower.match(
    /\b(?:on\s+|by\s+|due\s+|deadline\s+|the\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*:)\s+(?:of\s+)?((?:this|next)\s+month)\b/i
  );
  const ordinalDayMatch = lower.match(
    /\b(?:on\s+|by\s+|due\s+|deadline\s+|the\s+)(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)(?!\s*:)\b/i
  );
  const dayOfMonthMatch = monthReferenceMatch || ordinalDayMatch;

  if (dayOfMonthMatch) {
    const day = Number.parseInt(dayOfMonthMatch[1], 10);

    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      const date = new Date(base);
      const monthModifier = dayOfMonthMatch[2] || "";

      date.setDate(1);

      if (/next/i.test(monthModifier)) {
        date.setMonth(date.getMonth() + 1);
      }

      date.setDate(day);

      if (!monthModifier && date.getTime() < base.getTime()) {
        date.setMonth(date.getMonth() + 1);
      }

      return date;
    }
  }

  const weekdayMatch = lower.match(
    /\b(next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday|day)?|wed(?:nesday)?|thu(?:r|rs|rsday|rday|day)?|fri(?:day)?|sat(?:urday)?)\b/i
  );

  if (weekdayMatch) {
    const dayIndex = WEEKDAY_INDEX[weekdayMatch[2].toLowerCase()];

    if (dayIndex !== undefined) {
      const date = new Date(base);
      let delta = (dayIndex - date.getDay() + 7) % 7;

      if (delta === 0 || weekdayMatch[1]) {
        delta = delta === 0 ? 7 : delta;
      }

      date.setDate(date.getDate() + delta);
      return date;
    }
  }

  const monthNamePattern = Object.keys(MONTH_INDEX).join("|");
  const monthFirstMatch = lower.match(
    new RegExp(`\\b(${monthNamePattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i")
  );
  const dayFirstMatch = lower.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNamePattern})(?:,?\\s+(\\d{4}))?\\b`, "i")
  );
  const numericDateMatch = lower.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/
  );

  if (monthFirstMatch || dayFirstMatch) {
    const monthName = monthFirstMatch?.[1] || dayFirstMatch?.[2];
    const day = Number.parseInt(monthFirstMatch?.[2] || dayFirstMatch?.[1], 10);
    const yearValue = monthFirstMatch?.[3] || dayFirstMatch?.[3];
    const date = new Date(base);
    date.setFullYear(
      yearValue ? Number.parseInt(yearValue, 10) : base.getFullYear(),
      MONTH_INDEX[monthName.toLowerCase()],
      day
    );

    if (!yearValue && date.getTime() < base.getTime() - 24 * 60 * 60 * 1000) {
      date.setFullYear(date.getFullYear() + 1);
    }

    return date;
  }

  if (numericDateMatch) {
    const first = Number.parseInt(numericDateMatch[1], 10);
    const second = Number.parseInt(numericDateMatch[2], 10);
    const yearValue = numericDateMatch[3];
    const date = new Date(base);
    const fullYear = yearValue
      ? Number.parseInt(yearValue.length === 2 ? `20${yearValue}` : yearValue, 10)
      : base.getFullYear();

    date.setFullYear(fullYear, first - 1, second);

    if (!yearValue && date.getTime() < base.getTime() - 24 * 60 * 60 * 1000) {
      date.setFullYear(date.getFullYear() + 1);
    }

    return date;
  }

  return null;
}

function parseFlexibleDateLike(value, { requireTime = false } = {}) {
  if (!value) {
    return null;
  }

  const text = cleanText(value);
  const relativeMatch = text.match(
    /\bin\s+(a|an|one|\d+)\s+(minute|minutes|min|mins|hour|hours|hr|hrs|day|days)\b/i
  );

  if (relativeMatch) {
    const amountText = relativeMatch[1].toLowerCase();
    const amount = /^(a|an|one)$/.test(amountText)
      ? 1
      : Number.parseInt(amountText, 10);
    const unit = relativeMatch[2].toLowerCase();
    const minutes = unit.startsWith("hour") || unit.startsWith("hr")
      ? amount * 60
      : unit.startsWith("day")
        ? amount * 24 * 60
        : amount;

    if (Number.isFinite(minutes) && minutes > 0) {
      return addMinutes(new Date(), minutes);
    }
  }

  const hasExplicitTime = Boolean(parseTimeParts(text));
  const directDate = new Date(value);

  if (
    !Number.isNaN(directDate.getTime()) &&
    (!requireTime ||
      hasExplicitTime ||
      /T\d{2}:\d{2}/.test(text) ||
      /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(text))
  ) {
    return directDate;
  }

  const dateAnchor = parseDateAnchor(text);
  const timeParts = parseTimeParts(text);

  if (requireTime && !timeParts) {
    return null;
  }

  if (!dateAnchor && !timeParts) {
    return null;
  }

  const date = dateAnchor || new Date();

  if (!timeParts) {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  let hour = timeParts.hour;
  const minute = timeParts.minute;
  const meridiem = timeParts.meridiem;
  const hasMeridiem = Boolean(meridiem);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  if (meridiem === "PM" && hour < 12) {
    hour += 12;
  }

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  date.setHours(hour, minute, 0, 0);

  if (dateAnchor || hasMeridiem || hour >= 12) {
    if (!dateAnchor && !hasMeridiem && hour < 12 && date.getTime() < Date.now() - 5 * 60_000) {
      const afternoon = new Date(date);
      afternoon.setHours(hour + 12, minute, 0, 0);
      return afternoon;
    }

    return date;
  }

  const threshold = Date.now() - 5 * 60 * 1000;
  const candidates = [new Date(date)];
  const afternoon = new Date(date);
  afternoon.setHours(hour + 12, minute, 0, 0);
  candidates.push(afternoon);

  if (!/\btomorrow\b/i.test(text)) {
    const tomorrowMorning = new Date(date);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    candidates.push(tomorrowMorning);
  }

  return candidates.find((candidate) => candidate.getTime() >= threshold) || date;
}

function parseDateLike(value) {
  return parseFlexibleDateLike(value);
}

function parseDateTimeLike(value) {
  return parseFlexibleDateLike(value, { requireTime: true });
}

function toIsoDate(value) {
  const date = parseDateLike(value);
  return date ? date.toISOString() : "";
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseDurationMinutes(value, fallback = 60) {
  const text = cleanText(value).toLowerCase();
  const hourMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i);
  const minuteMatch = text.match(/\b(\d+)\s*(minutes?|mins?|m)\b/i);

  if (hourMatch) {
    return Math.max(15, Math.round(Number.parseFloat(hourMatch[1]) * 60));
  }

  if (minuteMatch) {
    return Math.max(15, Number.parseInt(minuteMatch[1], 10));
  }

  return fallback;
}

function formatDateTimeForMeeting(date) {
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const REMINDER_NUMBER_WORDS = {
  zero: 0,
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  couple: 2,
  three: 3,
  few: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function parseReminderAmount(value) {
  const cleanValue = cleanText(value)
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\bof\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanValue) {
    return null;
  }

  const numeric = Number.parseFloat(cleanValue);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  if (cleanValue === "half") {
    return 0.5;
  }

  if (cleanValue === "quarter") {
    return 0.25;
  }

  const tokens = cleanValue.split(" ");
  const hasFraction = tokens.includes("half") || tokens.includes("quarter");
  const hasScale = tokens.includes("hundred") || tokens.includes("thousand");
  let total = 0;
  let current = 0;
  let matched = false;

  for (const token of tokens) {
    if ((token === "a" || token === "an") && hasFraction && !hasScale) {
      continue;
    }

    if (token === "half") {
      current += 0.5;
      matched = true;
      continue;
    }

    if (token === "quarter") {
      current += 0.25;
      matched = true;
      continue;
    }

    if (token === "hundred") {
      current = Math.max(current, 1) * 100;
      matched = true;
      continue;
    }

    if (token === "thousand") {
      total += Math.max(current, 1) * 1000;
      current = 0;
      matched = true;
      continue;
    }

    const wordValue = REMINDER_NUMBER_WORDS[token];

    if (wordValue === undefined) {
      continue;
    }

    current += wordValue;
    matched = true;
  }

  return matched ? total + current : null;
}

function normalizeReminderUnit(unit) {
  const cleanUnit = cleanText(unit).toLowerCase();

  if (/^d(?:ay|ays)?$/.test(cleanUnit)) {
    return "days";
  }

  if (/^h(?:our|ours|r|rs)?$/.test(cleanUnit)) {
    return "hours";
  }

  if (/^(m|mins?|minu?t?e?s?|minues|mintes|mns?)$/.test(cleanUnit)) {
    return "minutes";
  }

  return "";
}

function minutesFromReminderLead(amount, unit) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit === "days") {
    return Math.round(amount * 24 * 60);
  }

  if (unit === "hours") {
    return Math.round(amount * 60);
  }

  if (unit === "minutes") {
    return Math.round(amount);
  }

  return null;
}

function minutesBeforeValue(value) {
  const text = cleanText(value);

  if (/\b(?:a\s+)?quarter\s+(?:of\s+)?(?:an?\s+)?hour\b/i.test(text)) {
    return 15;
  }

  if (/\b(?:a\s+)?half\s+(?:of\s+)?(?:an?\s+)?hour\b/i.test(text)) {
    return 30;
  }

  const numericMatch = text.match(
    /\b(\d+(?:\.\d+)?)\s*(m|mins?|minu?t?e?s?|minues|mintes|mns?|h|hrs?|hours?|d|days?)\b(?:\s*(?:before|early|earlier|ahead|prior|pre|notice|advance))?/i
  );

  if (numericMatch) {
    return minutesFromReminderLead(
      Number.parseFloat(numericMatch[1]),
      normalizeReminderUnit(numericMatch[2])
    );
  }

  const wordMatch = text.match(
    /\b((?:(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|couple|few|half|quarter|and|of)[-\s]*)+)\s*(minutes?|mins?|minu?t?e?s?|minues|mintes|mns?|hours?|hrs?|days?)\b(?:\s*(?:before|early|earlier|ahead|prior|pre|notice|advance))?/i
  );

  if (wordMatch) {
    return minutesFromReminderLead(
      parseReminderAmount(wordMatch[1]),
      normalizeReminderUnit(wordMatch[2])
    );
  }

  return null;
}

function resolveAlarmDueAt(reminderTime, relatedRecord, fallbackText = "") {
  const minutesBefore = minutesBeforeValue(reminderTime);
  const relatedStart = parseDateLike(
    relatedRecord?.time ||
      relatedRecord?.start_at ||
      relatedRecord?.due_at ||
      relatedRecord?.reminder_time
  );

  if (minutesBefore !== null && relatedStart) {
    return addMinutes(relatedStart, -minutesBefore).toISOString();
  }

  const explicitReminderDate = parseDateLike(reminderTime);

  if (explicitReminderDate) {
    return explicitReminderDate.toISOString();
  }

  const explicitFallbackDate = parseDateLike(fallbackText);

  return explicitFallbackDate ? explicitFallbackDate.toISOString() : "";
}

function resolveMeetingStartDate(data, command) {
  const commandDate = parseDateTimeLike(command);

  if (commandDate) {
    return commandDate;
  }

  for (const value of [
    data?.start_at,
    data?.startAt,
    data?.starts_at,
    data?.startsAt,
    data?.due_at,
    data?.dueAt,
    data?.when,
    data?.time,
    command,
  ]) {
    const date = parseDateTimeLike(value);

    if (date) {
      return date;
    }
  }

  return null;
}

function resolveMeetingEndDate(data, startDate) {
  if (!startDate) {
    return null;
  }

  for (const value of [data?.end_at, data?.endAt, data?.ends_at, data?.endsAt]) {
    const date = parseDateTimeLike(value);

    if (date && date.getTime() > startDate.getTime()) {
      return date;
    }
  }

  return addMinutes(startDate, parseDurationMinutes(data?.duration));
}

function meetingAlarmMinutesBefore(data, command, hasStartDate) {
  const text = `${cleanText(command)} ${cleanText(data?.reminder_time)} ${cleanText(data?.alarm)}`;

  if (!hasStartDate || /\b(no|without|skip)\s+(reminder|alarm|alert)\b/i.test(text)) {
    return 0;
  }

  const explicit =
    data?.alarm_minutes_before ??
    data?.alarmMinutesBefore ??
    data?.reminder_minutes_before ??
    data?.reminderMinutesBefore;

  if (explicit === false || explicit === 0 || explicit === "0") {
    return 0;
  }

  const explicitMinutes = Number.parseInt(explicit, 10);

  if (!Number.isNaN(explicitMinutes) && explicitMinutes > 0) {
    return explicitMinutes;
  }

  const beforeMinutes = minutesBeforeValue(text);

  if (beforeMinutes !== null) {
    return beforeMinutes;
  }

  return 15;
}

function calendarSourceEvent({
  id,
  title,
  description = "",
  eventType,
  category,
  startAt,
  endAt = "",
  location = "",
  status = "",
  sourceType,
}) {
  const startDate = parseDateLike(startAt) || new Date();
  const endDate = parseDateLike(endAt);

  return {
    id: `${sourceType}-${id}`,
    title,
    description,
    event_type: eventType,
    category,
    start_at: startDate.toISOString(),
    end_at: endDate ? endDate.toISOString() : "",
    all_day: false,
    location,
    status,
    source_type: sourceType,
    source_id: id,
    is_virtual: true,
  };
}

/* =========================
   GMAIL CONNECT
========================= */

function startGmailOAuth(req, res) {
  try {
    const oauth2Client = createGoogleClient();
    const returnTo = getSafeAppReturnUrl(
      req.query.returnTo,
      "/?view=emails&gmail=connected"
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent select_account",
      scope: GMAIL_OAUTH_SCOPES,
      state: encodeOAuthState({
        flow: "gmail",
        returnTo,
      }),
    });

    res.redirect(url);
  } catch (error) {
    console.error("Gmail auth error:", error);
    res.status(500).send("Could not start Gmail connection.");
  }
}

app.get("/auth/gmail", startGmailOAuth);

app.get("/auth/google", startGmailOAuth);

app.get("/auth/google/callback", async (req, res) => {
  const state = decodeOAuthState(req.query.state);
  const returnTo = getSafeAppReturnUrl(
    state.returnTo,
    state.flow === "gmail" ? "/?view=emails&gmail=connected" : "/"
  );

  try {
    const { code, error, error_description: errorDescription } = req.query;

    if (error) {
      throw new Error(errorDescription || error);
    }

    if (!code) {
      return res.status(400).send("No Google authorization code received.");
    }

    const oauth2Client = createGoogleClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const profile = await getGoogleProfile(oauth2Client, tokens);
    const { user, error: userError, inactive } = await getOrCreateGoogleUser(
      profile.email,
      profile.name
    );

    if (userError) {
      throw userError;
    }

    if (!user) {
      return sendGoogleError(
        res,
        new Error(
          inactive
            ? "This Google account has been deactivated for Executive Virtual AI Assistant."
            : "This Google account could not be authorized for Executive Virtual AI Assistant."
        ),
        403
      );
    }

    req.session.tokens = tokens;

    if (state.flow === "gmail" && req.session.user?.email) {
      req.session.gmail = {
        connectedEmail: profile.email,
        connectedAt: new Date().toISOString(),
        readEnabled: hasGmailReadScope(tokens),
        sendEnabled: hasGmailSendScope(tokens),
      };
    } else {
      setSessionUser(req, user);
    }

    res.redirect(returnTo);
  } catch (error) {
    console.error("Google callback error:", error);
    sendGoogleError(res, error);
  }
});

/* =========================
   AUTH
========================= */

app.get("/api/auth/me", async (req, res) => {
  try {
    if (!req.session.user?.email) {
      return res.json({ loggedIn: false, user: null });
    }

    const { user, error } = await getActiveAppUserByEmail(
      req.session.user.email
    );

    if (error) {
      throw error;
    }

    if (!user) {
      return req.session.destroy(() => {
        res.json({ loggedIn: false, user: null });
      });
    }

    setSessionUser(req, user);

    res.json({
      loggedIn: true,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Current user error:", error);
    res.status(500).json({ error: "Could not verify session." });
  }
});

app.post("/api/auth/supabase", async (req, res) => {
  try {
    const accessToken = cleanText(req.body.accessToken);

    if (!accessToken) {
      return res.status(400).json({ error: "Supabase access token is required." });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error) {
      throw error;
    }

    const supabaseUser = data.user;
    const email = normalizeEmail(supabaseUser?.email);

    if (!email) {
      return res.status(401).json({ error: "Google profile email is required." });
    }

    const provider =
      supabaseUser.app_metadata?.provider ||
      supabaseUser.app_metadata?.providers?.[0];

    if (provider && provider !== "google") {
      return res.status(403).json({ error: "Use Google to sign in." });
    }

    const name =
      cleanText(supabaseUser.user_metadata?.full_name) ||
      cleanText(supabaseUser.user_metadata?.name) ||
      email;

    const { user, error: userError, inactive } = await getOrCreateGoogleUser(
      email,
      name
    );

    if (userError) {
      throw userError;
    }

    if (!user) {
      return res.status(403).json({
        error: inactive
          ? "This Google account has been deactivated for Executive Virtual AI Assistant."
          : "This Google account could not be authorized for Executive Virtual AI Assistant.",
      });
    }

    setSessionUser(req, user);

    let gmailConnected = Boolean(req.session.tokens);

    try {
      gmailConnected =
        (await attachGmailTokensFromProvider(req, email)) || gmailConnected;
    } catch (gmailError) {
      delete req.session.tokens;
      delete req.session.gmail;
      console.warn("Supabase Gmail bridge warning:", gmailError);
    }

    res.json({
      gmailConnected,
      success: true,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Supabase auth bridge error:", error);
    res.status(401).json({ error: "Could not verify Google sign-in." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const finalEmail = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!finalEmail || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const { user, error } = await getAppUserForPasswordLogin(finalEmail);

    if (error) {
      throw error;
    }

    if (!user || user.is_active !== true) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.password_hash) {
      return res.status(403).json({
        error: "Password login is not enabled for this account. Use Google.",
      });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    delete req.session.tokens;
    setSessionUser(req, user);

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error("Password login error:", error);
    res.status(500).json({ error: "Could not log in." });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const finalEmail = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const name = cleanText(req.body.name) || finalEmail;

    if (!finalEmail || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    }

    const { user: existingUser, error: lookupError } =
      await getAppUserByEmail(finalEmail);

    if (lookupError) {
      throw lookupError;
    }

    if (existingUser) {
      return res.status(409).json({
        error:
          "An account already exists for this email. Use the existing login method.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("app_users")
      .insert({
        name,
        email: finalEmail,
        role: "Viewer",
        access: "Limited Access",
        is_active: true,
        auth_provider: "password",
        password_hash: hashPassword(password),
      })
      .select(APP_USER_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    setSessionUser(req, data);

    res.status(201).json({ success: true, user: req.session.user });
  } catch (error) {
    console.error("Password signup error:", error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/kingschat", (req, res) => {
  if (process.env.KINGSCHAT_AUTH_ENABLED !== "true") {
    return res.status(503).json({
      error: "KingsChat login is pending API approval.",
    });
  }

  const accessToken = cleanText(req.body.accessToken);
  const refreshToken = cleanText(req.body.refreshToken);

  if (!accessToken || !refreshToken) {
    return res
      .status(400)
      .json({ error: "KingsChat access and refresh tokens are required." });
  }

  req.session.kingschatTokens = {
    accessToken,
    refreshToken,
    expiresInMillis: req.body.expiresInMillis || null,
  };

  res.json({ success: true });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/* =========================
   USERS MANAGEMENT
========================= */

app.get("/api/users", requireRole("Super Admin"), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_users")
      .select(APP_USER_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ users: data || [] });
  } catch (error) {
    console.error("Load users error:", error);
    res.status(500).json({ error: "Could not load users." });
  }
});

app.post("/api/users", requireRole("Super Admin"), async (req, res) => {
  try {
    const finalEmail = normalizeEmail(req.body.email);
    const role = cleanRole(req.body.role);
    const access =
      cleanText(req.body.access) || defaultAccessForRole(role);

    if (!finalEmail) {
      return res.status(400).json({ error: "Email is required." });
    }

    const { user: existingUser, error: lookupError } =
      await getAppUserByEmail(finalEmail);

    if (lookupError) {
      throw lookupError;
    }

    if (existingUser?.is_active) {
      return res.status(409).json({ error: "User already exists." });
    }

    if (existingUser) {
      const { data, error } = await supabaseAdmin
        .from("app_users")
        .update({
          name: cleanText(req.body.name, existingUser.name) || existingUser.name,
          role,
          access,
          is_active: true,
        })
        .eq("id", existingUser.id)
        .select(APP_USER_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return res.json({ success: true, user: data });
    }

    const { data, error } = await supabaseAdmin
      .from("app_users")
      .insert({
        name: cleanText(req.body.name) || "Pending User",
        email: finalEmail,
        role,
        access,
        is_active: true,
      })
      .select(APP_USER_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true, user: data });
  } catch (error) {
    console.error("Add user error:", error);
    res.status(500).json({ error: "Could not add user." });
  }
});

app.delete("/api/users/:id", requireRole("Super Admin"), async (req, res) => {
  try {
    const { data: user, error: findError } = await supabaseAdmin
      .from("app_users")
      .select(APP_USER_COLUMNS)
      .eq("id", req.params.id)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.role === "Super Admin") {
      return res.status(403).json({ error: "Cannot remove Super Admin." });
    }

    const { error } = await supabaseAdmin
      .from("app_users")
      .update({ is_active: false })
      .eq("id", req.params.id);

    if (error) {
      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Remove user error:", error);
    res.status(500).json({ error: "Could not remove user." });
  }
});

/* =========================
   LIVE OPERATIONAL DATA
========================= */

app.get("/api/meetings", requireLogin, (req, res) => {
  listTableRows(res, "meetings", "meetings", formatMeeting);
});

app.post("/api/meetings", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);

  if (!title) {
    return res.status(400).json({ error: "Meeting title is required." });
  }

  insertTableRow(
    res,
    "meetings",
    "meeting",
    {
      title,
      time: cleanText(req.body.time),
      duration: cleanText(req.body.duration),
      location: cleanText(req.body.location),
      briefing: cleanText(req.body.briefing),
      risk: cleanText(req.body.risk),
      attendees: parseAttendees(req.body.attendees),
    },
    formatMeeting
  );
});

app.patch("/api/meetings/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};

  for (const field of [
    "title",
    "time",
    "duration",
    "location",
    "briefing",
    "risk",
    "minutes",
    "status",
  ]) {
    if (hasBodyField(req.body, field)) {
      payload[field] = cleanText(req.body[field]);
    }
  }

  if (hasBodyField(req.body, "attendees")) {
    payload.attendees = parseAttendees(req.body.attendees);
  }

  updateTableRow(res, "meetings", "meeting", req.params.id, payload, formatMeeting);
});

app.delete("/api/meetings/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "meetings", req.params.id);
});

app.get("/api/alerts", requireLogin, (req, res) => {
  listTableRows(res, "alerts", "alerts");
});

app.post("/api/alerts", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);

  if (!title) {
    return res.status(400).json({ error: "Alert title is required." });
  }

  const dueAt = toIsoDate(req.body.due_at || req.body.deadline || req.body.detail);
  const payload = {
    type: cleanText(req.body.type, "Operations") || "Operations",
    title,
    detail: cleanText(req.body.detail),
    severity: cleanText(req.body.severity, "Medium") || "Medium",
    status: cleanText(req.body.status, "Open") || "Open",
  };

  if (dueAt) {
    payload.due_at = dueAt;
  }

  insertTableRow(res, "alerts", "alert", payload);
});

app.patch("/api/alerts/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};

  for (const field of ["type", "title", "detail", "severity", "status", "due_at"]) {
    if (hasBodyField(req.body, field)) {
      payload[field] =
        field === "due_at"
          ? toIsoDate(req.body[field]) || null
          : cleanText(req.body[field]);
    }
  }

  updateTableRow(res, "alerts", "alert", req.params.id, payload);
});

app.delete("/api/alerts/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "alerts", req.params.id);
});

app.get("/api/alarms", requireLogin, async (req, res) => {
  const currentUserEmail = normalizeEmail(req.session.user?.email);

  try {
    let query = supabaseAdmin
      .from("alarms")
      .select("*")
      .order("created_at", { ascending: false });

    if (currentUserEmail) {
      query = query.eq("created_by", currentUserEmail);
    }

    let { data, error } = await query;

    if (
      error &&
      currentUserEmail &&
      isMissingColumnError(error) &&
      getMissingColumnName(error) === "created_by"
    ) {
      ({ data, error } = await supabaseAdmin
        .from("alarms")
        .select("*")
        .order("created_at", { ascending: false }));
    }

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ alarms: [] });
      }

      throw error;
    }

    res.json({ alarms: data || [] });
  } catch (error) {
    console.error("Load alarms error:", error);
    res.status(500).json({ error: "Could not load reminders." });
  }
});

app.delete("/api/alarms/:id", requireLogin, async (req, res) => {
  const currentUserEmail = normalizeEmail(req.session.user?.email);

  try {
    let query = supabaseAdmin.from("alarms").delete().eq("id", req.params.id);

    if (currentUserEmail) {
      query = query.eq("created_by", currentUserEmail);
    }

    const { error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ success: true });
      }

      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete alarm error:", error);
    res.status(500).json({ error: "Could not delete reminder." });
  }
});

app.patch("/api/alarms/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  const currentUserEmail = getCurrentUserEmail(req);

  try {
    const payload = {};

    for (const field of [
      "title",
      "reminder_time",
      "notes",
      "status",
      "severity",
      "related_type",
    ]) {
      if (hasBodyField(req.body, field)) {
        payload[field] = cleanText(req.body[field]);
      }
    }

    for (const field of ["due_at", "snoozed_until", "last_triggered_at"]) {
      if (hasBodyField(req.body, field)) {
        payload[field] = req.body[field] ? toIsoDate(req.body[field]) || null : null;
      }
    }

    if (hasBodyField(req.body, "related_id")) {
      payload.related_id = req.body.related_id || null;
    }

    if (hasBodyField(req.body, "escalation_level")) {
      const parsedLevel = Number.parseInt(req.body.escalation_level, 10);
      payload.escalation_level = Number.isNaN(parsedLevel)
        ? 0
        : Math.max(0, parsedLevel);
    }

    if (Object.keys(payload).length > 0) {
      payload.updated_at = new Date().toISOString();
    }

    let query = supabaseAdmin
      .from("alarms")
      .update(payload)
      .eq("id", req.params.id);

    if (currentUserEmail) {
      query = query.eq("created_by", currentUserEmail);
    }

    const { data, error } = await query.select("*").maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return res.status(404).json({ error: "Reminder not found." });
      }

      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Reminder not found." });
    }

    res.json({ alarm: data });
  } catch (error) {
    console.error("Update alarm error:", error);
    res.status(500).json({ error: "Could not update reminder." });
  }
});

app.get("/api/projects", requireLogin, (req, res) => {
  listTableRows(res, "projects", "projects");
});

app.post("/api/projects", requireRole(...ADMIN_ROLES), (req, res) => {
  const name = cleanText(req.body.name);

  if (!name) {
    return res.status(400).json({ error: "Project name is required." });
  }

  insertTableRow(res, "projects", "project", {
    name,
    progress: clampProgress(req.body.progress),
    lead: cleanText(req.body.lead),
    status: cleanText(req.body.status, "Pending") || "Pending",
    blocker: cleanText(req.body.blocker),
  });
});

app.patch("/api/projects/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};

  for (const field of ["name", "lead", "status", "blocker"]) {
    if (hasBodyField(req.body, field)) {
      payload[field] = cleanText(req.body[field]);
    }
  }

  if (hasBodyField(req.body, "progress")) {
    payload.progress = clampProgress(req.body.progress);
  }

  updateTableRow(res, "projects", "project", req.params.id, payload);
});

app.delete("/api/projects/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "projects", req.params.id);
});

app.get("/api/partners", requireLogin, (req, res) => {
  listTableRows(res, "partners", "partners");
});

app.post("/api/partners", requireRole(...ADMIN_ROLES), (req, res) => {
  const name = cleanText(req.body.name);

  if (!name) {
    return res.status(400).json({ error: "Partner name is required." });
  }

  insertTableRow(res, "partners", "partner", {
    name,
    email: cleanText(req.body.email),
    phone: cleanText(req.body.phone),
    last_contact: cleanText(req.body.lastContact),
    milestone: cleanText(req.body.milestone),
    next_step: cleanText(req.body.nextStep),
  });
});

app.patch("/api/partners/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};
  const fieldMap = {
    name: "name",
    email: "email",
    phone: "phone",
    lastContact: "last_contact",
    milestone: "milestone",
    nextStep: "next_step",
    draft: "draft",
  };

  for (const [sourceField, targetField] of Object.entries(fieldMap)) {
    if (hasBodyField(req.body, sourceField)) {
      payload[targetField] = cleanText(req.body[sourceField]);
    }
  }

  updateTableRow(res, "partners", "partner", req.params.id, payload);
});

app.delete("/api/partners/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "partners", req.params.id);
});

app.get("/api/activities", requireLogin, (req, res) => {
  listTableRows(res, "activities", "activities");
});

app.post("/api/activities", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);

  if (!title) {
    return res.status(400).json({ error: "Activity title is required." });
  }

  insertTableRow(res, "activities", "activity", {
    title,
    time: cleanText(req.body.time),
    location: cleanText(req.body.location),
  });
});

app.patch("/api/activities/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};

  for (const field of ["title", "time", "location"]) {
    if (hasBodyField(req.body, field)) {
      payload[field] = cleanText(req.body[field]);
    }
  }

  updateTableRow(res, "activities", "activity", req.params.id, payload);
});

app.delete("/api/activities/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "activities", req.params.id);
});

app.get("/api/operations", requireLogin, (req, res) => {
  listTableRows(res, "operations", "operations");
});

app.post("/api/operations", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);

  if (!title) {
    return res.status(400).json({ error: "Operation title is required." });
  }

  const dueAt = toIsoDate(req.body.due_at || req.body.deadline || req.body.detail);
  const payload = {
    area: cleanText(req.body.area, "Operations") || "Operations",
    title,
    detail: cleanText(req.body.detail),
    severity: cleanText(req.body.severity, "Medium") || "Medium",
    status: cleanText(req.body.status, "Open") || "Open",
  };

  if (dueAt) {
    payload.due_at = dueAt;
  }

  insertTableRow(res, "operations", "operation", payload);
});

app.patch("/api/operations/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};

  for (const field of ["area", "title", "detail", "severity", "status", "due_at"]) {
    if (hasBodyField(req.body, field)) {
      payload[field] =
        field === "due_at"
          ? toIsoDate(req.body[field]) || null
          : cleanText(req.body[field]);
    }
  }

  updateTableRow(res, "operations", "operation", req.params.id, payload);
});

app.delete("/api/operations/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "operations", req.params.id);
});

app.get("/api/tasks", requireLogin, async (req, res) => {
  const currentUserEmail = getCurrentUserEmail(req);

  try {
    let query = supabaseAdmin
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (currentUserEmail) {
      query = query.eq("created_by", currentUserEmail);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ tasks: [] });
      }

      throw error;
    }

    res.json({ tasks: data || [] });
  } catch (error) {
    console.error("Load tasks error:", error);
    res.status(500).json({ error: "Could not load tasks." });
  }
});

app.post("/api/tasks", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);

  if (!title) {
    return res.status(400).json({ error: "Task title is required." });
  }

  insertTableRow(res, "tasks", "task", {
    title,
    detail: cleanText(req.body.detail),
    owner: cleanText(req.body.owner),
    deadline: cleanText(req.body.deadline),
    priority: cleanText(req.body.priority, "Medium") || "Medium",
    status: cleanText(req.body.status, "Open") || "Open",
    source_type: cleanText(req.body.source_type),
    source_id: req.body.source_id || null,
    created_by: getCurrentUserEmail(req),
  });
});

app.patch("/api/tasks/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};

  for (const field of ["title", "detail", "owner", "deadline", "priority", "status", "source_type"]) {
    if (hasBodyField(req.body, field)) {
      payload[field] = cleanText(req.body[field]);
    }
  }

  if (hasBodyField(req.body, "source_id")) {
    payload.source_id = req.body.source_id || null;
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString();
  }

  updateTableRow(res, "tasks", "task", req.params.id, payload);
});

app.delete("/api/tasks/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  const currentUserEmail = getCurrentUserEmail(req);

  try {
    let query = supabaseAdmin.from("tasks").delete().eq("id", req.params.id);

    if (currentUserEmail) {
      query = query.eq("created_by", currentUserEmail);
    }

    const { error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ success: true });
      }

      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ error: "Could not delete task." });
  }
});

app.get("/api/calendar-events", requireLogin, async (req, res) => {
  try {
    const currentUserEmail = getCurrentUserEmail(req);
    const [
      savedEventsResult,
      meetingsResult,
      alarmsResult,
      operationsResult,
      activitiesResult,
      transcriptsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("calendar_events")
        .select("*")
        .order("start_at", { ascending: true }),
      supabaseAdmin.from("meetings").select("*"),
      supabaseAdmin.from("alarms").select("*"),
      supabaseAdmin.from("operations").select("*"),
      supabaseAdmin.from("activities").select("*"),
      supabaseAdmin
        .from("meeting_transcripts")
        .select("id,title,created_at,updated_at,created_by"),
    ]);

    if (savedEventsResult.error && !isMissingTableError(savedEventsResult.error)) {
      throw savedEventsResult.error;
    }

    const savedEvents = savedEventsResult.data || [];
    const sourceEvents = [
      ...(meetingsResult.data || []).map((meeting) =>
        calendarSourceEvent({
          id: meeting.id,
          title: meeting.title || "Meeting",
          description: meeting.briefing,
          eventType: "meeting",
          category: "Meetings",
          startAt: meeting.time || meeting.created_at,
          endAt: "",
          location: meeting.location,
          status: meeting.minutes ? "Prepared" : "Scheduled",
          sourceType: "meeting",
        })
      ),
      ...(alarmsResult.data || [])
        .filter(
          (alarm) =>
            !currentUserEmail ||
            !alarm.created_by ||
            normalizeEmail(alarm.created_by) === currentUserEmail
        )
        .map((alarm) =>
          calendarSourceEvent({
            id: alarm.id,
            title: alarm.title || "Reminder",
            description: alarm.notes,
            eventType: "alarm",
            category: "Reminders",
            startAt: alarm.due_at || alarm.reminder_time || alarm.created_at,
            status: alarm.status || "Pending",
            sourceType: "alarm",
          })
        ),
      ...(operationsResult.data || []).map((operation) =>
        calendarSourceEvent({
          id: operation.id,
          title: operation.title || "Operation",
          description: operation.detail,
          eventType: "operation",
          category: operation.area || "Operations",
          startAt: operation.created_at,
          status: operation.status || "Open",
          sourceType: "operation",
        })
      ),
      ...(activitiesResult.data || []).map((activity) =>
        calendarSourceEvent({
          id: activity.id,
          title: activity.title || "Activity",
          eventType: "activity",
          category: "Church Activities",
          startAt: activity.time || activity.created_at,
          location: activity.location,
          status: "Scheduled",
          sourceType: "activity",
        })
      ),
      ...(transcriptsResult.data || [])
        .filter(
          (transcript) =>
            !currentUserEmail ||
            !transcript.created_by ||
            normalizeEmail(transcript.created_by) === currentUserEmail
        )
        .map((transcript) =>
          calendarSourceEvent({
            id: transcript.id,
            title: transcript.title || "Transcript",
            eventType: "transcript",
            category: "Transcripts",
            startAt: transcript.created_at,
            status: "Saved",
            sourceType: "transcript",
          })
        ),
    ];

    res.json({
      events: [...savedEvents, ...sourceEvents].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      ),
    });
  } catch (error) {
    console.error("Calendar events error:", error);
    res.status(500).json({ error: "Could not load calendar events." });
  }
});

app.post("/api/calendar-events", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);
  const startAt = toIsoDate(req.body.start_at || req.body.startAt);
  const endAt = toIsoDate(req.body.end_at || req.body.endAt);

  if (!title || !startAt) {
    return res
      .status(400)
      .json({ error: "Event title and start time are required." });
  }

  insertTableRow(res, "calendar_events", "event", {
    title,
    description: cleanText(req.body.description),
    event_type: cleanText(req.body.event_type || req.body.eventType, "event"),
    category: cleanText(req.body.category, "General") || "General",
    start_at: startAt,
    end_at: endAt || null,
    all_day: Boolean(req.body.all_day || req.body.allDay),
    location: cleanText(req.body.location),
    status: cleanText(req.body.status, "Scheduled") || "Scheduled",
    source_type: cleanText(req.body.source_type || req.body.sourceType),
    source_id: req.body.source_id || req.body.sourceId || null,
    created_by: getCurrentUserEmail(req),
    metadata:
      req.body.metadata && typeof req.body.metadata === "object"
        ? req.body.metadata
        : {},
  });
});

app.patch("/api/calendar-events/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  const payload = {};
  const fieldMap = {
    title: "title",
    description: "description",
    event_type: "event_type",
    eventType: "event_type",
    category: "category",
    location: "location",
    status: "status",
    source_type: "source_type",
    sourceType: "source_type",
  };

  for (const [sourceField, targetField] of Object.entries(fieldMap)) {
    if (hasBodyField(req.body, sourceField)) {
      payload[targetField] = cleanText(req.body[sourceField]);
    }
  }

  if (hasBodyField(req.body, "start_at") || hasBodyField(req.body, "startAt")) {
    payload.start_at = toIsoDate(req.body.start_at || req.body.startAt);
  }

  if (hasBodyField(req.body, "end_at") || hasBodyField(req.body, "endAt")) {
    payload.end_at = toIsoDate(req.body.end_at || req.body.endAt) || null;
  }

  if (hasBodyField(req.body, "all_day") || hasBodyField(req.body, "allDay")) {
    payload.all_day = Boolean(req.body.all_day || req.body.allDay);
  }

  if (hasBodyField(req.body, "source_id") || hasBodyField(req.body, "sourceId")) {
    payload.source_id = req.body.source_id || req.body.sourceId || null;
  }

  if (hasBodyField(req.body, "metadata") && typeof req.body.metadata === "object") {
    payload.metadata = req.body.metadata;
  }

  payload.updated_at = new Date().toISOString();
  updateTableRow(res, "calendar_events", "event", req.params.id, payload);
});

app.delete("/api/calendar-events/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "calendar_events", req.params.id);
});

function buildFallbackSchedulePlan(command) {
  const startDate = parseDateTimeLike(command);
  const title = inferMeetingTitle(command);
  const durationMinutes = parseDurationMinutes(command);

  return {
    title,
    description: command,
    event_type: "meeting",
    category: "Meetings",
    start_at: startDate ? startDate.toISOString() : "",
    end_at: startDate ? addMinutes(startDate, durationMinutes).toISOString() : "",
    location: "",
    create_meeting: true,
    alarm_minutes_before: meetingAlarmMinutesBefore({}, command, Boolean(startDate)),
    needs_clarification: startDate ? [] : ["start_at"],
    summary: startDate
      ? `Scheduled ${title}.`
      : "I need a date and time before scheduling this meeting.",
  };
}

app.post("/api/calendar/assistant", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const command = cleanText(req.body.command || req.body.message);

    if (!command) {
      return res.status(400).json({ error: "Schedule command is required." });
    }

    const existingEvents = await listRecentRows("calendar_events", 80);
    let parsed = null;

    try {
      const reply = await askAI(`
You are the AI Schedule Assistant for Executive Virtual AI Assistant.
Return JSON only. No markdown.
Current date/time: ${new Date().toISOString()}
${currentDateContextForPrompt()}

Parse this schedule request:
${command}

Existing events:
${JSON.stringify(existingEvents)}

Return:
{
  "title": "Partnership review",
  "description": "Short notes",
  "event_type": "meeting",
  "category": "Meetings",
  "start_at": "ISO timestamp",
  "end_at": "ISO timestamp",
  "location": "",
  "create_meeting": true,
  "alarm_minutes_before": 15,
  "needs_clarification": [],
  "summary": "Short summary"
}

If a required date/time is missing, put that field in needs_clarification.
    `);
      parsed = parseJsonObject(reply);
    } catch (error) {
      console.warn("Schedule AI parser fallback:", error);
      parsed = buildFallbackSchedulePlan(command);
    }

    const fallbackParsed = buildFallbackSchedulePlan(command);
    const fallbackHasStart = Boolean(fallbackParsed.start_at);
    parsed = {
      ...fallbackParsed,
      ...parsed,
      title: cleanText(parsed.title) || fallbackParsed.title,
      description: cleanText(parsed.description) || fallbackParsed.description,
      start_at: fallbackHasStart
        ? fallbackParsed.start_at
        : cleanText(parsed.start_at) || fallbackParsed.start_at,
      end_at: fallbackHasStart
        ? fallbackParsed.end_at
        : cleanText(parsed.end_at) || fallbackParsed.end_at,
      alarm_minutes_before:
        parsed.alarm_minutes_before ?? fallbackParsed.alarm_minutes_before,
      needs_clarification: fallbackParsed.start_at
        ? []
        : Array.isArray(parsed.needs_clarification) &&
            parsed.needs_clarification.length > 0
          ? parsed.needs_clarification
          : fallbackParsed.needs_clarification,
    };
    const missing = Array.isArray(parsed.needs_clarification)
      ? parsed.needs_clarification
      : [];
    const startAt = toIsoDate(parsed.start_at);

    if (!cleanText(parsed.title) || !startAt || missing.length > 0) {
      return res.status(400).json({
        summary: "I need more schedule details before creating this event.",
        missing: missing.length ? missing : ["title", "start_at"],
      });
    }

    const startDate = new Date(startAt);
    const endDate = parseDateLike(parsed.end_at) || addMinutes(startDate, 60);
    const clashes = existingEvents.filter((event) => {
      const eventStart = parseDateLike(event.start_at);
      const eventEnd = parseDateLike(event.end_at) || eventStart;

      if (!eventStart || !eventEnd) {
        return false;
      }

      return startDate < eventEnd && endDate > eventStart;
    });
    const suggestion = clashes[0]
      ? addMinutes(parseDateLike(clashes[0].end_at) || endDate, 30).toISOString()
      : "";
    const calendarEvent = await insertCommandRecord("calendar_events", {
      title: cleanText(parsed.title),
      description: cleanText(parsed.description) || command,
      event_type: cleanText(parsed.event_type, "meeting") || "meeting",
      category: cleanText(parsed.category, "Meetings") || "Meetings",
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      location: cleanText(parsed.location),
      status: clashes.length ? "Scheduled - Clash" : "Scheduled",
      created_by: getCurrentUserEmail(req),
      metadata: {
        command,
        clashes: clashes.map((event) => ({
          id: event.id,
          title: event.title,
          start_at: event.start_at,
          end_at: event.end_at,
        })),
        suggested_start_at: suggestion,
      },
    });
    let meeting = null;
    let alarm = null;

    if (parsed.create_meeting !== false) {
      meeting = await insertCommandRecord("meetings", {
        title: cleanText(parsed.title),
        time: startDate.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        duration: `${Math.max(15, Math.round((endDate - startDate) / 60_000))} minutes`,
        location: cleanText(parsed.location),
        briefing: cleanText(parsed.description) || command,
        attendees: [],
      });
    }

    const alarmMinutes = Number.parseInt(parsed.alarm_minutes_before, 10);

    if (!Number.isNaN(alarmMinutes) && alarmMinutes > 0) {
      const alarmAt = addMinutes(startDate, -alarmMinutes);

      alarm = await insertCommandRecord("alarms", {
        title: `${cleanText(parsed.title)} Reminder`,
        reminder_time: `${alarmMinutes} minutes before ${cleanText(parsed.title)}`,
        due_at: alarmAt.toISOString(),
        related_type: meeting ? "meeting" : "calendar_event",
        related_id: meeting?.id || calendarEvent.id,
        notes: command,
        status: "Pending",
        created_by: getCurrentUserEmail(req),
      });
    }

    res.status(201).json({
      summary:
        parsed.summary ||
        (clashes.length
          ? "Event created, but it overlaps another event."
          : "Event scheduled."),
      event: calendarEvent,
      meeting,
      alarm,
      clashes,
      suggested_start_at: suggestion,
    });
  } catch (error) {
    console.error("Schedule assistant error:", error);
    res.status(500).json({ error: "Could not schedule from AI command." });
  }
});

app.get("/api/approvals", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const [requestsResult, draftsResult, alertsResult] = await Promise.all([
      supabaseAdmin
        .from("approval_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("email_drafts")
        .select("*")
        .in("status", ["Draft", "Pending", "Needs Approval"])
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("alerts")
        .select("*")
        .eq("status", "Open")
        .order("created_at", { ascending: false }),
    ]);

    if (requestsResult.error && !isMissingTableError(requestsResult.error)) {
      throw requestsResult.error;
    }

    const requestItems = (requestsResult.data || []).map((item) => ({
      id: item.id,
      source: "approval_request",
      item_type: item.item_type,
      title: item.title,
      summary: item.summary,
      status: item.status,
      priority: item.priority,
      payload: item.payload,
      created_at: item.created_at,
    }));
    const draftItems = (draftsResult.data || []).map((draft) => ({
      id: draft.id,
      source: "email_draft",
      item_type: "email_draft",
      title: draft.subject || draft.title || "Email draft",
      summary: draft.body,
      status: "Pending",
      priority: "Medium",
      payload: draft,
      created_at: draft.created_at,
    }));
    const alertItems = (alertsResult.data || [])
      .filter((alert) => alert.severity === "High")
      .map((alert) => ({
        id: alert.id,
        source: "alert",
        item_type: "operation_alert",
        title: alert.title,
        summary: alert.detail,
        status: "Pending",
        priority: alert.severity,
        payload: alert,
        created_at: alert.created_at,
      }));

    res.json({
      approvals: [...requestItems, ...draftItems, ...alertItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    });
  } catch (error) {
    console.error("Approvals error:", error);
    res.status(500).json({ error: "Could not load approvals." });
  }
});

app.post("/api/approvals", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);
  const itemType = cleanText(req.body.item_type || req.body.itemType);

  if (!title || !itemType) {
    return res
      .status(400)
      .json({ error: "Approval title and item type are required." });
  }

  insertTableRow(res, "approval_requests", "approval", {
    item_type: itemType,
    item_id: req.body.item_id || req.body.itemId || null,
    title,
    summary: cleanText(req.body.summary),
    status: cleanText(req.body.status, "Pending") || "Pending",
    priority: cleanText(req.body.priority, "Medium") || "Medium",
    payload:
      req.body.payload && typeof req.body.payload === "object"
        ? req.body.payload
        : {},
    requested_by: getCurrentUserEmail(req),
  });
});

app.patch("/api/approvals/:source/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const status = cleanText(req.body.status, "Approved") || "Approved";
    const notes = cleanText(req.body.notes);
    const source = cleanText(req.params.source);
    const id = req.params.id;
    let result = null;

    if (source === "approval_request") {
      const { data, error } = await supabaseAdmin
        .from("approval_requests")
        .update({
          status,
          approval_notes: notes,
          reviewed_by: getCurrentUserEmail(req),
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      result = data;
    } else if (source === "email_draft") {
      const { data, error } = await supabaseAdmin
        .from("email_drafts")
        .update({
          status: status === "Rejected" ? "Rejected" : "Approved",
          approved_at: status === "Rejected" ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      result = data;
    } else if (source === "alert") {
      const { data, error } = await supabaseAdmin
        .from("alerts")
        .update({
          status: status === "Rejected" ? "Rejected" : "Approved",
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      result = data;
    } else {
      return res.status(400).json({ error: "Unsupported approval source." });
    }

    res.json({ approval: result, status });
  } catch (error) {
    console.error("Update approval error:", error);
    res.status(500).json({ error: "Could not update approval." });
  }
});

app.get("/api/partners/:id/timeline", requireLogin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("partner_timeline")
      .select("*")
      .eq("partner_id", req.params.id)
      .order("event_date", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ timeline: [] });
      }

      throw error;
    }

    res.json({ timeline: data || [] });
  } catch (error) {
    console.error("Partner timeline error:", error);
    res.status(500).json({ error: "Could not load partner timeline." });
  }
});

app.post("/api/partners/:id/timeline", requireRole(...ADMIN_ROLES), (req, res) => {
  const title = cleanText(req.body.title);

  if (!title) {
    return res.status(400).json({ error: "Timeline title is required." });
  }

  insertTableRow(res, "partner_timeline", "timelineItem", {
    partner_id: req.params.id,
    event_type: cleanText(req.body.event_type || req.body.eventType, "note"),
    title,
    detail: cleanText(req.body.detail),
    contribution_amount:
      req.body.contribution_amount || req.body.contributionAmount || null,
    contribution_currency:
      cleanText(req.body.contribution_currency || req.body.contributionCurrency, "USD") ||
      "USD",
    event_date: toIsoDate(req.body.event_date || req.body.eventDate) ||
      new Date().toISOString(),
    source_type: cleanText(req.body.source_type || req.body.sourceType),
    source_id: req.body.source_id || req.body.sourceId || null,
    created_by: getCurrentUserEmail(req),
    metadata:
      req.body.metadata && typeof req.body.metadata === "object"
        ? req.body.metadata
        : {},
  });
});

app.delete("/api/partners/:partnerId/timeline/:id", requireRole(...ADMIN_ROLES), (req, res) => {
  deleteTableRow(res, "partner_timeline", req.params.id);
});

/* =========================
   MEETING TRANSCRIPTS
========================= */

function getCurrentUserEmail(req) {
  return normalizeEmail(req.session.user?.email);
}

const TRANSCRIPT_COLUMNS =
  "id,title,transcript_text,edited_text,created_by,created_at,is_final,updated_at";

function formatTranscript(row) {
  return {
    ...row,
    transcript: row.edited_text || row.transcript_text || "",
  };
}

app.get("/api/transcripts", requireRole(...ADMIN_ROLES), async (req, res) => {
  const currentUserEmail = getCurrentUserEmail(req);

  if (!currentUserEmail) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const { data, error } = await supabaseAdmin
    .from("meeting_transcripts")
    .select(TRANSCRIPT_COLUMNS)
    .eq("created_by", currentUserEmail)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return res.json({ transcripts: [] });
    }

    console.error("Load transcripts error:", error);
    return res.status(500).json({ error: "Could not load transcripts." });
  }

  res.json({ transcripts: (data || []).map(formatTranscript) });
});

app.post("/api/transcripts", requireRole(...ADMIN_ROLES), async (req, res) => {
  const currentUserEmail = getCurrentUserEmail(req);
  const title = cleanText(req.body.title) || "Untitled transcript";
  const transcript = cleanText(req.body.transcript);

  if (!currentUserEmail) {
    return res.status(401).json({ error: "Not logged in" });
  }

  if (!transcript) {
    return res.status(400).json({ error: "Transcript text is required." });
  }

  const { data, error } = await supabaseAdmin
    .from("meeting_transcripts")
    .insert({
      title,
      transcript_text: transcript,
      edited_text: transcript,
      created_by: currentUserEmail,
      is_final: true,
    })
    .select(TRANSCRIPT_COLUMNS)
    .single();

  if (error) {
    console.error("Save transcript error:", error);
    return res.status(500).json({ error: "Could not save transcript." });
  }

  res.status(201).json({ transcript: formatTranscript(data) });
});

app.put("/api/transcripts/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
  const currentUserEmail = getCurrentUserEmail(req);
  const title = cleanText(req.body.title) || "Untitled transcript";
  const transcript = cleanText(req.body.transcript);

  if (!currentUserEmail) {
    return res.status(401).json({ error: "Not logged in" });
  }

  if (!transcript) {
    return res.status(400).json({ error: "Transcript text is required." });
  }

  const { data, error } = await supabaseAdmin
    .from("meeting_transcripts")
    .update({
      title,
      edited_text: transcript,
      is_final: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .eq("created_by", currentUserEmail)
    .select(TRANSCRIPT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Update transcript error:", error);
    return res.status(500).json({ error: "Could not update transcript." });
  }

  if (!data) {
    return res.status(404).json({ error: "Transcript not found." });
  }

  res.json({ transcript: formatTranscript(data) });
});

function normalizeExtractedList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeExtractedTitle(item, fallback) {
  if (typeof item === "string") {
    return cleanText(item, fallback);
  }

  return cleanText(item?.title) || cleanText(item?.task) || fallback;
}

function normalizeExtractedDetail(item) {
  if (typeof item === "string") {
    return item;
  }

  return cleanText(item?.detail) || cleanText(item?.notes) || cleanText(item?.description);
}

app.post(
  "/api/transcripts/:id/extract-actions",
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const currentUserEmail = getCurrentUserEmail(req);

    try {
      const { data: transcript, error: transcriptError } = await supabaseAdmin
        .from("meeting_transcripts")
        .select(TRANSCRIPT_COLUMNS)
        .eq("id", req.params.id)
        .eq("created_by", currentUserEmail)
        .maybeSingle();

      if (transcriptError) {
        throw transcriptError;
      }

      if (!transcript) {
        return res.status(404).json({ error: "Transcript not found." });
      }

      const text = transcript.edited_text || transcript.transcript_text || "";
      const reply = await askAI(`
Extract operational follow-up data from this transcript.
Return JSON only. Do not include markdown.

Required shape:
{
  "decisions": ["..."],
  "action_items": [
    {
      "title": "...",
      "detail": "...",
      "owner": "...",
      "deadline": "...",
      "priority": "Medium"
    }
  ],
  "risks": [
    {
      "title": "...",
      "detail": "...",
      "priority": "High"
    }
  ],
  "follow_ups": [
    {
      "title": "...",
      "detail": "...",
      "owner": "...",
      "deadline": "..."
    }
  ],
  "alarms": [
    {
      "title": "...",
      "reminder_time": "...",
      "notes": "..."
    }
  ]
}

Transcript:
${text}
      `);
      const extracted = parseJsonObject(reply);
      const decisions = normalizeExtractedList(extracted.decisions);
      const actionItems = normalizeExtractedList(extracted.action_items);
      const risks = normalizeExtractedList(extracted.risks);
      const followUps = normalizeExtractedList(extracted.follow_ups);
      const extractedAlarms = normalizeExtractedList(extracted.alarms);
      const taskPayloads = [...actionItems, ...risks, ...followUps]
        .map((item, index) => ({
          title: normalizeExtractedTitle(item, `Transcript action ${index + 1}`),
          detail: normalizeExtractedDetail(item),
          owner: typeof item === "object" ? cleanText(item.owner) : "",
          deadline:
            typeof item === "object"
              ? cleanText(item.deadline) || cleanText(item.due)
              : "",
          priority:
            typeof item === "object"
              ? normalizeActionSeverity(item.priority || item.severity)
              : "Medium",
          status: "Open",
          source_type: "transcript",
          source_id: transcript.id,
          created_by: currentUserEmail,
        }))
        .filter((item) => item.title);
      const alarmPayloads = extractedAlarms
        .map((item, index) => ({
          title: normalizeExtractedTitle(item, `Transcript reminder ${index + 1}`),
          reminder_time:
            typeof item === "object"
              ? cleanText(item.reminder_time) || cleanText(item.deadline)
              : "",
          notes: normalizeExtractedDetail(item),
          related_type: "transcript",
          related_id: transcript.id,
          status: "Pending",
          created_by: currentUserEmail,
        }))
        .filter((item) => item.title && item.reminder_time);
      const [{ data: tasks, error: taskError }, { data: alarms, error: alarmError }] =
        await Promise.all([
          taskPayloads.length
            ? supabaseAdmin.from("tasks").insert(taskPayloads).select("*")
            : { data: [], error: null },
          alarmPayloads.length
            ? supabaseAdmin.from("alarms").insert(alarmPayloads).select("*")
            : { data: [], error: null },
        ]);

      if (taskError) {
        throw taskError;
      }

      if (alarmError) {
        throw alarmError;
      }

      res.json({
        decisions,
        tasks: tasks || [],
        alarms: alarms || [],
        risks,
        followUps,
      });
    } catch (error) {
      console.error("Extract transcript actions error:", error);
      res.status(500).json({ error: "Could not extract transcript actions." });
    }
  }
);

app.post(
  "/api/transcription-sessions",
  requireRole(...ADMIN_ROLES),
  (req, res) => {
    const ticket = randomUUID();
    const requestedSampleRate = Number.parseInt(req.body.sampleRate, 10);
    const sampleRate = Number.isNaN(requestedSampleRate)
      ? 48000
      : Math.min(48000, Math.max(8000, requestedSampleRate));

    transcriptionTickets.set(ticket, {
      user: req.session.user,
      sampleRate,
      expiresAt: Date.now() + 60_000,
    });

    res.json({ ticket });
  }
);

/* =========================
   MULTI-INTENT COMMAND ENGINE
========================= */

const COMMAND_ACTION_TYPES = [
  "meeting",
  "alarm",
  "operation_alert",
  "email_draft",
  "report",
  "transcript_summary",
  "briefing",
  "task",
  "partner",
  "general_ai",
];

const WRITE_COMMAND_TYPES = new Set([
  "meeting",
  "alarm",
  "operation_alert",
  "email_draft",
  "task",
  "partner",
]);

const SUCCESS_COMMAND_STATUSES = new Set([
  "created",
  "already_exists",
  "drafted",
  "generated",
  "completed",
]);

function normalizeNoOpCommand(command) {
  return cleanText(command)
    .toLowerCase()
    .replace(/\b(ready|okay|ok)\.?\s*(i\s+am|i'm)?\s*listening\.?/g, " ")
    .replace(/\b(i\s+am|i'm)\s+listening\.?/g, " ")
    .replace(/\bvoice\s+agent\s+ready\.?/g, " ")
    .replace(/\bpress\s+start\s+voice\s+agent\s+and\s+speak\s+naturally\b/g, " ")
    .replace(
      /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/g,
      " "
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCasualNoOpCommand(command) {
  const normalized = normalizeNoOpCommand(command);

  return !normalized;
}

function normalizeCommandType(type) {
  const normalized = String(type || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  const aliases = {
    alert: "operation_alert",
    operation: "operation_alert",
    operations_alert: "operation_alert",
    reminder: "alarm",
    email: "email_draft",
    draft_email: "email_draft",
    partnership: "partner",
    vendor: "partner",
    sponsor: "partner",
    ai: "general_ai",
    answer: "general_ai",
  };

  return aliases[normalized] || normalized;
}

function commandActionTitle(action, fallback) {
  return (
    cleanText(action.title) ||
    cleanText(action.data?.title) ||
    cleanText(action.data?.name) ||
    fallback
  );
}

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJsonObject(text) {
  const clean = stripJsonFence(text);

  try {
    return JSON.parse(clean);
  } catch {
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("AI did not return a JSON object.");
    }

    return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
  }
}

function isCommandModifierClause(clause) {
  return /^(?:and\s+)?(?:(?:the\s+)?(?:area|category|department|operations?)\s+(?:should\s+be|is|as)\s+.+|(?:make\s+it|set\s+it\s+as|level\s+should\s+be|priority\s+should\s+be|severity\s+should\s+be)\s+(?:high|medium|low|urgent|critical).*)$/i.test(
    cleanText(clause)
  );
}

function splitCommandClauses(command) {
  const parts = String(command || "")
    .replace(/\s+/g, " ")
    .replace(
      /,\s+(?=(?:and\s+)?(?:also\s+|then\s+)?(?:(?:a|an|the)\s+)?(?:create|add|schedule|book|set up|set|start|mark|draft|prepare|summarize|remind|reply|write))/gi,
      ". "
    )
    .replace(
      /\s+and\s+(?=(?:also\s+|then\s+)?(?:(?:a|an|the)\s+)?(?:create|add|schedule|book|set up|set|start|mark|draft|prepare|summarize|remind|reply|write))/gi,
      ". "
    )
    .replace(/\b(and also|also|then)\b/gi, ". ")
    .split(/[.;\n]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  return parts.reduce((clauses, clause) => {
    if (clauses.length > 0 && isCommandModifierClause(clause)) {
      clauses[clauses.length - 1] = `${clauses.at(-1)}. ${clause}`;
    } else {
      clauses.push(clause);
    }

    return clauses;
  }, []);
}

function parseSimpleTime(command) {
  const timeMatch = String(command || "").match(
    /\b((?:[01]?\d|2[0-3]):[0-5]\d\s*(?:am|pm)?|(?:1[0-2]|0?\d)\s*(?:am|pm))\b/i
  );

  if (timeMatch) {
    return timeMatch[1].replace(/\s+/g, " ").toUpperCase();
  }

  const spokenMatch = String(command || "").match(
    /\b(?:at|by|for)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s?(am|pm)?\b/i
  );
  const wordNumbers = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
  };

  if (spokenMatch) {
    const hour = wordNumbers[spokenMatch[1].toLowerCase()] || spokenMatch[1];
    const suffix = spokenMatch[2] ? ` ${spokenMatch[2].toUpperCase()}` : "";

    return `${hour}:00${suffix}`;
  }

  return "";
}

function inferMeetingTime(command) {
  return [
    /\btomorrow\b/i.test(command) ? "Tomorrow" : "",
    /\btoday\b/i.test(command) ? "Today" : "",
    parseSimpleTime(command),
  ]
    .filter(Boolean)
    .join(", ");
}

function inferMeetingTitle(command) {
  const cleanCommand = cleanText(command);
  const directMatch = cleanCommand.match(
    /\b(?:create|add|schedule|book|set up)\s+(?:a\s+)?(.+?\bmeeting)\b/i
  );
  const withMatch = cleanCommand.match(
    /\bmeeting\s+with\s+(.+?)(?:\s+(?:tomorrow|today|at|by|for|on)\b|[,.;]|$)/i
  );

  if (directMatch) {
    return directMatch[1].replace(/^(a|an|the)\s+/i, "").trim();
  }

  if (withMatch) {
    return `Meeting with ${withMatch[1].trim()}`;
  }

  return "New Meeting";
}

function hasMeetingIntent(command) {
  const cleanCommand = cleanText(command);
  const isReminderOnly =
    hasReminderIntent(cleanCommand) &&
    !/\b(create|add|schedule|book|set up)\b/i.test(cleanCommand);

  if (isReminderOnly) {
    return false;
  }

  return (
    /\b(create|add|schedule|book|set up)\b.*\bmeeting\b/i.test(cleanCommand) ||
    (/\bmeeting\s+with\b/i.test(cleanCommand) && !hasReminderIntent(cleanCommand))
  );
}

function inferReminderTime(command) {
  const cleanCommand = cleanText(command);
  const relativeMatch = cleanCommand.match(
    /\b(\d+\s*(?:minutes?|mins?|hours?|days?)\s+before(?:\s+[^,.;]+)?)\b/i
  );

  if (relativeMatch) {
    return relativeMatch[1].replace(/\s+/g, " ").trim();
  }

  const simpleTime = parseSimpleTime(cleanCommand);

  if (simpleTime) {
    return simpleTime;
  }

  const directMatch = cleanCommand.match(
    /\b(?:remind\s+me|set\s+(?:a|an)?\s*(?:alert|alarm)|create\s+(?:a|an)?\s*(?:alert|alarm)|add\s+(?:a|an)?\s*(?:alert|alarm))\s+(?:for|at|by)\s+(.+?)(?:\s+(?:for|about|to)\b|$)/i
  );

  return cleanText(directMatch?.[1]);
}

function hasReminderIntent(command) {
  return (
    /\b(remind|reminder|alarm)\b/i.test(command) ||
    /\b(?:set|create|add)\s+(?:a|an)?\s*alert\b/i.test(command)
  );
}

function hasTimedReminderIntent(command) {
  return hasReminderIntent(command) && Boolean(inferReminderTime(command));
}

function inferReminderTitle(command) {
  if (hasMeetingIntent(command)) {
    const meetingTitle = inferMeetingTitle(command);

    if (meetingTitle && meetingTitle !== "New Meeting") {
      return `${meetingTitle} Reminder`;
    }
  }

  const meetingMatch = cleanText(command).match(
    /\bmeeting\s+with\s+(.+?)(?:\s+(?:tomorrow|today|at|by|for|on)\b|[,.;]|$)/i
  );

  if (meetingMatch) {
    return `Meeting with ${meetingMatch[1].trim()} Reminder`;
  }

  return inferRecordTitle(command, "Reminder")
    .replace(/^remind\s+me\s+(?:to\s+)?/i, "")
    .replace(/^alert\s+(?:for|at|by)\s+/i, "")
    .replace(/^alarm\s+(?:for|at|by)\s+/i, "")
    .trim() || "Reminder";
}

function inferSeverity(command, fallback = "Medium") {
  if (/\b(high|high risk|high priority|urgent|critical|top priority)\b/i.test(command)) {
    return "High";
  }

  if (/\blow\b/i.test(command)) {
    return "Low";
  }

  return fallback;
}

function formatDateForTask(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function extractDueText(command) {
  const match = cleanText(command).match(
    /\b(?:due(?:\s+date)?|deadline|by|on)\s*(?:should\s+be|is|for|at|to)?\s+(.+?)(?:\s+(?:priority|owner|status|severity|level)\b|[,.;]|$)/i
  );

  return cleanText(match?.[1]);
}

function inferTaskDeadline(command) {
  const dueText = extractDueText(command);
  const parsedDate = parseDateLike(dueText || command);

  if (parsedDate) {
    return formatDateForTask(parsedDate);
  }

  return dueText;
}

function cleanTaskTitleCandidate(value) {
  return cleanText(value)
    .replace(/\s+\b(?:with\s+deadline|due(?:\s+date)?|deadline|by|on)\b.+$/i, "")
    .replace(/\s+\b(?:priority|owner|detail|details|note|notes|status)\b.+$/i, "")
    .replace(/\b(?:for\s+)?me\b/gi, "")
    .replace(/\b(?:and\s+)?(?:the\s+)?$/i, "")
    .replace(/^(to|for)\s+/i, "")
    .trim();
}

function isGenericTaskTitle(title) {
  const normalized = cleanText(title).toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    /^(a|new|task|todo|to do|it|and|the)$/i.test(normalized) ||
    /\b(set|create|add|make|log)\s+(?:a\s+)?(?:task|todo|to do|action item)\s+(?:for\s+)?me\b/i.test(
      normalized
    ) ||
    /\b(i would love|i want|can you|could you|please)\b.*\b(task|todo|action item)\b/i.test(
      normalized
    )
  );
}

function inferTaskTitle(command) {
  const cleanCommand = cleanText(command);
  const titledMatch = cleanCommand.match(
    /\btask\s+(?:called|titled)\s+"?(.+?)"?(?:\s+(?:with\s+deadline|due|deadline|by|priority|owner)\b|[,.;]|$)/i
  );
  const todoMatch = cleanCommand.match(
    /\b(?:task|todo|to do|action item)\s+(?:to|for)?\s*(.+?)(?:\s+(?:with\s+deadline|due|deadline|by|priority|owner)\b|[,.;]|$)/i
  );
  const title = cleanTaskTitleCandidate(titledMatch?.[1] || todoMatch?.[1] || "");

  if (isGenericTaskTitle(title)) {
    return "";
  }

  return title;
}

function resolveTaskDeadline(data, command) {
  const rawDeadline =
    cleanText(data?.deadline) ||
    cleanText(data?.due) ||
    cleanText(data?.due_date) ||
    cleanText(data?.dueDate) ||
    cleanText(data?.due_at) ||
    cleanText(data?.dueAt) ||
    cleanText(data?.when);
  const parsedDate = parseDateLike(rawDeadline || extractDueText(command));

  if (parsedDate) {
    return formatDateForTask(parsedDate);
  }

  return rawDeadline || inferTaskDeadline(command);
}

function inferOperationArea(command) {
  const match = cleanText(command).match(
    /\b(?:area|category|department|operations?)\s+(?:should\s+be|is|as)\s+([a-z][a-z\s-]+?)(?:[,.;]|$)/i
  );

  return cleanText(match?.[1], "Operations") || "Operations";
}

function inferOperationAlertTitle(command, fallback = "Operational Alert") {
  const cleanCommand = cleanText(command);
  const markMatch = cleanCommand.match(
    /\bmark\s+(.+?)\s+as\s+(?:a\s+)?(?:high|medium|low|critical|urgent|top priority|high risk)\b/i
  );
  const alertMatch = cleanCommand.match(
    /\b(?:create|add|make|raise)\s+(?:a\s+)?(?:smart\s+)?alert\s*(?:for|about)?\s+(.+?)(?:\s+(?:as|make|level|severity|priority|area|category|department|operations?)\b|[,.;]|$)/i
  );
  const repairMatch = cleanCommand.match(
    /\b([a-z][a-z\s-]+?\b(?:repair|issue|risk|incident|outage|failure))\b/i
  );

  return (
    cleanText(markMatch?.[1]) ||
    cleanText(alertMatch?.[1]) ||
    cleanText(repairMatch?.[1]) ||
    fallback
  );
}

function inferRecordTitle(command, fallback) {
  return cleanText(command)
    .replace(/^(create|add|mark|make|set|draft|prepare|write)\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\b(as|to be|make it|set it as)\s+(high|low|medium).*/i, "")
    .replace(/\b(high risk|high priority|top priority|urgent|critical)\b/gi, "")
    .trim() || fallback;
}

function compactCommandDetail(detail, title, fallback) {
  const cleanDetail = cleanText(detail);
  const cleanTitle = cleanText(title);

  if (!cleanDetail) {
    return fallback || cleanTitle;
  }

  const clauses = splitCommandClauses(cleanDetail);
  const matchingClause = clauses.find((clause) => {
    const lowerClause = clause.toLowerCase();
    const titleWords = cleanTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    return titleWords.some((word) => lowerClause.includes(word));
  });

  return matchingClause || cleanDetail;
}

function hasOperationAlertIntent(clause) {
  const timedAlert = hasTimedReminderIntent(clause);
  const riskOrOperationsIntent =
    /\b(smart alert|risk|repair|issue|incident|outage|failure|operation|operations|urgent|critical)\b/i.test(
      clause
    );

  if (timedAlert && !riskOrOperationsIntent) {
    return false;
  }

  return /\b(smart alert|alert|risk|repair|issue|operation|operations|urgent|critical)\b/i.test(clause);
}

function buildMeetingAction(clause) {
  const title = inferMeetingTitle(clause);

  return {
    type: "meeting",
    title,
    data: {
      title,
      time: inferMeetingTime(clause),
      briefing: clause,
      risk: inferSeverity(clause, ""),
    },
  };
}

function buildAlarmAction(clause) {
  const title = inferReminderTitle(clause);
  const reminderTime = inferReminderTime(clause);

  return {
    type: "alarm",
    title,
    data: {
      title,
      reminder_time: reminderTime,
      notes: clause,
    },
  };
}

function buildOperationAlertAction(clause) {
  const inferredTitle = inferOperationAlertTitle(clause, "");
  const title = inferredTitle || "Operational Alert";

  return {
    type: "operation_alert",
    title,
    missing: inferredTitle ? [] : ["title"],
    data: {
      title,
      detail: clause,
      severity: inferSeverity(clause),
      area: inferOperationArea(clause),
    },
  };
}

function buildClauseActions(clause) {
  const actions = [];

  if (hasMeetingIntent(clause)) {
    actions.push(buildMeetingAction(clause));
  }

  if (hasTimedReminderIntent(clause)) {
    actions.push(buildAlarmAction(clause));
  }

  if (hasOperationAlertIntent(clause)) {
    actions.push(buildOperationAlertAction(clause));
  }

  if (/\b(draft|reply|email)\b/i.test(clause)) {
    const sourceMatch = clause.match(/\b(?:latest|last|recent)\s+(.+?)\s+email\b/i);

    actions.push({
      type: "email_draft",
      title: inferRecordTitle(clause, "Email Draft"),
      data: {
        title: inferRecordTitle(clause, "Email Draft"),
        source_query: sourceMatch?.[1] || "",
        prompt: clause,
      },
    });
  }

  if (/\breport\b/i.test(clause)) {
    actions.push({
      type: "report",
      title: inferRecordTitle(clause, "Report"),
      data: { prompt: clause },
    });
  }

  if (/\btranscript\b/i.test(clause) && /\bsummar/i.test(clause)) {
    actions.push({
      type: "transcript_summary",
      title: "Transcript Summary",
      data: { prompt: clause },
    });
  }

  if (/\bbriefing\b/i.test(clause)) {
    actions.push({
      type: "briefing",
      title: inferRecordTitle(clause, "Briefing"),
      data: { prompt: clause },
    });
  }

  if (/\b(task|todo|to do|action item)\b/i.test(clause)) {
    const priority = inferSeverity(clause);
    const title = inferTaskTitle(clause) || inferRecordTitle(clause, "Task");

    actions.push({
      type: "task",
      title,
      data: {
        title,
        detail: clause,
        deadline: inferTaskDeadline(clause),
        priority,
        severity: priority,
      },
    });
  }

  if (/\b(partner|partnership|vendor|sponsor|collaboration)\b/i.test(clause)) {
    const name = inferRecordTitle(clause, "Partner")
      .replace(/\b(partner|partnership|vendor|sponsor|collaboration)\b/gi, "")
      .trim() || "Partner";

    actions.push({
      type: "partner",
      title: name,
      data: {
        name,
        next_step: clause,
      },
    });
  }

  return actions;
}

function normalizeIdentityText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\b(?:a|an|the|me|my)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentityTime(value) {
  const parsedDate = parseDateLike(value);

  if (parsedDate) {
    return parsedDate.toISOString();
  }

  return normalizeIdentityText(value)
    .replace(/\btoday\b/g, "")
    .replace(/\btomorrow\b/g, "")
    .replace(/\b(\d{1,2})\s*:\s*00\s*(am|pm)\b/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function actionTitleForIdentity(action) {
  return normalizeIdentityText(action.data?.title || action.title);
}

function actionsHaveCompatibleTime(left, right) {
  const leftData = left.data || {};
  const rightData = right.data || {};
  const leftTime = normalizeIdentityTime(
    leftData.time || leftData.reminder_time || leftData.when || leftData.due_at
  );
  const rightTime = normalizeIdentityTime(
    rightData.time || rightData.reminder_time || rightData.when || rightData.due_at
  );

  return !leftTime || !rightTime || leftTime === rightTime;
}

function actionsLookLikeSameIntent(left, right) {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === "meeting") {
    return actionsLookLikeSameMeetingRequest(left, right);
  }

  const leftTitle = actionTitleForIdentity(left);
  const rightTitle = actionTitleForIdentity(right);

  if (!leftTitle || !rightTitle) {
    return false;
  }

  return (
    actionsHaveCompatibleTime(left, right) &&
    (leftTitle === rightTitle ||
      leftTitle.includes(rightTitle) ||
      rightTitle.includes(leftTitle))
  );
}

function isGenericMeetingTitle(title) {
  return ["meeting", "new meeting", "a meeting", "the meeting"].includes(
    normalizeIdentityText(title)
  );
}

function actionsLookLikeSameMeetingRequest(left, right) {
  const leftTitle = actionTitleForIdentity(left);
  const rightTitle = actionTitleForIdentity(right);

  if (!leftTitle || !rightTitle) {
    return false;
  }

  return (
    leftTitle === rightTitle ||
    leftTitle.includes(rightTitle) ||
    rightTitle.includes(leftTitle) ||
    isGenericMeetingTitle(leftTitle) ||
    isGenericMeetingTitle(rightTitle)
  );
}

function findMergeableAction(actions, action) {
  return actions.find((existing) => actionsLookLikeSameIntent(existing, action));
}

function mergeSupplementedAction(existing, supplemental) {
  const existingData = existing.data || {};
  const supplementalData = supplemental.data || {};
  const mergedData = {
    ...supplementalData,
    ...existingData,
  };

  for (const field of ["time", "reminder_time"]) {
    const existingValue = cleanText(existingData[field]);
    const supplementalValue = cleanText(supplementalData[field]);
    const supplementalHasMeridiem = /\b(?:AM|PM)\b/i.test(supplementalValue);
    const existingHasMeridiem = /\b(?:AM|PM)\b/i.test(existingValue);
    const existingParsed = parseDateLike(existingValue);
    const supplementalParsed = parseDateLike(supplementalValue);
    const existingIsPast =
      existingParsed && existingParsed.getTime() < Date.now() - 5 * 60_000;
    const supplementalIsFuture =
      supplementalParsed && supplementalParsed.getTime() >= Date.now() - 5 * 60_000;

    if (
      !existingValue ||
      existingIsPast ||
      (supplementalIsFuture && !existingParsed) ||
      (supplementalHasMeridiem && !existingHasMeridiem)
    ) {
      mergedData[field] = supplementalValue;
    }
  }

  for (const field of [
    "briefing",
    "notes",
    "detail",
    "severity",
    "priority",
    "deadline",
    "due",
    "owner",
    "area",
    "source_query",
    "prompt",
  ]) {
    if (!cleanText(existingData[field]) && cleanText(supplementalData[field])) {
      mergedData[field] = supplementalData[field];
    }
  }

  existing.data = mergedData;
  existing.title = cleanText(existing.title) || supplemental.title;

  return existing;
}

function supplementCommandPlan(plan, command) {
  const actions = [...(plan.actions || [])];

  for (const clause of splitCommandClauses(command)) {
    for (const action of buildClauseActions(clause)) {
      const existingAction = findMergeableAction(actions, action);

      if (existingAction) {
        mergeSupplementedAction(existingAction, action);
      } else {
        actions.push(action);
      }
    }
  }

  return {
    ...plan,
    actions,
  };
}

function buildHeuristicPlan(command) {
  const cleanActions = splitCommandClauses(command).flatMap(buildClauseActions);

  if (cleanActions.length === 0) {
    cleanActions.push({
      type: "general_ai",
      title: "AI Response",
      data: { prompt: command },
    });
  }

  return {
    summary: `I found ${cleanActions.length} action${cleanActions.length === 1 ? "" : "s"}.`,
    actions: cleanActions,
  };
}

function normalizePlannerAction(action, index) {
  const type = normalizeCommandType(action.type);
  const finalType = COMMAND_ACTION_TYPES.includes(type) ? type : "general_ai";
  const data = action.data && typeof action.data === "object" ? action.data : {};

  return {
    type: finalType,
    title: commandActionTitle(action, `Action ${index + 1}`),
    data,
    missing: Array.isArray(action.missing) ? action.missing : [],
  };
}

function looksLikeModifierOnlyAction(action) {
  const title = cleanText(action.title || action.data?.title).toLowerCase();

  return (
    action.type === "operation_alert" &&
    (/^(?:level|priority|severity|area|category|operations?)\s+(?:should\s+be|is)\b/.test(title) ||
      title === "," ||
      title.length <= 2)
  );
}

function sanitizeCommandPlan(plan) {
  const actions = [];

  for (const action of plan.actions || []) {
    if (looksLikeModifierOnlyAction(action)) {
      continue;
    }

    if (
      action.type === "alarm" &&
      !hasReminderIntent(`${plan.originalCommand || ""} ${action.data?.notes || ""}`)
    ) {
      continue;
    }

    const existingAction = findMergeableAction(actions, action);

    if (existingAction) {
      mergeSupplementedAction(existingAction, action);
      continue;
    }

    actions.push(action);
  }

  return {
    ...plan,
    actions,
  };
}

function normalizeCommandPlan(plan, command) {
  const actions = Array.isArray(plan?.actions)
    ? plan.actions.map(normalizePlannerAction)
    : [];

  if (actions.length === 0) {
    return buildHeuristicPlan(command);
  }

  return sanitizeCommandPlan(supplementCommandPlan({
    summary: cleanText(plan.summary) || `I found ${actions.length} actions.`,
    originalCommand: command,
    actions,
  }, command));
}

function buildPlannerPrompt(command, context) {
  return `
You are a multi-intent command planner for Executive Virtual AI Assistant.
Split the user command into separate actionable intents.
Return JSON only. Do not include markdown.

Supported action types:
- meeting
- alarm
- operation_alert
- email_draft
- report
- transcript_summary
- briefing
- task
- partner
- general_ai

${currentDateContextForPrompt()}

Required JSON shape:
{
  "summary": "Short summary of planned actions.",
  "actions": [
    {
      "type": "meeting",
      "title": "Finance meeting",
      "data": {}
    }
  ]
}

Data guidance:
- meeting data: title, time, start_at, end_at, duration, location, briefing, risk, attendees, alarm_minutes_before.
- alarm data: title, reminder_time, due_at, related_type, notes.
- operation_alert data: title, detail, severity, area, status.
- email_draft data: title, recipient, subject, body, source_query, prompt.
- report/briefing/general_ai data: prompt.
- transcript_summary data: prompt.
- task data: title, detail, deadline, priority, owner, status.
- partner data: name, email, phone, milestone, next_step.

Rules:
- Preserve every separate task in the user command.
- Split comma-separated or "and" joined tasks into separate actions.
- When the user gives a task due date, deadline, owner, or priority, include those fields in task data.
- Use the current date/time to resolve task dates like "today", "tomorrow", weekdays, and "the 7th of this month".
- A time attached to a meeting is the meeting time, not a separate reminder.
- When the user schedules a meeting with a date/time, include start_at as an ISO timestamp when possible.
- Use the current date/time from the context to resolve today, tomorrow, and weekdays.
- Only create alarm when the user explicitly asks to remind, set an alarm, or set a timed alert.
- If the user says "set an alert/alarm/reminder for/at/by a time", use alarm.
- If the user says "mark ... high risk", "repair", "issue", or "smart alert", use operation_alert.
- If the user says a meeting is high priority, keep that as meeting priority/risk unless there is an operations risk, repair, issue, or smart alert.
- If the user asks to add or create a partner, vendor, sponsor, or partnership record, use partner.
- If an action is missing required details, include "missing": ["field"].
- Never create delete/archive/send-email actions.
- For email replies, create an email_draft only. Never send.
- Prefer operation_alert for high-risk repairs, incidents, and risks.

Current live context:
${JSON.stringify(context)}

User command:
${command}
  `.trim();
}

async function listRecentRows(table, limit = 5, filter = null) {
  let query = supabaseAdmin
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter) {
    query = filter(query);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    console.error(`Command context ${table} error:`, error);
    return [];
  }

  return data || [];
}

async function getGmailInboxSummaries(req, maxResults = 10) {
  if (!req.session.tokens) {
    return [];
  }

  const oauth2Client = createGoogleClient();
  oauth2Client.setCredentials(req.session.tokens);

  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client,
  });

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    labelIds: ["INBOX"],
  });

  const messages = listResponse.data.messages || [];

  return Promise.all(
    messages.map(async (message) => {
      const email = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });

      const headers = email.data.payload?.headers || [];
      const getHeader = (name) =>
        headers.find(
          (header) => header.name.toLowerCase() === name.toLowerCase()
        )?.value || "";

      const emailRecord = {
        id: email.data.id,
        from: getHeader("From"),
        subject: getHeader("Subject") || "No subject",
        date: getHeader("Date"),
        snippet: email.data.snippet || "No preview available.",
      };
      const category = categorizeEmailRecord(emailRecord);

      return {
        ...emailRecord,
        category,
        urgency: emailUrgencyFromCategory(category),
      };
    })
  );
}

async function buildCommandContext(req) {
  const currentUserEmail = getCurrentUserEmail(req);
  const [
    meetings,
    alarms,
    alerts,
    operations,
    tasks,
    partners,
    transcripts,
    emailDrafts,
    emails,
  ] =
    await Promise.all([
      listRecentRows("meetings"),
      listRecentRows("alarms", 5, (query) =>
        currentUserEmail ? query.eq("created_by", currentUserEmail) : query
      ),
      listRecentRows("alerts"),
      listRecentRows("operations"),
      listRecentRows("tasks", 5, (query) =>
        currentUserEmail ? query.eq("created_by", currentUserEmail) : query
      ),
      listRecentRows("partners"),
      listRecentRows("meeting_transcripts", 3, (query) =>
        currentUserEmail ? query.eq("created_by", currentUserEmail) : query
      ),
      listRecentRows("email_drafts", 5, (query) =>
        currentUserEmail ? query.eq("created_by", currentUserEmail) : query
      ),
      getGmailInboxSummaries(req, 10).catch((error) => {
        console.error("Command Gmail context error:", error);
        return [];
      }),
    ]);

  return {
    meetings,
    alarms,
    alerts,
    operations,
    tasks,
    partners,
    transcripts,
    emailDrafts,
    emails,
    gmailConnected: Boolean(
      req.session.tokens && hasGmailReadScope(req.session.tokens)
    ),
  };
}

function hubSourceTitle(table, row) {
  return (
    cleanText(row.title) ||
    cleanText(row.name) ||
    cleanText(row.subject) ||
    cleanText(row.email) ||
    table.replaceAll("_", " ")
  );
}

function hubSourceDetail(row) {
  return cleanText(
    [
      row.detail,
      row.briefing,
      row.notes,
      row.body,
      row.snippet,
      row.transcript_text,
      row.edited_text,
      row.status,
      row.severity,
      row.reminder_time,
      row.time,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hubViewForTable(table) {
  if (["meetings", "alarms"].includes(table)) return "meetings";
  if (["alerts", "operations", "operation_alerts", "tasks"].includes(table)) {
    return "operations";
  }
  if (["partners"].includes(table)) return "partners";
  if (["meeting_transcripts"].includes(table)) return "transcripts";
  if (["emails", "email_drafts"].includes(table)) return "emails";

  return "dashboard";
}

function buildHubSources(context, question) {
  const sourceGroups = {
    meetings: context.meetings,
    alarms: context.alarms,
    alerts: context.alerts,
    operations: context.operations,
    tasks: context.tasks,
    partners: context.partners,
    meeting_transcripts: context.transcripts,
    email_drafts: context.emailDrafts,
    emails: context.emails,
  };
  const terms = cleanText(question)
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  return Object.entries(sourceGroups)
    .flatMap(([table, rows]) =>
      (rows || []).map((row) => {
        const title = hubSourceTitle(table, row);
        const detail = hubSourceDetail(row);
        const haystack = `${title} ${detail}`.toLowerCase();
        const score = terms.reduce(
          (total, term) => total + (haystack.includes(term) ? 1 : 0),
          0
        );

        return {
          id: row.id || `${table}-${title}`,
          table,
          title,
          detail,
          view: hubViewForTable(table),
          score,
        };
      })
    )
    .filter((source) => source.score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

async function planCommand(command, context) {
  try {
    const reply = await askAI(buildPlannerPrompt(command, context));
    const parsed = parseJsonObject(reply);

    return normalizeCommandPlan(parsed, command);
  } catch (error) {
    console.error("Command planner error:", error);
    return normalizeCommandPlan(buildHeuristicPlan(command), command);
  }
}

async function insertCommandRecord(table, payload) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(nextPayload)
      .select("*")
      .single();

    if (!error) {
      return data;
    }

    const missingColumn = getMissingColumnName(error);

    if (missingColumn && Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
      console.warn(
        `Skipping missing ${table}.${missingColumn} column for command insert.`
      );
      const { [missingColumn]: _removed, ...remainingPayload } = nextPayload;
      void _removed;
      nextPayload = remainingPayload;
      continue;
    }

    throw error;
  }

  throw new Error(`Could not insert ${table} record.`);
}

function recordsLookLikeSameMeeting(left, right) {
  const leftTitle = normalizeIdentityText(left?.title);
  const rightTitle = normalizeIdentityText(right?.title);
  const leftTime = normalizeIdentityTime(left?.time);
  const rightTime = normalizeIdentityTime(right?.time);

  if (!leftTitle || !rightTitle) {
    return false;
  }

  const sameTitle =
    leftTitle === rightTitle ||
    leftTitle.includes(rightTitle) ||
    rightTitle.includes(leftTitle);
  const sameTime = !leftTime || !rightTime || leftTime === rightTime;

  return sameTitle && sameTime;
}

async function findSemanticDuplicate(table, payload) {
  if (table !== "meetings") {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Semantic meeting duplicate lookup error:", error);
    }

    return null;
  }

  return (data || []).find((row) => recordsLookLikeSameMeeting(row, payload)) || null;
}

async function findRecentDuplicate(table, filters) {
  let nextFilters = { ...filters };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let query = supabaseAdmin
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    for (const [field, value] of Object.entries(nextFilters)) {
      if (value !== undefined && value !== null && value !== "") {
        query = query.eq(field, value);
      }
    }

    const { data, error } = await query;

    if (!error) {
      return data?.[0] || null;
    }

    const missingColumn = getMissingColumnName(error);

    if (missingColumn && Object.prototype.hasOwnProperty.call(nextFilters, missingColumn)) {
      console.warn(
        `Skipping missing ${table}.${missingColumn} column for duplicate lookup.`
      );
      const { [missingColumn]: _removed, ...remainingFilters } = nextFilters;
      void _removed;
      nextFilters = remainingFilters;
      continue;
    }

    if (!isMissingTableError(error)) {
      console.error(`Duplicate lookup ${table} error:`, error);
    }

    return null;
  }

  return null;
}

async function upsertCommandRecord(table, payload, duplicateFilters) {
  const existing =
    (await findSemanticDuplicate(table, payload)) ||
    (await findRecentDuplicate(table, duplicateFilters));

  if (existing) {
    return { row: existing, reused: true };
  }

  const row = await insertCommandRecord(table, payload);
  return { row, reused: false };
}

async function safeUpsertOptionalCommandRecord(table, payload, duplicateFilters) {
  try {
    return await upsertCommandRecord(table, payload, duplicateFilters);
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn(`Optional command table ${table} is missing; continuing.`);
      return { row: null, reused: false, skipped: true };
    }

    throw error;
  }
}

function needsClarification(action, missing, message) {
  return {
    type: action.type,
    status: "needs_clarification",
    title: action.title,
    data: action.data || {},
    missing,
    message,
  };
}

function failedAction(action, error) {
  return {
    type: action.type,
    status: "failed",
    title: action.title,
    data: action.data || {},
    message: error?.message || "Could not complete this action.",
  };
}

function completedAction(action, status, title, data) {
  return {
    type: action.type,
    status,
    title: title || action.title,
    data,
  };
}

function reusedAction(action, title, data) {
  return completedAction(action, "already_exists", title, data);
}

function normalizeActionSeverity(value) {
  const severity = cleanText(value, "Medium");

  if (/^high$/i.test(severity)) return "High";
  if (/^low$/i.test(severity)) return "Low";

  return "Medium";
}

function getSourceEmail(context, sourceQuery) {
  const query = cleanText(sourceQuery).toLowerCase();
  const emails = context.emails || [];

  if (!query || query === "latest" || query === "recent") {
    return { email: emails[0] || null, matched: Boolean(emails[0]) };
  }

  const email = emails.find((item) =>
    [item.from, item.subject, item.snippet]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );

  return { email: email || null, matched: Boolean(email) };
}

function inferEmailSourceQuery(command) {
  const match = cleanText(command).match(
    /\b(?:latest|last|recent)\s+(.+?)\s+email\b/i
  );

  return cleanText(match?.[1]);
}

function commandContextPrompt(context) {
  return JSON.stringify({
    meetings: context.meetings,
    alarms: context.alarms,
    alerts: context.alerts,
    operations: context.operations,
    tasks: context.tasks,
    partners: context.partners,
    transcripts: context.transcripts,
    emailDrafts: context.emailDrafts,
    emails: context.emails,
  });
}

async function draftEmailBody(action, sourceEmail, command, context) {
  const providedBody = cleanText(action.data?.body);

  if (providedBody) {
    return providedBody;
  }

  return askAI(`
Draft an email reply only. Do not send it.
Use a respectful, concise, professional ministry tone.

User command:
${command}

Draft request:
${JSON.stringify(action)}

Source email:
${JSON.stringify(sourceEmail || {})}

Relevant app context:
${commandContextPrompt(context)}
  `);
}

async function executeCommandAction(action, req, context, createdRecords, command) {
  if (WRITE_COMMAND_TYPES.has(action.type) && !userHasRole(req.session.user, ADMIN_ROLES)) {
    return {
      ...action,
      status: "failed",
      message: "Access restricted for this action.",
    };
  }

  try {
    if (action.missing?.length) {
      return needsClarification(
        action,
        action.missing,
        `I need ${action.missing.join(", ")} to complete this action.`
      );
    }

    if (action.type === "meeting") {
      const actionData = action.data || {};
      const title = cleanText(actionData.title) || action.title;

      if (!title) {
        return needsClarification(action, ["title"], "Meeting title is required.");
      }

      const startDate = resolveMeetingStartDate(actionData, command);
      const endDate = resolveMeetingEndDate(actionData, startDate);
      const displayTime = startDate
        ? formatDateTimeForMeeting(startDate)
        : cleanText(actionData.time);
      const duration = startDate && endDate
        ? `${Math.max(15, Math.round((endDate - startDate) / 60_000))} minutes`
        : cleanText(actionData.duration);
      const payload = {
        title,
        time: displayTime,
        duration,
        location: cleanText(actionData.location),
        briefing: cleanText(actionData.briefing) || command,
        risk: cleanText(actionData.risk),
        attendees: parseAttendees(actionData.attendees),
      };
      const { row: meeting, reused } = await upsertCommandRecord(
        "meetings",
        payload,
        {
          title,
          time: payload.time,
        }
      );

      createdRecords.meetings.push(meeting);

      let event = null;
      let alarm = null;

      if (startDate) {
        const eventResult = await safeUpsertOptionalCommandRecord(
          "calendar_events",
          {
            title,
            description: payload.briefing,
            event_type: "meeting",
            category: "Meetings",
            start_at: startDate.toISOString(),
            end_at: (endDate || addMinutes(startDate, 60)).toISOString(),
            location: payload.location,
            status: "Scheduled",
            source_type: "meeting",
            source_id: meeting.id,
            created_by: getCurrentUserEmail(req),
            metadata: {
              command,
              meeting_id: meeting.id,
            },
          },
          {
            title,
            start_at: startDate.toISOString(),
            source_type: "meeting",
          }
        );

        event = eventResult.row;

        if (event) {
          createdRecords.calendarEvents.push(event);
        }

        const alarmMinutes = meetingAlarmMinutesBefore(actionData, command, true);

        if (alarmMinutes > 0) {
          const alarmAt = addMinutes(startDate, -alarmMinutes);
          const alarmPayload = {
            title: `${title} Reminder`,
            reminder_time: `${alarmMinutes} minutes before ${title}`,
            due_at: alarmAt.toISOString(),
            related_type: "meeting",
            related_id: meeting.id,
            notes: command,
            status: "Pending",
            created_by: getCurrentUserEmail(req),
          };
          const alarmResult = await upsertCommandRecord("alarms", alarmPayload, {
            title: alarmPayload.title,
            due_at: alarmPayload.due_at,
            created_by: alarmPayload.created_by,
          });

          alarm = alarmResult.row;
          createdRecords.alarms.push(alarm);
        }
      }

      return reused
        ? reusedAction(action, title, { meeting, event, alarm })
        : completedAction(action, "created", title, { meeting, event, alarm });
    }

    if (action.type === "alarm") {
      const relatedMeeting = createdRecords.meetings.at(-1);
      const title =
        cleanText(action.data?.title) ||
        action.title ||
        (relatedMeeting ? `Reminder for ${relatedMeeting.title}` : "Reminder");
      const reminderTime =
        cleanText(action.data?.reminder_time) ||
        cleanText(action.data?.time) ||
        cleanText(action.data?.when);

      if (!reminderTime) {
        return needsClarification(
          action,
          ["reminder_time"],
          "Reminder time is required."
        );
      }

      const dueAt = resolveAlarmDueAt(reminderTime, relatedMeeting, command);
      const payload = {
        title,
        reminder_time: reminderTime,
        related_type:
          cleanText(action.data?.related_type) || (relatedMeeting ? "meeting" : ""),
        related_id: action.data?.related_id || relatedMeeting?.id || null,
        notes: cleanText(action.data?.notes) || command,
        status: cleanText(action.data?.status, "Pending") || "Pending",
        created_by: getCurrentUserEmail(req),
      };
      if (dueAt) {
        payload.due_at = dueAt;
      }
      const { row: alarm, reused } = await upsertCommandRecord(
        "alarms",
        payload,
        {
          title,
          reminder_time: reminderTime,
          created_by: payload.created_by,
          ...(dueAt ? { due_at: dueAt } : {}),
        }
      );

      createdRecords.alarms.push(alarm);
      return reused
        ? reusedAction(action, title, { alarm })
        : completedAction(action, "created", title, { alarm });
    }

    if (action.type === "operation_alert") {
      const title = cleanText(action.data?.title) || action.title;

      if (!title) {
        return needsClarification(action, ["title"], "Alert title is required.");
      }

      const detail = compactCommandDetail(action.data?.detail || command, title, title);
      const severity = normalizeActionSeverity(
        action.data?.severity || inferSeverity(command)
      );
      const area = cleanText(action.data?.area, "Operations") || "Operations";
      const status = cleanText(action.data?.status, "Open") || "Open";
      const dueAt =
        toIsoDate(action.data?.due_at) ||
        toIsoDate(action.data?.due) ||
        toIsoDate(action.data?.deadline) ||
        toIsoDate(detail);
      const [alertResult, operationResult, operationAlertResult] = await Promise.all([
        upsertCommandRecord(
          "alerts",
          {
            type: area,
            title,
            detail,
            severity,
            status,
            ...(dueAt ? { due_at: dueAt } : {}),
          },
          {
            title,
            severity,
            status,
          }
        ),
        upsertCommandRecord(
          "operations",
          {
            area,
            title,
            detail,
            severity,
            status,
            ...(dueAt ? { due_at: dueAt } : {}),
          },
          {
            title,
            severity,
            status,
          }
        ),
        safeUpsertOptionalCommandRecord(
          "operation_alerts",
          {
            type: area,
            title,
            detail,
            severity,
            status,
            created_by: getCurrentUserEmail(req),
            ...(dueAt ? { due_at: dueAt } : {}),
          },
          {
            title,
            severity,
            status,
          }
        ),
      ]);
      const alert = alertResult.row;
      const operation = operationResult.row;
      const operationAlert = operationAlertResult.row;

      createdRecords.alerts.push(alert);
      createdRecords.operations.push(operation);
      if (operationAlert) {
        createdRecords.operationAlerts.push(operationAlert);
      }
      return alertResult.reused && operationResult.reused && operationAlertResult.reused
        ? reusedAction(action, title, { alert, operation, operationAlert })
        : completedAction(action, "created", title, {
            alert,
            operation,
            operationAlert,
          });
    }

    if (action.type === "task") {
      const title = cleanTaskTitleCandidate(
        cleanText(action.data?.title) || action.title
      );

      if (!title || isGenericTaskTitle(title)) {
        return needsClarification(action, ["title"], "Task title is required.");
      }

      const payload = {
        title,
        detail: compactCommandDetail(action.data?.detail || command, title, title),
        owner: cleanText(action.data?.owner),
        deadline: resolveTaskDeadline(action.data, command),
        priority: normalizeActionSeverity(
          action.data?.priority || action.data?.severity || inferSeverity(command)
        ),
        status: cleanText(action.data?.status, "Open") || "Open",
        source_type: cleanText(action.data?.source_type),
        source_id: action.data?.source_id || null,
        created_by: getCurrentUserEmail(req),
      };
      const { row: task, reused } = await upsertCommandRecord(
        "tasks",
        payload,
        {
          title,
          status: payload.status,
          created_by: payload.created_by,
        }
      );

      createdRecords.tasks.push(task);
      return reused
        ? reusedAction(action, title, { task })
        : completedAction(action, "created", title, { task });
    }

    if (action.type === "partner") {
      const name =
        cleanText(action.data?.name) ||
        cleanText(action.data?.title) ||
        action.title;

      if (!name) {
        return needsClarification(action, ["name"], "Partner name is required.");
      }

      const payload = {
        name,
        email:
          cleanText(action.data?.email) ||
          cleanText(command.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]),
        phone:
          cleanText(action.data?.phone) ||
          cleanText(command.match(/\+?\d[\d\s().-]{6,}\d/)?.[0]),
        last_contact: cleanText(action.data?.last_contact || action.data?.lastContact),
        milestone: cleanText(action.data?.milestone),
        next_step: cleanText(action.data?.next_step || action.data?.nextStep),
      };
      const { row: partner, reused } = await upsertCommandRecord(
        "partners",
        payload,
        {
          name,
          email: payload.email,
        }
      );

      createdRecords.partners.push(partner);
      return reused
        ? reusedAction(action, name, { partner })
        : completedAction(action, "created", name, { partner });
    }

    if (action.type === "email_draft") {
      const sourceQuery =
        cleanText(action.data?.source_query) ||
        cleanText(action.data?.source) ||
        cleanText(action.data?.search) ||
        inferEmailSourceQuery(command);
      const needsSource = /\b(latest|last|recent|reply)\b/i.test(
        `${command} ${sourceQuery}`
      );

      if (needsSource && !context.gmailConnected) {
        return needsClarification(
          action,
          ["gmail_connection"],
          "Connect Gmail before drafting a reply to an inbox email."
        );
      }

      const { email: sourceEmail, matched: sourceMatched } = getSourceEmail(
        context,
        sourceQuery
      );

      if (needsSource && !sourceEmail) {
        return needsClarification(
          action,
          ["source_email"],
          "I could not find a matching email to draft from."
        );
      }

      if (sourceQuery && !sourceMatched) {
        return needsClarification(
          action,
          ["source_email"],
          `I could not find a Gmail message matching "${sourceQuery}".`
        );
      }

      const body = await draftEmailBody(action, sourceEmail, command, context);
      const subject =
        cleanText(action.data?.subject) ||
        (sourceEmail ? `Re: ${sourceEmail.subject}` : action.title);
      const recipient = cleanText(action.data?.recipient) || sourceEmail?.from || "";
      const title =
        cleanText(action.data?.title) ||
        action.title ||
        subject ||
        "Email Draft";

      const payload = {
        title,
        recipient,
        subject,
        body,
        source_email_id: sourceEmail?.id || cleanText(action.data?.source_email_id),
        status: "Draft",
        created_by: getCurrentUserEmail(req),
        updated_at: new Date().toISOString(),
      };
      const { row: draft, reused } = await upsertCommandRecord(
        "email_drafts",
        payload,
        {
          subject,
          source_email_id: payload.source_email_id,
          created_by: payload.created_by,
        }
      );

      createdRecords.emailDrafts.push(draft);
      return reused
        ? reusedAction(action, title, { draft })
        : completedAction(action, "drafted", title, { draft });
    }

    if (action.type === "transcript_summary") {
      const transcript = context.transcripts?.[0];

      if (!transcript) {
        return needsClarification(
          action,
          ["transcript"],
          "No saved transcript is available to summarize."
        );
      }

      const summary = await askAI(`
Summarize this meeting transcript clearly and concisely.

Request:
${cleanText(action.data?.prompt) || command}

Transcript:
${transcript.edited_text || transcript.transcript_text || ""}
      `);

      return completedAction(action, "generated", action.title, { summary });
    }

    if (["report", "briefing", "general_ai"].includes(action.type)) {
      const output = await askAI(`
Respond to this operational request using only the live app context provided.
If records are missing, say so clearly. Do not invent records.

Request:
${cleanText(action.data?.prompt) || command}

Live context:
${commandContextPrompt(context)}
      `);

      return completedAction(action, "generated", action.title, { output });
    }

    return needsClarification(action, ["type"], "This action type is not supported.");
  } catch (error) {
    console.error(`Command action ${action.type} error:`, error);
    return failedAction(action, error);
  }
}

function commandTypeLabel(action) {
  if (action.type === "alarm") return "reminder";
  if (action.type === "operation_alert") {
    return action.data?.alert?.severity === "High" ? "high-risk alert" : "alert";
  }
  if (action.type === "email_draft") return "email draft";
  if (action.type === "transcript_summary") return "transcript summary";
  if (action.type === "general_ai") return "AI response";
  if (action.type === "partner") return "partner";

  return action.type.replaceAll("_", " ");
}

function buildCommandSummary(actions) {
  const completed = actions.filter((action) =>
    SUCCESS_COMMAND_STATUSES.has(action.status)
  );
  const needsClarificationCount = actions.filter(
    (action) => action.status === "needs_clarification"
  ).length;
  const failedCount = actions.filter((action) => action.status === "failed").length;

  if (completed.length === 0) {
    return needsClarificationCount
      ? `I need clarification on ${needsClarificationCount} action${needsClarificationCount === 1 ? "" : "s"}.`
      : "I could not complete any actions.";
  }

  const counts = completed.reduce((acc, action) => {
    const label = commandTypeLabel(action);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const completedText = Object.entries(counts)
    .map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`)
    .join(", ");
  const followUp = [
    needsClarificationCount
      ? `${needsClarificationCount} need clarification`
      : "",
    failedCount ? `${failedCount} failed` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return `Done. I completed ${completedText}.${followUp ? ` ${followUp}.` : ""}`;
}

function commandLogStatus(actions) {
  if (actions.some((action) => action.status === "failed")) {
    return "Partial";
  }

  if (actions.some((action) => action.status === "needs_clarification")) {
    return "Needs Clarification";
  }

  return "Completed";
}

async function logCommandResult(req, command, summary, actions, createdRecords) {
  const status = commandLogStatus(actions);
  const createdBy = getCurrentUserEmail(req);

  try {
    await supabaseAdmin.from("command_logs").insert({
      user_email: createdBy,
      command,
      parsed_actions: actions,
      records_created: createdRecords,
      status,
      summary,
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("Command audit log error:", error);
    }
  }

  try {
    await supabaseAdmin.from("ai_command_logs").insert({
      command,
      summary,
      actions,
      status,
      created_by: createdBy,
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("Command log error:", error);
    }
  }
}

app.post("/api/command", requireLogin, async (req, res) => {
  try {
    const command = cleanText(req.body.command || req.body.message);

    if (!command) {
      return res.status(400).json({
        summary: "No command was provided.",
        actions: [],
      });
    }

    if (isCasualNoOpCommand(command)) {
      return res.json({
        summary: "Hi. I am ready when you are.",
        actions: [],
      });
    }

    const context = await buildCommandContext(req);
    const plan = await planCommand(command, context);
    const createdRecords = {
      meetings: [],
      calendarEvents: [],
      alarms: [],
      alerts: [],
      operationAlerts: [],
      operations: [],
      tasks: [],
      partners: [],
      emailDrafts: [],
    };
    const actions = [];

    for (const action of plan.actions) {
      actions.push(
        await executeCommandAction(action, req, context, createdRecords, command)
      );
    }

    const summary = buildCommandSummary(actions);
    await logCommandResult(req, command, summary, actions, createdRecords);

    res.json({
      summary,
      actions,
    });
  } catch (error) {
    console.error("Command engine error:", error);
    res.status(500).json({
      summary: "The command engine could not complete the request.",
      actions: [],
      error: "Command engine failed.",
    });
  }
});

app.post("/api/daily-briefing", requireLogin, async (req, res) => {
  try {
    const context = await buildCommandContext(req);
    const briefing = await askAI(`
Generate a daily operational briefing for Executive Virtual AI Assistant.
Use only the records in this backend context. Do not invent missing data.

Cover these sections in a concise executive style:
- meetings
- alarms and reminders
- high-risk operations and alerts
- emails needing response
- transcripts, decisions, action items, and follow-ups
- overdue or blocked tasks

Backend context:
${commandContextPrompt(context)}
    `);

    res.json({
      briefing,
      spokenSummary: cleanText(briefing).split(/\n+/)[0] || "Daily briefing ready.",
    });
  } catch (error) {
    console.error("Daily briefing error:", error);
    res.status(500).json({ error: "Could not generate daily briefing." });
  }
});

app.post("/api/ask-hub", requireLogin, async (req, res) => {
  try {
    const question = cleanText(req.body.question || req.body.query);

    if (!question) {
      return res.status(400).json({ error: "Ask the Hub needs a question." });
    }

    const context = await buildCommandContext(req);
    const sources = buildHubSources(context, question);
    const answer = await askAI(`
Answer the user's question using only Executive Virtual AI Assistant backend records.
If the records do not contain the answer, say what is missing.
Mention source titles naturally, but do not invent links.

Question:
${question}

Top matching sources:
${JSON.stringify(sources)}

Full backend context:
${commandContextPrompt(context)}
    `);

    res.json({
      answer,
      sources,
    });
  } catch (error) {
    console.error("Ask Hub error:", error);
    res.status(500).json({ error: "Could not search the hub." });
  }
});

app.get("/api/command-logs", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const currentUserEmail = getCurrentUserEmail(req);
    let query = supabaseAdmin
      .from("command_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (currentUserEmail && req.session.user.role !== "Super Admin") {
      query = query.eq("user_email", currentUserEmail);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ logs: [] });
      }

      throw error;
    }

    res.json({
      logs: (data || []).filter((log) => !isCasualNoOpCommand(log.command)),
    });
  } catch (error) {
    console.error("Command logs error:", error);
    res.status(500).json({ error: "Could not load command history." });
  }
});

/* =========================
   AI ROUTE
========================= */

app.post("/api/ai", requireLogin, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No command was provided." });
    }

    const reply = await askAI(message);

    res.json({
      reply,
    });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({
      error:
        "The AI service could not respond. Please check API key, billing, or network.",
    });
  }
});

app.get("/api/email-drafts", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const currentUserEmail = getCurrentUserEmail(req);

    const { data, error } = await supabaseAdmin
      .from("email_drafts")
      .select("*")
      .eq("created_by", currentUserEmail)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return res.json({ drafts: [] });
      }

      throw error;
    }

    res.json({ drafts: data || [] });
  } catch (error) {
    console.error("Email drafts error:", error);
    res.status(500).json({ error: "Could not load email drafts." });
  }
});

app.post("/api/email-drafts", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const body = cleanText(req.body.body);

    if (!body) {
      return res.status(400).json({ error: "Draft body is required." });
    }

    const { data, error } = await supabaseAdmin
      .from("email_drafts")
      .insert({
        title: cleanText(req.body.title) || cleanText(req.body.subject) || "Email Draft",
        recipient: cleanText(req.body.recipient),
        subject: cleanText(req.body.subject) || "Draft reply",
        body,
        source_email_id: cleanText(req.body.source_email_id),
        category: cleanText(req.body.category),
        status: "Draft",
        created_by: getCurrentUserEmail(req),
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ draft: data });
  } catch (error) {
    console.error("Create email draft error:", error);
    res.status(500).json({ error: "Could not save email draft." });
  }
});

/* =========================
   GMAIL
========================= */

app.get("/api/gmail/status", requireRole(...ADMIN_ROLES), (req, res) => {
  const readEnabled = Boolean(
    req.session.tokens && hasGmailReadScope(req.session.tokens)
  );
  const sendEnabled = Boolean(
    req.session.tokens && hasGmailSendScope(req.session.tokens)
  );

  res.json({
    connected: Boolean(req.session.user && req.session.tokens && readEnabled),
    gmail: req.session.tokens
      ? {
          ...(req.session.gmail || {}),
          readEnabled,
          sendEnabled,
        }
      : null,
    user: req.session.user || null,
  });
});

app.get("/api/gmail/emails", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({
        error: "Gmail is not connected.",
      });
    }

    if (!hasGmailReadScope(req.session.tokens)) {
      return res.status(403).json({
        error:
          "Gmail read permission is not enabled. Sign in with Google again and approve Gmail access.",
      });
    }

    const oauth2Client = createGoogleClient();
    oauth2Client.setCredentials(req.session.tokens);

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const listResponse = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      labelIds: ["INBOX"],
    });

    const messages = listResponse.data.messages || [];

    const emails = await Promise.all(
      messages.map(async (message) => {
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = email.data.payload?.headers || [];

        const getHeader = (name) =>
          headers.find(
            (header) => header.name.toLowerCase() === name.toLowerCase()
          )?.value || "";

        const emailRecord = {
          id: email.data.id,
          from: getHeader("From"),
          subject: getHeader("Subject") || "No subject",
          date: getHeader("Date"),
          snippet: email.data.snippet || "No preview available.",
        };
        const category = categorizeEmailRecord(emailRecord);

        return {
          ...emailRecord,
          category,
          urgency: emailUrgencyFromCategory(category),
        };
      })
    );

    res.json({ emails });
  } catch (error) {
    console.error("Gmail fetch error:", error);
    const status = error.response?.status || error.code;

    if (status === 401 || status === 403) {
      delete req.session.tokens;

      return res.status(401).json({
        error: "Gmail access expired. Please reconnect Gmail.",
      });
    }

    res.status(500).json({
      error: "Could not fetch Gmail emails. Check the Gmail connection.",
    });
  }
});

app.post("/api/gmail/send", requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: "Gmail is not connected." });
    }

    if (!hasGmailSendScope(req.session.tokens)) {
      return res
        .status(403)
        .json({ error: "Gmail send permission is not enabled yet." });
    }

    const to = cleanText(req.body.to || req.body.recipient);
    const subject = cleanText(req.body.subject);
    const body = cleanText(req.body.body);

    if (!to || !subject || !body) {
      return res.status(400).json({
        error: "Recipient, subject, and body are required before sending.",
      });
    }

    const oauth2Client = createGoogleClient();
    oauth2Client.setCredentials(req.session.tokens);

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });
    const raw = encodeBase64Url(
      [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
      ].join("\r\n")
    );
    const sendResult = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    if (req.body.draftId) {
      await supabaseAdmin
        .from("email_drafts")
        .update({
          status: "Sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.body.draftId)
        .eq("created_by", getCurrentUserEmail(req));
    }

    res.json({ success: true, gmailMessageId: sendResult.data.id });
  } catch (error) {
    console.error("Gmail send error:", error);
    res.status(500).json({ error: "Could not send Gmail message." });
  }
});

app.post("/api/voice/speak", requireLogin, async (req, res) => {
  try {
    if (!deepgram) {
      return res.status(503).json({
        error: "Deepgram voice is not configured on the backend.",
      });
    }

    const text = cleanText(req.body.text).slice(0, 1200);

    if (!text) {
      return res.status(400).json({ error: "Text is required for voice." });
    }

    const voiceModel =
      process.env.DEEPGRAM_VOICE_MODEL?.trim() ||
      process.env.DEEPGRAM_SPEAK_MODEL?.trim() ||
      "aura-2-thalia-en";
    const requestedSpeed = Number.parseFloat(
      process.env.DEEPGRAM_VOICE_SPEED || "0.94"
    );
    const speed = Number.isFinite(requestedSpeed)
      ? Math.min(1.2, Math.max(0.75, requestedSpeed))
      : 0.94;
    const audio = await deepgram.speak.v1.audio.generate({
      text,
      model: voiceModel,
      encoding: "linear16",
      container: "wav",
      speed,
    });
    const audioBuffer = Buffer.from(await audio.arrayBuffer());

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (error) {
    console.error("Deepgram voice error:", error);
    res.status(500).json({ error: "Could not create Deepgram voice audio." });
  }
});

app.use((error, _req, res, next) => {
  void next;
  console.error("Unhandled API error:", error);
  res.status(500).json({ error: "Unexpected server error." });
});

/* =========================
   REAL-TIME TRANSCRIPTION
========================= */

const transcriptWss = new WebSocketServer({ noServer: true });

function sendWsJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

transcriptWss.on("connection", async (clientSocket, request) => {
  if (!deepgram) {
    sendWsJson(clientSocket, {
      type: "error",
      error: "Deepgram is not configured on the backend.",
    });
    clientSocket.close(1011, "Deepgram not configured");
    return;
  }

  let deepgramSocket = null;
  let deepgramReady = false;
  let closed = false;
  const queuedAudio = [];
  const sampleRate = request.transcription?.sampleRate || 48000;

  function closeDeepgram() {
    if (closed) {
      return;
    }

    closed = true;

    try {
      deepgramSocket?.close();
    } catch (error) {
      console.error("Deepgram close error:", error);
    }
  }

  try {
    deepgramSocket = await deepgram.listen.v1.connect({
      model: "nova-3",
      language: "en",
      encoding: "linear16",
      sample_rate: sampleRate,
      channels: 1,
      punctuate: true,
      smart_format: true,
      interim_results: true,
    });

    deepgramSocket.on("open", () => {
      deepgramReady = true;
      sendWsJson(clientSocket, { type: "ready" });

      while (queuedAudio.length > 0) {
        deepgramSocket.sendMedia(queuedAudio.shift());
      }
    });

    deepgramSocket.on("message", (data) => {
      if (data?.type !== "Results") {
        return;
      }

      const text = data.channel?.alternatives?.[0]?.transcript?.trim();

      if (!text) {
        return;
      }

      sendWsJson(clientSocket, {
        type: "transcript",
        text,
        isFinal: Boolean(data.is_final),
      });
    });

    deepgramSocket.on("error", (error) => {
      console.error("Deepgram stream error:", error);
      sendWsJson(clientSocket, {
        type: "error",
        error: "Deepgram transcription stream failed.",
      });
    });

    deepgramSocket.on("close", () => {
      sendWsJson(clientSocket, { type: "closed" });
    });

    deepgramSocket.connect();
    await deepgramSocket.waitForOpen();
  } catch (error) {
    console.error("Deepgram connection error:", error);
    sendWsJson(clientSocket, {
      type: "error",
      error: "Could not connect to Deepgram.",
    });
    clientSocket.close(1011, "Deepgram connection failed");
    return;
  }

  clientSocket.on("message", (message, isBinary) => {
    if (!isBinary) {
      const command = message.toString();

      if (command === "stop") {
        closeDeepgram();
      }

      return;
    }

    if (deepgramReady) {
      deepgramSocket.sendMedia(message);
    } else {
      queuedAudio.push(message);
    }
  });

  clientSocket.on("close", closeDeepgram);
  clientSocket.on("error", closeDeepgram);

  console.log(
    `Transcript stream opened for ${request.session?.user?.email || "user"} at ${sampleRate}Hz`
  );
});

httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname !== "/ws/transcribe") {
    socket.destroy();
    return;
  }

  const ticket = url.searchParams.get("ticket");
  const ticketSession = ticket ? transcriptionTickets.get(ticket) : null;

  if (ticketSession) {
    transcriptionTickets.delete(ticket);

    if (
      ticketSession.expiresAt > Date.now() &&
      userHasRole(ticketSession.user, ADMIN_ROLES)
    ) {
      request.session = { user: ticketSession.user };
      request.transcription = { sampleRate: ticketSession.sampleRate };
      transcriptWss.handleUpgrade(request, socket, head, (ws) => {
        transcriptWss.emit("connection", ws, request);
      });
      return;
    }
  }

  sessionMiddleware(request, {}, () => {
    if (!userHasRole(request.session?.user, ADMIN_ROLES)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    transcriptWss.handleUpgrade(request, socket, head, (ws) => {
      transcriptWss.emit("connection", ws, request);
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`AI server running on port ${PORT}`);
  console.log(`Allowed app origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
