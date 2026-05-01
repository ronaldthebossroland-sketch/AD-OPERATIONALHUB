import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  completeSupabaseAuthFromUrl,
  syncSupabaseAuthSession,
} from "../../services/oauth";
import {
  isSupabaseAuthConfigured,
  supabase,
} from "../../services/supabaseClient";

export default function AuthCallbackPage({ onAuthenticated }) {
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    let authSubscription = null;

    async function finishFromSession(session) {
      if (!session?.access_token) {
        return null;
      }

      const user = await syncSupabaseAuthSession();

      if (user && isMounted) {
        onAuthenticated?.(user);
      }

      return user;
    }

    async function handleCallback() {
      if (!isSupabaseAuthConfigured || !supabase) {
        throw new Error(
          "Supabase auth is not configured. Check the Vercel environment variables."
        );
      }

      const restoredUser = await completeSupabaseAuthFromUrl(
        window.location.toString()
      );

      if (restoredUser) {
        if (isMounted) {
          onAuthenticated?.(restoredUser);
        }
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const sessionUser = await finishFromSession(data.session);

      if (!sessionUser && isMounted) {
        setError("Google sign-in did not return a session. Please try again.");
      }
    }

    const { data } = supabase?.auth.onAuthStateChange((_event, session) => {
      finishFromSession(session).catch((authError) => {
        if (isMounted) {
          setError(authError.message || "Could not finish Google sign-in.");
        }
      });
    }) || { data: null };

    authSubscription = data?.subscription || null;

    handleCallback().catch((callbackError) => {
      if (isMounted) {
        setError(callbackError.message || "Could not finish Google sign-in.");
      }
    });

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, [onAuthenticated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-black">Google sign-in failed</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="mt-4 text-lg font-black">Signing you in...</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Please wait while Google finishes connecting your account.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
