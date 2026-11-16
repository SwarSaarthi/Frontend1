"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { profileApi, type ProfileSummary, type FocusWordItem, type StreakDay, type DifficultyProgress } from "@/lib/api";
import "@/app/account.css";

type Dashboard = { summary: ProfileSummary; focus: FocusWordItem[]; calendar: StreakDay[]; progress: DifficultyProgress };
const levels = [{ id: "basic", label: "The foundations", description: "Build comfort with everyday words." }, { id: "intermediate", label: "Finding your flow", description: "Make room for a little more challenge." }, { id: "advanced", label: "Beyond the familiar", description: "Explore more nuanced sounds." }] as const;

function Arrow() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>; }

function Calendar({ entries }: { entries: StreakDay[] }) {
  const byDate = new Map(entries.map(day => [day.date, day.count]));
  const today = new Date();
  const days = Array.from({ length: 91 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90 + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const count = byDate.get(key) || 0;
    return { key, count, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
  });
  return <div className="profile-calendar"><div className="profile-calendar-grid" aria-label="Practice activity over the last 91 days">{days.map(day => <span key={day.key} className={`activity-cell activity-${day.count === 0 ? 0 : day.count < 4 ? 1 : day.count < 8 ? 2 : 3}`} tabIndex={0} aria-label={`${day.label}: ${day.count} practice attempts`}><span className="activity-tooltip">{day.label} · {day.count} {day.count === 1 ? "attempt" : "attempts"}</span></span>)}</div><div className="profile-calendar-footer"><span>{days[0].label} — {days[90].label}</span><span className="activity-legend">Less <i className="activity-0" /><i className="activity-1" /><i className="activity-2" /><i className="activity-3" /> More</span></div></div>;
}

export default function ProfilePage() {
  const { user, isLoggedIn, isLoading, error: authError, checkAuth, logout } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const [summary, focus, calendar, progress] = await Promise.all([profileApi.getSummary(), profileApi.getFocusWords(8), profileApi.getStreakCalendar(91), profileApi.getProgress()]);
        if (active) setData({ summary, focus: focus.focus_words, calendar: calendar.calendar, progress });
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "We couldn’t load your progress."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [isLoggedIn, user?.id, revision]);

  if (isLoading) return <div className="profile-page page-container"><div className="profile-loading" role="status"><span className="profile-loader" /><p>Gathering your progress…</p></div></div>;
  if (!isLoggedIn) return <div className="profile-page page-container"><section className="profile-gate"><span className="eyebrow">YOUR PERSONAL JOURNEY</span><h1>Small steps.<br /><em>A story worth keeping.</em></h1><p>Sign in to see your practice streak, revisit words, and watch your progress grow.</p>{authError && <div className="account-error" role="alert">{authError}<button onClick={() => void checkAuth()} className="profile-inline-button">Try reconnecting</button></div>}<Link href="/login?next=/profile" className="button button-dark">Sign in to your space <Arrow /></Link><Link href="/signup?next=/profile" className="profile-gate-link">New here? Create an account ↗</Link></section></div>;

  return <div className="profile-page page-container">
    <header className="profile-header"><div><span className="eyebrow">YOUR PERSONAL JOURNEY</span><h1>A little further,<br /><em>{user?.full_name.split(" ")[0] || "every day"}.</em></h1><p>Every time you show up, you’re making progress.</p></div><Link href="/practice" className="button button-dark">Let’s practice <Arrow /></Link></header>
    {error ? <div className="profile-error-panel" role="alert"><h2>Your progress is still yours.</h2><p>{error}</p><button onClick={() => setRevision(n => n + 1)} className="button button-dark">Try again <Arrow /></button></div> : loading ? <div className="profile-loading" role="status"><span className="profile-loader" /><p>Gathering your progress…</p></div> : data && <>
      <section className="profile-stats" aria-label="Your practice statistics">
        <div className="profile-stat profile-stat-featured"><span className="eyebrow">CURRENT STREAK</span><strong>{data.summary.streak.current_streak}<small>days</small></strong><span>A little consistency goes a long way.</span><span className="stat-sun" aria-hidden="true">✳</span></div>
        <div className="profile-stat"><span className="eyebrow">WORDS EXPLORED</span><strong>{data.summary.stats.unique_words_practiced}<small>/{data.summary.stats.total_words_available}</small></strong><span>Your vocabulary, growing.</span></div>
        <div className="profile-stat"><span className="eyebrow">AVERAGE ACCURACY</span><strong>{data.summary.stats.total_attempts ? `${Math.round(data.summary.stats.overall_accuracy)}%` : "—"}</strong><span>{data.summary.stats.total_attempts ? `Across ${data.summary.stats.total_attempts} practice attempts.` : "Your first practice sets the starting point."}</span></div>
      </section>
      {data.summary.stats.total_attempts === 0 && <section className="profile-first-step"><div><span className="eyebrow">A BLANK PAGE, FULL OF POSSIBILITY</span><h2>Your first word is waiting.</h2><p>Listen, speak, and let your journey take shape. There’s no rush.</p></div><Link href="/practice" className="button button-dark">Begin your first practice <Arrow /></Link></section>}
      <div className="profile-main-grid"><section className="profile-panel"><div className="profile-section-head"><div><span className="eyebrow">THE ART OF SHOWING UP</span><h2>Your practice rhythm.</h2></div><span className="profile-chip">Last 91 days</span></div><Calendar entries={data.calendar} /><div className="profile-calendar-summary"><span><b>{data.summary.streak.longest_streak} days</b>longest streak</span><span><b>{data.summary.streak.total_practice_days} days</b>of making time for yourself</span></div></section>
      <aside className="profile-reflection"><span className="eyebrow">A GENTLE REMINDER</span><span className="profile-reflection-mark" aria-hidden="true">“</span><h2>Progress has<br />its own <em>pace.</em></h2><p>Some days are for new words. Some are for trying again. Both are a step forward.</p><Link href="/practice">Make a little time today <Arrow /></Link></aside></div>
      <section className="profile-levels"><div className="profile-section-head"><div><span className="eyebrow">ROOM TO GROW</span><h2>Find your next chapter.</h2></div><span className="profile-secondary">Your practice across each level</span></div><div className="profile-level-grid">{levels.map((level, index) => {
        const progress = data.progress.breakdown[level.id];
        return <article className="profile-level" key={level.id}><div className="profile-level-top"><span>0{index + 1}</span><span className="profile-chip">{level.id}</span></div><h3>{level.label}</h3><p>{level.description}</p><div className="profile-level-value"><strong>{progress.attempted_words}</strong><span>of {progress.total_words} explored</span></div><div className="profile-progress-track" role="progressbar" aria-label={`${level.id} completion`} aria-valuenow={progress.completion_percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(0, Math.min(100, progress.completion_percentage))}%` }} /></div><div className="profile-level-bottom"><span>{progress.mastered_words} mastered</span><span>{progress.attempted_words ? `${Math.round(progress.avg_accuracy)}% average accuracy` : "Ready when you are"}</span></div></article>;
      })}</div></section>
      <section className="profile-focus"><div className="profile-section-head"><div><span className="eyebrow">A LITTLE EXTRA ATTENTION</span><h2>Words to come back to.</h2></div><span className="profile-chip">{data.summary.stats.focus_words_count} focus words</span></div>{data.focus.length ? <div className="profile-focus-list">{data.focus.map(word => <Link key={word.word_id} href={`/practice?wordId=${encodeURIComponent(word.word_id)}`} className="profile-focus-word"><span className="profile-focus-hindi" lang="hi">{word.text_hi}</span><span className="profile-focus-meaning"><b>{word.transliteration}</b>{word.meaning_en}</span><span className="profile-focus-score"><b>{Math.round(word.avg_accuracy)}%</b>average accuracy</span><span className="profile-focus-action">Practice again <Arrow /></span></Link>)}</div> : <div className="profile-focus-empty"><span className="profile-empty-symbol" aria-hidden="true">↗</span><div><h3>{data.summary.stats.total_attempts ? "A little more room to explore." : "Your focus words will find their place here."}</h3><p>{data.summary.stats.total_attempts ? "No words need extra attention right now. Keep practicing to discover what’s next." : "As you practice, we’ll collect the words that could use another try."}</p></div><Link href="/practice" className="profile-text-link">Explore words <Arrow /></Link></div>}</section>
      <div className="profile-account-footer"><div className="profile-account-identity"><span className="profile-avatar">{user?.full_name.slice(0, 1).toUpperCase()}</span><span><b>{user?.full_name}</b>{user?.email}</span></div><button onClick={logout} className="profile-signout">Sign out <Arrow /></button></div>
    </>}
  </div>;
}
