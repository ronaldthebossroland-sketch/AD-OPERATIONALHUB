export const API_BASE_URL = "http://localhost:5000";
export const APP_HOME_URL = "http://localhost:5173";
export const GOOGLE_AUTH_URL = `${API_BASE_URL}/auth/google`;

export async function askAI(message) {
  const res = await fetch(`${API_BASE_URL}/api/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const data = await res.json();
  return data.reply || "No AI response received.";
}

export async function getGmailStatus() {
  const res = await fetch(`${API_BASE_URL}/api/gmail/status`, {
    credentials: "include",
  });

  return res.json();
}

export async function getGmailEmails() {
  const res = await fetch(`${API_BASE_URL}/api/gmail/emails`, {
    credentials: "include",
  });

  return res.json();
}

export async function getCurrentUser() {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: "include",
  });

  return res.json();
}

export async function loginUser(credentials) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  return { ok: res.ok, ...data };
}

export async function signupUser(account) {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(account),
  });

  const data = await res.json();
  return { ok: res.ok, ...data };
}

export async function getUsers() {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    credentials: "include",
  });

  return res.json();
}

export async function createUser(user) {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  const data = await res.json();
  return { ok: res.ok, ...data };
}

export async function deleteUser(id) {
  const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json();
  return { ok: res.ok, ...data };
}

export async function logoutUser() {
  return fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
