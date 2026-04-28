import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import session from "express-session";
import { google } from "googleapis";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import db from "./db.js";

dotenv.config({ path: "./server/.env" });

const app = express();
const PORT = 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbacksecret123",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function createGoogleClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
    process.env.GOOGLE_REDIRECT_URI?.trim()
  );
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const attemptedHash = pbkdf2Sync(
    password,
    salt,
    310000,
    32,
    "sha256"
  );
  const savedHash = Buffer.from(hash, "hex");

  return (
    savedHash.length === attemptedHash.length &&
    timingSafeEqual(savedHash, attemptedHash)
  );
}

function setSessionUser(req, user) {
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    access: user.access,
  };
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

function findOrCreateGoogleUser(email, name) {
  const finalEmail = email.trim().toLowerCase();
  const existingUser = db
    .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
    .get(finalEmail);

  if (existingUser) {
    return existingUser;
  }

  db.prepare(
    `
    INSERT INTO users (name, email, role, access, is_active)
    VALUES (@name, @email, @role, @access, @isActive)
  `
  ).run({
    name: name || finalEmail,
    email: finalEmail,
    role: "Viewer",
    access: "Limited Access",
    isActive: 1,
  });

  return db
    .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
    .get(finalEmail);
}

function sendGoogleError(res, error) {
  const detail =
    error.response?.data?.error_description ||
    error.response?.data?.error ||
    error.message ||
    "Unknown Google OAuth error.";

  res.status(500).send(`
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
          <p>Google returned an error while connecting Gmail. Details:</p>
          <code>${String(detail).replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</code>
          <p>Go back to the app and try reconnecting Gmail. If this repeats, confirm the Google OAuth redirect URI is exactly <strong>http://localhost:5000/auth/google/callback</strong>.</p>
          <a href="http://localhost:5173">Return to AD Hub</a>
        </main>
      </body>
    </html>
  `);
}

/* =========================
   AUTH HELPERS
========================= */

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "Super Admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

/* =========================
   GOOGLE LOGIN
========================= */

app.get("/auth/google", (req, res) => {
  try {
    const oauth2Client = createGoogleClient();

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
    });

    res.redirect(url);
  } catch (error) {
    console.error("Google auth error:", error);
    res.send("Could not start Google login.");
  }
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, error, error_description: errorDescription } = req.query;

    if (error) {
      throw new Error(errorDescription || error);
    }

    if (!code) {
      return res.send("No Google authorization code received.");
    }

    const oauth2Client = createGoogleClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const profile = await getGoogleProfile(oauth2Client, tokens);
    const user = findOrCreateGoogleUser(profile.email, profile.name);

    req.session.tokens = tokens;
    setSessionUser(req, user);

    res.redirect("http://localhost:5173");
  } catch (error) {
    console.error("Google callback error:", error);
    sendGoogleError(res, error);
  }
});

/* =========================
   CURRENT USER
========================= */

app.get("/api/auth/me", (req, res) => {
  res.json({
    loggedIn: Boolean(req.session.user),
    user: req.session.user || null,
  });
});

app.post("/api/auth/signup", (req, res) => {
  try {
    const { name, email, password } = req.body;
    const finalName = name?.trim() || "Pending User";
    const finalEmail = email?.trim().toLowerCase();

    if (!finalEmail || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(finalEmail);

    if (existingUser) {
      return res.status(409).json({ error: "An account already exists." });
    }

    const passwordHash = hashPassword(password);

    db.prepare(
      `
      INSERT INTO users (name, email, role, access, is_active, password_hash)
      VALUES (@name, @email, @role, @access, @isActive, @passwordHash)
    `
    ).run({
      name: finalName,
      email: finalEmail,
      role: "Viewer",
      access: "Limited Access",
      isActive: 1,
      passwordHash,
    });

    const user = db
      .prepare("SELECT id, name, email, role, access FROM users WHERE email = ?")
      .get(finalEmail);

    setSessionUser(req, user);

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const finalEmail = email?.trim().toLowerCase();

    if (!finalEmail || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
      .get(finalEmail);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    delete req.session.tokens;
    setSessionUser(req, user);

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Could not log in." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/* =========================
   USERS MANAGEMENT
========================= */

app.get("/api/users", requireLogin, requireAdmin, (req, res) => {
  const users = db
    .prepare(
      "SELECT id, name, email, role, access, is_active, created_at FROM users ORDER BY id DESC"
    )
    .all();

  res.json({ users });
});

app.post("/api/users", requireLogin, requireAdmin, (req, res) => {
  try {
    const { name, email, role, access } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const finalName = name || "Pending User";
    const finalRole = role || "Viewer";
    const finalAccess = access || "Limited Access";

    db.prepare(
      "INSERT INTO users (name, email, role, access, is_active) VALUES (?, ?, ?, ?, 1)"
    ).run(finalName, email.toLowerCase(), finalRole, finalAccess);

    res.json({ success: true });
  } catch (error) {
    console.error("Add user error:", error);
    res.status(500).json({ error: "Could not add user. Email may already exist." });
  }
});

app.delete("/api/users/:id", requireLogin, requireAdmin, (req, res) => {
  const { id } = req.params;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.role === "Super Admin") {
    return res.status(403).json({ error: "Cannot remove Super Admin" });
  }

  db.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(id);

  res.json({ success: true });
});

/* =========================
   OPENAI ROUTE
========================= */

app.post("/api/ai", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "No command was provided." });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
You are the AI assistant for an Esteemed AD operational command center.
Respond in a concise, executive, ministry-appropriate tone.

User command:
${message}
      `,
    });

    res.json({
      reply: response.output_text || "I could not generate a response.",
    });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({
      reply:
        "The AI service could not respond. Please check API key, billing, or network.",
    });
  }
});

/* =========================
   GMAIL STATUS
========================= */

app.get("/api/gmail/status", (req, res) => {
  res.json({
    connected: Boolean(req.session.user && req.session.tokens),
    user: req.session.user || null,
  });
});

/* =========================
   READ GMAIL EMAILS
========================= */

app.get("/api/gmail/emails", requireLogin, async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({
        error: "Gmail is not connected.",
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

        return {
          id: email.data.id,
          from: getHeader("From"),
          subject: getHeader("Subject") || "No subject",
          date: getHeader("Date"),
          snippet: email.data.snippet || "No preview available.",
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

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`AI server running on http://localhost:${PORT}`);
});
