"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAnimatedNavigate } from "./NavigationTransition";
import { useAuth } from "@/components/AuthProvider";
import { authApi } from "@/lib/api";
import "@/app/account.css";

function Arrow() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>; }

export default function AccountForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const navigate = useAnimatedNavigate();
  const params = useSearchParams();
  const { login, isLoggedIn, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requested = params.get("next");
  const next = requested && /^\/(practice|profile)(\?|$)/.test(requested) ? requested : "/practice";

  useEffect(() => {
    if (!isLoading && isLoggedIn && !busy) navigate(next, { replace: true });
  }, [isLoading, isLoggedIn, busy, next, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const full_name = String(data.get("full_name") || "").trim();
    if (signup && !full_name) { setError("Please enter your name."); return; }
    setBusy(true); setError("");
    try {
      const result = signup ? await authApi.signup({ email, password, full_name }) : await authApi.login({ email, password });
      const authenticated = await login(result.access_token);
      if (!authenticated) throw new Error("Your account was authenticated, but we couldn’t load your profile. Please try signing in again.");
      navigate(next, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t connect. Please try again.");
    } finally { setBusy(false); }
  }

  return <div className="account-page page-container">
    <div className="account-layout">
      <section className="account-story" aria-labelledby="account-story-heading">
        <span className="eyebrow">A LITTLE PRACTICE. A LITTLE POSSIBILITY.</span>
        <h1 id="account-story-heading">Your voice.<br />Your pace.<br /><em>Your beginning.</em></h1>
        <p>A calm space to find your words, build confidence, and make every small step count.</p>
        <div className="account-art" aria-hidden="true"><span className="account-orbit account-orbit-one" /><span className="account-orbit account-orbit-two" /><span className="account-orbit account-orbit-three" /><div className="account-sound">{Array.from({ length: 15 }, (_, i) => <i key={i} style={{ height: `${(22 + Math.sin(i / 14 * Math.PI) * 94).toFixed(2)}px`, animationDelay: `${i * .07}s` }} />)}</div><span className="account-art-word" lang="hi">स्वर</span></div>
        <div className="account-story-foot"><span className="account-dot" /> MADE FOR YOUR EVERYDAY PROGRESS <span>01 — ∞</span></div>
      </section>
      <section className="account-form-panel">
        <span className="eyebrow">{signup ? "YOUR NEXT CHAPTER" : "GOOD TO HAVE YOU BACK"}</span>
        <h2>{signup ? "Let’s find your rhythm." : "Hello, again."}</h2>
        <p>{signup ? "Create your account and take your first step." : "Pick up where you left off. Your practice is waiting."}</p>
        <form onSubmit={submit} aria-busy={busy}>
          {signup && <div className="account-field"><label htmlFor="full-name">Your name</label><input id="full-name" name="full_name" autoComplete="name" placeholder="What should we call you?" required maxLength={150} disabled={busy} /></div>}
          <div className="account-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={255} disabled={busy} /></div>
          <div className="account-field"><label htmlFor="password">Password</label><div className="account-password"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 6 characters" : "Enter your password"} required minLength={signup ? 6 : undefined} maxLength={128} disabled={busy} aria-describedby={signup ? "password-hint" : undefined} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button></div>{signup && <small id="password-hint">Use at least 6 characters for your password.</small>}</div>
          {error && <div className="account-error" role="alert">{error}</div>}
          <button className="button button-dark account-submit" type="submit" disabled={busy || isLoading}>{busy ? (signup ? "Creating your account…" : "Signing you in…") : isLoading ? "Checking your session…" : signup ? "Create your account" : "Continue to your practice"}<Arrow /></button>
        </form>
        <p className="account-switch">{signup ? "Already part of the journey?" : "New to SwarSaarthi?"} <Link href={`${signup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}>{signup ? "Sign in" : "Create an account"}<span aria-hidden="true"> ↗</span></Link></p>
        <div className="account-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" /><path d="m8 12 3 3 5-6" /></svg><span>Your practice, saved in one place.<br />Return whenever you’re ready.</span></div>
      </section>
    </div>
  </div>;
}
