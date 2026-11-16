"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { profileApi, type ProfileSummary, type FocusWordItem, type DifficultyProgress, type Difficulty } from "@/lib/api";
import "./home-practice-plan.css";

type Data = { summary: ProfileSummary; focus: FocusWordItem[]; progress: DifficultyProgress };

export function focusWordHref(word: FocusWordItem) {
  const query = new URLSearchParams({ wordId: word.word_id, difficulty: word.difficulty, itemType: word.item_type || "word" });
  return `/practice?${query}`;
}

function LearnerPlan({ name }: { name: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false, busy = false, lastLoaded = 0;
    let controller: AbortController | null = null;
    async function load() {
      if (busy) return;
      busy = true; controller = new AbortController();
      setLoading(true); setError("");
      try {
        const [summary, focus, progress] = await Promise.all([
          profileApi.getSummary(controller.signal), profileApi.getFocusWords(6, controller.signal), profileApi.getProgress(controller.signal),
        ]);
        if (!summary?.stats || !Array.isArray(focus?.focus_words) || !progress?.breakdown) throw new Error("Your progress couldn’t be loaded. Please try again.");
        if (!disposed) {
          setData({ summary, focus: [...focus.focus_words].sort((a, b) => a.avg_accuracy - b.avg_accuracy), progress });
          lastLoaded = Date.now();
        }
      } catch (cause) {
        if (!disposed && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Your progress couldn’t be loaded. Please try again.");
      } finally { busy = false; if (!disposed) setLoading(false); }
    }
    reload.current = () => { void load(); };
    const refresh = () => { if (!document.hidden && Date.now() - lastLoaded > 15000) void load(); };
    void load(); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true; controller?.abort(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const first = data?.focus[0];
  const attempted = (Object.entries(data?.progress.breakdown || {}) as [Difficulty, DifficultyProgress["breakdown"]["basic"]][])
    .filter(([, value]) => value.attempted_words > 0).sort((a, b) => a[1].avg_accuracy - b[1].avg_accuracy);
  const weakest = attempted[0];
  const practiced = (data?.summary.stats.total_attempts || 0) > 0;
  const tasks = [
    first ? { title: `Revisit ${first.text_hi}`, detail: `Your lowest average is ${Math.round(first.avg_accuracy)}%. Listen slowly, then try this ${first.item_type === "sentence" ? "sentence" : "word"} again.`, href: focusWordHref(first), label: "YOUR FIRST STEP" }
      : { title: practiced ? "Keep your rhythm going" : "Record your first word", detail: practiced ? "No items are currently flagged for extra practice. Try a fresh set to keep building confidence." : "Listen to a word, record yourself, and get your first pronunciation score.", href: "/practice", label: "YOUR FIRST STEP" },
    weakest ? { title: `Focus on ${weakest[0]} practice`, detail: `This is your lowest-scoring practised level (${Math.round(weakest[1].avg_accuracy)}% average). Try five short attempts at your own pace.`, href: `/practice?difficulty=${weakest[0]}`, label: "A LITTLE FOCUSED PRACTICE" }
      : { title: "Explore the mouth guide", detail: "See how Hindi sounds are formed. Try the letter explorer and slower pronunciation playback.", href: "/practice", label: "WATCH & LISTEN" },
    { title: "Put your voice into conversation", detail: "Talk about your day with the Hindi voice coach, or choose guided voice practice for scored attempts.", href: "/voice", label: "TRY IT OUT LOUD" },
  ];
  return <section className="home-plan section-wrap" aria-labelledby="home-plan-title">
    <header><div><p className="home-plan-eyebrow">YOUR PRACTICE, PICKING UP WHERE YOU LEFT OFF</p><h2 id="home-plan-title">A little progress, <em>{name.split(" ")[0]}.</em></h2><p>{practiced ? "Here’s what deserves a little more time—and where to go next." : "Your next small step starts here. Your plan grows with each saved attempt."}</p></div><Link href="/profile">Your full journey <span>↗</span></Link></header>
    {error && <div className="home-plan-error" role="alert"><span>{error}{data ? " Showing the last loaded progress." : ""}</span><button disabled={loading} onClick={() => reload.current()}>Try again</button></div>}
    {loading && !data ? <div className="home-plan-loading" role="status"><span />Gathering your practice history…</div> : data && <>
      <div className="home-plan-stats"><div><strong>{data.summary.stats.total_attempts}</strong><span>saved attempts</span></div><div><strong>{practiced ? `${Math.round(data.summary.stats.overall_accuracy)}%` : "—"}</strong><span>overall average</span></div><div><strong>{data.summary.stats.focus_words_count}</strong><span>items to revisit</span></div><div><strong>{data.summary.streak.current_streak}</strong><span>day practice streak</span></div><button disabled={loading} onClick={() => reload.current()} aria-label="Refresh my practice plan">{loading ? "Updating…" : "Refresh ↻"}</button></div>
      <div className="home-plan-grid">
        <div className="home-focus"><div className="home-plan-section-head"><div><p className="home-plan-eyebrow">A LITTLE EXTRA ATTENTION</p><h3>Your words to revisit.</h3></div><span>{data.summary.stats.focus_words_count ? `${data.focus.length} shown` : "A fresh page"}</span></div>
          {data.focus.length ? <><p className="home-focus-explainer">Lowest averages first. These items are below 70% across saved attempts. Scores are practice guidance, not a judgment of your voice.</p><ol>{data.focus.map((word, index) => <li key={word.word_id}><span className="home-focus-order">{String(index + 1).padStart(2, "0")}</span><div className="home-focus-word"><h4 lang="hi">{word.text_hi}</h4><p>{word.transliteration} · {word.meaning_en}</p><small>{word.total_attempts} {word.total_attempts === 1 ? "attempt" : "attempts"} · Best {Math.round(word.best_score)}%{word.item_type === "sentence" ? " · Sentence" : ""}</small></div><div className="home-focus-score"><strong>{Number(word.avg_accuracy.toFixed(1))}<small>%</small></strong><span>average</span></div><Link href={focusWordHref(word)} aria-label={`Practise ${word.text_hi}`}>Practise <span aria-hidden="true">↗</span></Link></li>)}</ol>{data.summary.stats.focus_words_count > data.focus.length && <Link className="home-focus-more" href="/profile">See more focus words in your journey ↗</Link>}</>
            : <div className="home-focus-empty"><span aria-hidden="true">अ</span><h4>{practiced ? "Nothing flagged. Keep exploring." : "We’re getting to know your voice."}</h4><p>{practiced ? "Your saved averages have no items below the focus threshold. Keep practising to discover your next challenge." : "After your first scored attempts, the words needing more practice will appear here."}</p><Link href="/practice">{practiced ? "Try a new set" : "Start your first practice"} ↗</Link></div>}
        </div>
        <div className="home-next"><p className="home-plan-eyebrow">YOUR NEXT FEW STEPS</p><h3>A small plan.<br /><em>Made for your pace.</em></h3><p className="home-next-intro">Suggestions based on your saved practice. Pick one to begin.</p><ol>{tasks.map((task, index) => <li key={task.label}><Link href={task.href}><span className="home-task-number">0{index + 1}</span><div><small>{task.label}</small><h4>{task.title}</h4><p>{task.detail}</p></div><span aria-hidden="true">↗</span></Link></li>)}</ol><p className="home-next-note">Your plan refreshes when you return home. Scored attempts in both studios contribute to your progress.</p></div>
      </div>
    </>}
  </section>;
}

export default function HomePracticePlan() {
  const { user, isLoading } = useAuth();
  if (isLoading || !user) return null;
  return <LearnerPlan key={user.id} name={user.full_name} />;
}
