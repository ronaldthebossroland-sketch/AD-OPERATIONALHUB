import {
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import kingsChatWebSdk from "kingschat-web-sdk";
import "kingschat-web-sdk/dist/stylesheets/style.min.css";

import {
  loginUser,
  loginWithKingsChat,
  signupUser,
} from "../../services/api";
import { signInWithGoogle } from "../../services/oauth";
import { Button } from "../ui/button";

const emptyAuthForm = {
  name: "",
  email: "",
  password: "",
};

export default function LoginPage({ onLogin }) {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isKingsChatLoading, setIsKingsChatLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [kingsChatError, setKingsChatError] = useState("");
  const [kingsChatStatus, setKingsChatStatus] = useState("");
  const kingsChatClientId = import.meta.env.VITE_KINGSCHAT_CLIENT_ID;
  const isKingsChatConfigured = Boolean(kingsChatClientId);
  const isCreatingAccount = authMode === "signup";

  function updateAuthForm(field, value) {
    setAuthForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handlePasswordAuth(event) {
    event.preventDefault();
    setAuthError("");

    if (!authForm.email.trim() || !authForm.password) {
      setAuthError("Email and password are required.");
      return;
    }

    if (isCreatingAccount && authForm.password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }

    try {
      setAuthLoading(true);
      const data = isCreatingAccount
        ? await signupUser(authForm)
        : await loginUser(authForm);

      if (!data.ok) {
        setAuthError(data.error || "Could not complete sign in.");
        return;
      }

      onLogin?.(data.user);
      setAuthForm(emptyAuthForm);
    } catch {
      setAuthError("Could not reach the login server.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleKingsChatLogin() {
    setKingsChatError("");
    setKingsChatStatus("");

    if (!isKingsChatConfigured) {
      setKingsChatStatus("KingsChat login is waiting for API approval.");
      return;
    }

    try {
      setIsKingsChatLoading(true);

      const authTokens = await kingsChatWebSdk.login({
        clientId: kingsChatClientId,
        scopes: [],
      });

      const data = await loginWithKingsChat({
        accessToken: authTokens.accessToken,
        refreshToken: authTokens.refreshToken,
        expiresInMillis: authTokens.expiresInMillis,
      });

      if (!data.ok) {
        setKingsChatError(data.error || "Could not complete KingsChat login.");
        return;
      }

      setKingsChatStatus(
        "KingsChat connected. Google access control is still required for now."
      );
    } catch (error) {
      setKingsChatError(error.message || "KingsChat login was cancelled.");
    } finally {
      setIsKingsChatLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setAuthError("");

    try {
      setIsGoogleLoading(true);
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error.message || "Could not start Google sign-in.");
    } finally {
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="luxury-auth flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-950">
      <div className="luxury-login-card w-full max-w-[28rem] rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <img
            src="/logo-mark.svg"
            alt="Executive Virtual AI Assistant"
            className="luxury-logo h-14 w-14 shrink-0 rounded-2xl shadow-sm"
          />
          <div className="min-w-0">
            <h1 className="break-words text-lg font-black sm:text-xl">
              Executive Virtual AI Assistant
            </h1>
            <p className="text-sm text-slate-500">
              Premium executive command assistant
            </p>
          </div>
        </div>

        <div className="luxury-login-welcome mt-8 rounded-3xl bg-slate-50 p-5">
          <div className="flex items-center gap-3">
            <div className="luxury-soft-icon rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">
                Welcome back
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Choose a secure sign-in method to continue to your command
                center.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePasswordAuth} className="mt-5 space-y-3">
          <div className="luxury-segmented grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                authMode === "login"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setAuthError("");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                authMode === "signup"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Create account
            </button>
          </div>

          {isCreatingAccount && (
            <input
              value={authForm.name}
              onChange={(event) => updateAuthForm("name", event.target.value)}
              placeholder="Name"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          )}

          <input
            value={authForm.email}
            onChange={(event) => updateAuthForm("email", event.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
          />

          <input
            value={authForm.password}
            onChange={(event) => updateAuthForm("password", event.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
          />

          <Button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-2xl py-3"
          >
            {authLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isCreatingAccount ? (
              <UserPlus className="mr-2 h-4 w-4" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            {authLoading
              ? "Working..."
              : isCreatingAccount
                ? "Create Account"
                : "Sign In"}
          </Button>
        </form>

        {authError ? (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {authError}
          </p>
        ) : null}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-black uppercase text-slate-400">
            or
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          variant="outline"
          className="w-full rounded-2xl bg-white py-3"
        >
          {isGoogleLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          {isGoogleLoading ? "Opening Google..." : "Continue with Google"}
        </Button>

        <Button
          onClick={handleKingsChatLogin}
          disabled={!isKingsChatConfigured || isKingsChatLoading}
          variant="outline"
          className="mt-3 w-full rounded-2xl py-3"
        >
          {isKingsChatLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="mr-2 h-4 w-4" />
          )}
          {isKingsChatLoading
            ? "Connecting KingsChat..."
            : isKingsChatConfigured
              ? "Continue with KingsChat"
              : "KingsChat coming soon"}
        </Button>

        {!isKingsChatConfigured ? (
          <p className="mt-3 text-center text-xs font-bold text-slate-500">
            KingsChat access is pending API approval.
          </p>
        ) : null}

        {kingsChatError ? (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {kingsChatError}
          </p>
        ) : null}

        {kingsChatStatus ? (
          <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            {kingsChatStatus}
          </p>
        ) : null}
      </div>
    </div>
  );
}
