import { useState } from "react";
import { LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";

import { GOOGLE_AUTH_URL, signupUser } from "../../services/api";
import { Button } from "../ui/button";

export default function SignupPage({ onSignup, onShowLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const data = await signupUser({ name, email, password });

      if (!data.ok) {
        setMessage(data.error || "Could not create account.");
        return;
      }

      onSignup(data.user);
    } catch {
      setMessage("Could not connect to the signup server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-3 text-slate-950 sm:p-4">
      <div className="w-full max-w-[26rem] rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-2xl bg-slate-950 p-3 text-white">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-lg font-black sm:text-xl">
              Create Account
            </h1>
            <p className="text-sm text-slate-500">Join AD Operational Hub</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700">
              Full name
            </label>
            <div className="relative mt-2">
              <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your full name"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">Email</label>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Password
            </label>
            <div className="relative mt-2">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Confirm password
            </label>
            <div className="relative mt-2">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
          </div>

          {message && (
            <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
              {message}
            </div>
          )}

          <Button disabled={loading} className="w-full rounded-2xl py-3">
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-4 grid gap-3">
          <Button
            onClick={() => (window.location.href = GOOGLE_AUTH_URL)}
            variant="outline"
            className="w-full rounded-2xl bg-white py-3"
          >
            Continue with Google
          </Button>

          <button
            onClick={onShowLogin}
            className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            I already have an account
          </button>
        </div>
      </div>
    </div>
  );
}
