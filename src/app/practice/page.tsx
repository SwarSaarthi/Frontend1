"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SpeechModel from "@/components/SpeechModel";
import PracticePipeline from "@/components/PracticePipeline";
import { useAuth } from "@/components/AuthProvider";
import { asrApi, wordsApi, type AsrPredictResult, type WordItem } from "@/lib/api";
import { AudioRecorder, playDirectAudio, primeAudioPlayback, speakHindi, speakFeedback, stopSpeaking, type RecorderStatus } from "@/lib/audioRecorder";
import { publishPracticeState, resetPracticeState, subscribePracticeCommands } from "@/lib/companion";
import "./practice.css";

type Difficulty = "all" | "basic" | "intermediate" | "advanced";
type SessionResult = { word: string; score: number; correct: boolean };
const SPEEDS = [0.5, 0.75, 1];
const LETTER_GROUPS = [
  { name: "Vowels / स्वर", letters: "अ आ इ ई उ ऊ ऋ ए ऐ ओ औ".split(" ") },
  { name: "Consonants / व्यंजन", letters: "क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह".split(" ") },
];
function savePreference(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ } }

function Icon({ name, size = 20 }: { name: "arrow" | "mic" | "volume" | "stop" | "check" | "repeat" | "headphones" | "spark" | "play"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "arrow" && <><path d="M4 12h15M13 5l7 7-7 7" /></>}
    {name === "mic" && <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" /></>}
    {name === "volume" && <><path d="M11 4 5 9H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>}
    {name === "stop" && <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />}
    {name === "check" && <path d="m5 12 4 4L19 6" />}
    {name === "repeat" && <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" /></>}
    {name === "headphones" && <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>}
    {name === "spark" && <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>}
    {name === "play" && <path d="m8 4 12 8-12 8V4Z" />}
  </svg>;
}

function Guidance({ text, language }: { text: string; language: string }) {
  return <div className="practice-guidance" lang={language}>{text.split(/\n+/).filter(line => line.trim()).map((line, index) => {
    const clean = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    const heading = clean.replace(/\*\*|^#{1,4}\s*/g, "");
    const section = heading.match(/^(विश्लेषण|जीभ और मुख की स्थिति|अभ्यास सुझाव|Analysis|Tongue & Mouth Placement|Practice Recommendation)\s*[:：]?\s*(.*)$/i);
    if (section) return <div className="practice-guidance-section" key={index}><h4>{section[1]}</h4>{section[2] && <p>{section[2]}</p>}</div>;
    const parts = clean.split(/(\*\*.*?\*\*)/g);
    return <p key={index}>{parts.map((part, partIndex) => part.startsWith("**") && part.endsWith("**") ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : <span key={partIndex}>{part.replace(/^#{1,4}\s*/, "")}</span>)}</p>;
  })}</div>;
}

function PracticeLoading() {
  return <div className="practice-page page-container"><div className="practice-loading" role="status"><span className="practice-spinner" /><p>Preparing your practice space…</p></div></div>;
}

export default function PracticePage() {
  return <Suspense fallback={<PracticeLoading />}><PracticeSession /></Suspense>;
}

function PracticeSession() {
  const params = useSearchParams();
  // A changed focus link starts a distinct session and cleans up the microphone.
  return <PracticeStudio key={params.toString()} targetId={params.get("wordId")} initialDifficulty={params.get("difficulty")} initialMode={params.get("itemType")} />;
}

function PracticeStudio({ targetId, initialDifficulty, initialMode }: { targetId: string | null; initialDifficulty: string | null; initialMode: string | null }) {
  const { isLoggedIn, isLoading: authLoading, error: authError, checkAuth } = useAuth();
  const [mode, setMode] = useState<"word" | "sentence">(initialMode === "sentence" ? "sentence" : "word");
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty === "advanced" || initialDifficulty === "intermediate" || initialDifficulty === "all" ? initialDifficulty : "basic");
  const [language, setLanguage] = useState<"en" | "hi">("hi");
  const [uiLanguage, setUiLanguage] = useState<"en" | "hi">("en");
  const [speed, setSpeed] = useState(0.75);
  const [autoSpeech, setAutoSpeech] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ word: number; sentence: number } | null>(null);
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const [words, setWords] = useState<WordItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [processing, setProcessing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechSource, setSpeechSource] = useState<"word" | "feedback" | null>(null);
  const [spokenText, setSpokenText] = useState("");
  const [volume, setVolume] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<AsrPredictResult | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [results, setResults] = useState<SessionResult[]>([]);
  const [complete, setComplete] = useState(false);
  const recorder = useRef<AudioRecorder | null>(null);
  const captureBusy = useRef(false);
  const playback = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const analysisAbort = useRef<AbortController | null>(null);
  const audioGeneration = useRef(0);
  const lastAutoSpoken = useRef<string | null>(null);
  const mounted = useRef(true);
  const meterAt = useRef(0);
  const word = words[index];
  const recording = status === "recording";
  const busy = recording || status === "requesting" || processing;
  const referenceText = letter || word?.text_hi || "अ";
  const tr = (en: string, hi: string) => uiLanguage === "hi" ? hi : en;
  const feedbackTr = (en: string, hi: string) => (result?.feedback_language || language) === "hi" ? hi : en;

  useEffect(() => {
    try {
      const storedSpeed = Number(localStorage.getItem("swarsaarthi_tts_speed"));
      // Hydrate browser-only preferences after the server's deterministic first render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (SPEEDS.includes(storedSpeed)) setSpeed(storedSpeed);
      const storedLanguage = localStorage.getItem("swarsaarthi_coach_lang");
      if (storedLanguage === "hi" || storedLanguage === "en") setLanguage(storedLanguage);
      setAutoSpeech(localStorage.getItem("swarsaarthi_auto_feedback") !== "false");
      if (localStorage.getItem("swarsaarthi_ui_language") === "hi") setUiLanguage("hi");
    } catch { /* Use defaults when storage is unavailable. */ }
    setPreferencesReady(true);
    const controller = new AbortController();
    void Promise.all([wordsApi.getCounts("word", controller.signal), wordsApi.getCounts("sentence", controller.signal)]).then(([words, sentences]) => {
      if (!controller.signal.aborted) setCounts({ word: words.total, sentence: sentences.total });
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  const updateSpeed = (value: number) => { setSpeed(value); savePreference("swarsaarthi_tts_speed", String(value)); };
  const updateLanguage = (value: "en" | "hi") => { setLanguage(value); savePreference("swarsaarthi_coach_lang", value); };
  const updateUiLanguage = (value: "en" | "hi") => { setUiLanguage(value); savePreference("swarsaarthi_ui_language", value); };

  const stopAudio = useCallback(() => {
    audioGeneration.current += 1;
    stopSpeaking();
    playback.current?.pause();
    setPlaying(false);
    setSpeaking(false);
    setSpeechSource(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    recorder.current?.destroy();
    captureBusy.current = false;
    analysisAbort.current?.abort();
    // Changing the API query cancels external media and resets the associated session together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stopAudio();
    setLoading(true);
    setLoadError("");
    setError("");
    setWords([]);
    setIndex(0);
    setResult(null);
    setLetter(null);
    setResults([]);
    setComplete(false);
    setRecordingUrl("");
    setStatus("idle");
    setProcessing(false);
    async function loadWords() {
      try {
        const list = await wordsApi.getRandom(10, difficulty === "all" ? undefined : difficulty, mode, controller.signal);
        if (targetId) {
          const focus = await wordsApi.getById(targetId, controller.signal);
          if (focus.item_type === mode) list.unshift(focus);
        }
        if (generation.current !== current) return;
        setWords(list.filter((item, itemIndex, all) => all.findIndex((other) => other.id === item.id) === itemIndex).slice(0, 10));
      } catch (cause) {
        if (controller.signal.aborted || generation.current !== current) return;
        setLoadError(cause instanceof Error ? cause.message : "We couldn’t load your practice words. Please try again.");
      } finally {
        if (generation.current === current && !controller.signal.aborted) setLoading(false);
      }
    }
    void loadWords();
    return () => controller.abort();
  }, [difficulty, mode, reload, targetId, stopAudio]);

  useEffect(() => {
    mounted.current = true;
    const stopForNavigation = () => {
      generation.current += 1; audioGeneration.current += 1;
      recorder.current?.destroy(); captureBusy.current = false; analysisAbort.current?.abort();
      stopAudio(); setStatus("idle"); setProcessing(false);
    };
    window.addEventListener("swarsaarthi-navigation-start", stopForNavigation);
    return () => {
    mounted.current = false;
    generation.current += 1;
    audioGeneration.current += 1;
    recorder.current?.destroy();
    analysisAbort.current?.abort();
    stopSpeaking();
    resetPracticeState();
    window.removeEventListener("swarsaarthi-navigation-start", stopForNavigation);
    };
  }, [stopAudio]);

  useEffect(() => {
    if (!processing) return;
    const started = Date.now();
    const timer = setInterval(() => setAnalysisSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [processing]);

  useEffect(() => {
    if (!recordingUrl) return;
    const audio = playback.current;
    return () => {
      audio?.pause();
      audio?.removeAttribute("src");
      audio?.load();
      URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => {
      const elapsed = recorder.current?.elapsedSeconds ?? 0;
      setSeconds(elapsed);
      if (elapsed >= 30) recorder.current?.stopRecording();
    }, 200);
    return () => clearInterval(tick);
  }, [recording]);

  // Signing out or an expired session must also release the microphone.
  useEffect(() => {
    if (isLoggedIn || authLoading) return;
    if (!recorder.current) return;
    recorder.current?.destroy();
    captureBusy.current = false;
    analysisAbort.current?.abort();
    generation.current += 1;
    setStatus("idle");
    setProcessing(false);
  }, [isLoggedIn, authLoading]);

  const play = useCallback(async (source: "word" | "feedback", text?: string, playbackSpeed = speed) => {
    if (busy || (source === "feedback" && !result)) return;
    stopAudio();
    const current = audioGeneration.current;
    setError("");
    setPlaying(true);
    setSpeechSource(source);
    setSpokenText(text || referenceText);
    const callbacks = {
      onStart: () => { if (mounted.current && current === audioGeneration.current) setSpeaking(true); },
      onEnd: () => { if (mounted.current && current === audioGeneration.current) setSpeaking(false); },
    };
    try {
      if (source === "word") await speakHindi(text || referenceText, playbackSpeed, callbacks);
      else if (result?.feedback_audio) {
        try { await playDirectAudio(result.feedback_audio, callbacks); }
        catch (cause) {
          if (!mounted.current || current !== audioGeneration.current) return;
          const feedbackText = result.gemini_suggestion || result.feedback;
          if (!feedbackText) throw cause;
          await speakFeedback(feedbackText, result.feedback_language || language, 0.9, callbacks);
        }
      }
      else if (result) await speakFeedback(result.gemini_suggestion || result.feedback, result.feedback_language || language, 0.9, callbacks);
    } catch (cause) {
      if (mounted.current && current === audioGeneration.current) setError(cause instanceof Error ? cause.message : "Feedback audio could not play. Use Hear feedback to retry.");
    } finally {
      if (mounted.current && current === audioGeneration.current) { setPlaying(false); setSpeaking(false); setSpeechSource(null); }
    }
  }, [busy, result, speed, referenceText, language, stopAudio]);

  useEffect(() => {
    if (!preferencesReady || !autoSpeech || !result || processing || busy || lastAutoSpoken.current === result.session_id) return;
    lastAutoSpoken.current = result.session_id;
    void play("feedback");
  }, [autoSpeech, preferencesReady, result, processing, busy, play]);

  const toggleAutoSpeech = () => {
    if (!autoSpeech) { primeAudioPlayback(); lastAutoSpoken.current = null; }
    setAutoSpeech(value => { savePreference("swarsaarthi_auto_feedback", String(!value)); return !value; });
    if (autoSpeech && speechSource === "feedback") stopAudio();
  };

  const startRecording = async () => {
    if (!word || !isLoggedIn || busy || captureBusy.current) return;
    captureBusy.current = true;
    stopAudio();
    primeAudioPlayback();
    // Align the whole practice loop once, while starting. Results stay in this
    // same workspace; finishing a recording never jumps to another panel.
    document.querySelector<HTMLElement>(".practice-workspace")?.scrollIntoView({ block: "start", behavior: "instant" });
    setError("");
    setResult(null);
    setLetter(null);
    setRecordingUrl("");
    setSeconds(0);
    setVolume(0);
    recorder.current?.destroy();
    const current = ++generation.current;
    const capturedWord = word;
    recorder.current = new AudioRecorder({
      onStatusChange: (nextStatus) => { if (current === generation.current) setStatus(nextStatus); },
      onVolumeChange: (level) => {
        const now = performance.now();
        if (current === generation.current && (level === 0 || now - meterAt.current > 80)) { meterAt.current = now; setVolume(level); }
      },
      onError: (cause) => {
        if (current !== generation.current) return;
        captureBusy.current = false;
        setError(cause.name === "NotAllowedError" ? "Microphone access is blocked. Allow it in your browser’s site settings and try again." : cause.message);
        setStatus("idle");
      },
      onDataAvailable: async (blob) => {
        if (current !== generation.current) return;
        if (!blob.size) { captureBusy.current = false; setError("We didn’t capture any audio. Please try recording again."); return; }
        setRecordingUrl(URL.createObjectURL(blob));
        setAnalysisSeconds(0);
        setProcessing(true);
        const controller = new AbortController();
        analysisAbort.current = controller;
        try {
          const feedback = await asrApi.predict(blob, capturedWord.id, language, controller.signal);
          if (current !== generation.current) return;
          setResult(feedback);
          setResults((previous) => [...previous, { word: capturedWord.text_hi, score: feedback.accuracy_score, correct: feedback.is_correct }]);
        } catch (cause) {
          if (controller.signal.aborted || current !== generation.current) return;
          setError(cause instanceof Error ? cause.message : "We couldn’t analyze your recording. Please try again.");
        } finally {
          if (current === generation.current) { captureBusy.current = false; setProcessing(false); }
        }
      },
    });
    await recorder.current.startRecording();
  };

  const goToWord = (nextIndex: number) => {
    if (busy || loading || !words.length || nextIndex < 0) return;
    stopAudio();
    generation.current += 1;
    recorder.current?.destroy();
    setResult(null);
    setLetter(null);
    setError("");
    setRecordingUrl("");
    setStatus("idle");
    if (nextIndex >= words.length) setComplete(true);
    else { setComplete(false); setIndex(nextIndex); }
  };
  const nextWord = () => goToWord(index + 1);
  const tryAgain = () => {
    if (busy) return;
    stopAudio(); setResult(null); setError(""); setLetter(null); setStatus("idle");
    document.getElementById("practice-record-button")?.focus();
  };
  const cancelAnalysis = () => {
    generation.current += 1; analysisAbort.current?.abort(); captureBusy.current = false;
    setProcessing(false); setStatus("idle"); setError("Analysis stopped on this device. If the server had already finished, this attempt may still appear in your progress.");
  };

  useEffect(() => {
    publishPracticeState({ available: Boolean(word) && !complete && !loading, word: referenceText, isLoggedIn, busy,
      status: loading ? "loading" : recording ? "listening" : processing ? "analyzing" : playing ? "speaking" : error || loadError ? "error" : result ? "feedback" : "idle",
      speechSource, speed, autoSpeech, score: result?.accuracy_score ?? null, error: error || loadError || null, canNext: Boolean(word) && !complete && !busy,
    });
  }, [word, complete, loading, referenceText, isLoggedIn, busy, recording, processing, playing, error, loadError, result, speechSource, speed, autoSpeech]);
  useEffect(() => subscribePracticeCommands(command => {
    if (command === "stop") { stopAudio(); return; }
    if (command === "record" && recording) { recorder.current?.stopRecording(); return; }
    if (busy || loading || complete || !word) return;
    if (command === "listen") { if (playing) stopAudio(); else void play("word"); }
    if (command === "slower") { const nextSpeed = speed > .75 ? .75 : .5; updateSpeed(nextSpeed); void play("word", referenceText, nextSpeed); }
    if (command === "record") void startRecording();
    if (command === "repeat") tryAgain();
    if (command === "next") nextWord();
    if (command === "toggleAutoSpeech") toggleAutoSpeech();
  }));

  const accuracy = results.length ? Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length) : null;

  return <div className={`practice-page page-container ${uiLanguage === "hi" ? "practice-hindi-ui" : ""}`} lang={uiLanguage}>
    <div className="practice-breadcrumb"><Link href="/">Home</Link><span>/</span><span>Practice studio</span></div>
    <header className="practice-heading">
      <div><p className="eyebrow"><span className="practice-dot" /> {tr("YOUR DAILY MOMENT", "आपके अभ्यास का समय")}</p><h1>{uiLanguage === "hi" ? <>अपनी <em>लय पाएँ।</em></> : <>Find your <em>flow.</em></>}</h1><p>{tr("Listen. Watch the sounds take shape. Then make them yours.", "सुनें। होंठों की गति देखें। फिर अपनी आवाज़ में बोलें।")}</p></div>
      <div className="practice-heading-actions"><Link className="practice-voice-link" href="/voice">Voice studio ↗</Link><div className="practice-ui-language" aria-label="Studio interface language"><button aria-pressed={uiLanguage === "en"} onClick={() => updateUiLanguage("en")}>EN</button><button lang="hi" aria-pressed={uiLanguage === "hi"} onClick={() => updateUiLanguage("hi")}>हिन्दी</button></div><Link className="practice-progress-link" href="/profile">{tr("My progress", "मेरी प्रगति")} <Icon name="arrow" /></Link></div>
    </header>

    <section className="practice-toolbar" aria-label="Practice settings">
      <div className="practice-tabs" aria-label="Practice format">
        <button type="button" aria-pressed={mode === "word"} disabled={busy} onClick={() => setMode("word")}>{tr("Words", "शब्द")}{counts && Number.isFinite(counts.word) && <small>{counts.word}</small>}</button>
        <button type="button" aria-pressed={mode === "sentence"} disabled={busy} onClick={() => setMode("sentence")}>{tr("Sentences", "वाक्य")}{counts && Number.isFinite(counts.sentence) && <small>{counts.sentence}</small>}</button>
      </div>
      <label className="practice-select-label">{tr("Your level", "आपका स्तर")} <select value={difficulty} disabled={busy} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option value="all">{tr("Mixed · all levels", "मिश्रित · सभी स्तर")}</option><option value="basic">{tr("Foundations", "सरल")}</option><option value="intermediate">{tr("Building confidence", "मध्यम")}</option><option value="advanced">{tr("Finding fluency", "उन्नत")}</option></select></label>
      <button className="practice-fresh-set" disabled={busy || loading} onClick={() => setReload(value => value + 1)}><Icon name="repeat" size={15} />{tr("Fresh set", "नया अभ्यास")}</button>
    </section>

    {targetId && word?.id === targetId && <div className="practice-focus-banner"><span>{tr("From your focus words", "आपके ध्यान देने योग्य शब्द")} <b lang="hi">{word.text_hi}</b></span><Link href="/practice">{tr("Back to all words", "सभी शब्द देखें")} ↗</Link></div>}

    <details className="practice-process-details"><summary>{tr("Backend process · ASR → score → AI coaching → speech", "बैकएंड प्रक्रिया · वाक् पहचान → अंक → सुझाव → आवाज़")}<span>{processing ? `${analysisSeconds}s · ${tr("Processing", "प्रक्रिया जारी")}` : tr("View all stages", "सभी चरण देखें")}</span></summary>
    <PracticePipeline recording={recording} processing={processing} seconds={analysisSeconds} complete={!!result} hasCoaching={!!result?.gemini_suggestion} speaking={speaking && speechSource === "feedback"} error={error} hindi={uiLanguage === "hi"} onCancel={cancelAnalysis} />
    </details>

    <div className="practice-grid">
      <section className="practice-workspace" aria-label="Speech practice">
        <div className="practice-workspace-top"><span>THE PRACTICE STUDIO</span><span>{loading ? "Getting ready" : complete ? "Session complete" : words.length ? `${String(index + 1).padStart(2, "0")} / ${String(words.length).padStart(2, "0")}` : "Your space awaits"}</span></div>
        <div className="practice-track" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={words.length || 10} aria-valuenow={complete ? words.length : index}><span style={{ width: `${complete ? 100 : words.length ? index / words.length * 100 : 0}%` }} /></div>

        {loading ? <div className="practice-state" role="status"><span className="practice-spinner" /><h2>Making room for your voice.</h2><p>Preparing a fresh set of practice {mode === "word" ? "words" : "sentences"}.</p></div>
        : loadError ? <div className="practice-state"><div className="practice-state-icon"><Icon name="headphones" size={32} /></div><h2>A moment of quiet.</h2><p role="alert">{loadError}</p><button className="button button-dark" onClick={() => setReload((count) => count + 1)}><Icon name="repeat" /> Try again</button></div>
        : !words.length ? <div className="practice-state"><div className="practice-state-icon"><Icon name="spark" size={32} /></div><h2>Your next words are on their way.</h2><p>There are no {difficulty} {mode === "word" ? "words" : "sentences"} available yet. Try another level or practice format.</p><button className="button button-dark" onClick={() => setReload((count) => count + 1)}>Refresh practice <Icon name="repeat" /></button></div>
        : complete ? <div className="practice-state practice-complete"><div className="practice-state-icon"><Icon name="check" size={34} /></div><p className="eyebrow">YOU SHOWED UP FOR YOURSELF</p><h2>That’s how progress begins.</h2><p>{results.length ? "Every attempt is another step toward a more confident voice." : "You explored this set. When you’re ready, come back and give your voice a little room."}</p><div className="practice-complete-stats"><div><strong>{results.length}</strong><span>Completed attempts</span></div><div><strong>{accuracy === null ? "—" : `${accuracy}%`}</strong><span>Average accuracy</span></div></div><button className="button button-dark" onClick={() => setReload((count) => count + 1)}>A fresh start <Icon name="arrow" /></button><Link href="/profile">See your progress</Link></div>
        : word && <>
          <div className={`practice-word-stage ${recording ? "is-recording" : ""}`}>
            <div className="practice-orbit practice-orbit-one" aria-hidden="true" /><div className="practice-orbit practice-orbit-two" aria-hidden="true" />
            <div className="practice-word-category"><span className="practice-dot" /> {word.category.replace(/_/g, " ")}</div>
            <div className="practice-word" key={word.id}><h2 lang="hi" className={word.text_hi.length > 20 ? "practice-sentence" : ""}>{word.text_hi}</h2><p className="practice-transliteration">{word.transliteration}</p><p className="practice-meaning">{uiLanguage === "hi" ? word.meaning_hi || word.meaning_en : word.meaning_en}</p></div>
            <div className="practice-listen-controls"><button className="practice-listen" disabled={busy} onClick={() => { setLetter(null); if (playing) stopAudio(); else void play("word", word.text_hi); }}><Icon name={playing ? "stop" : "volume"} size={18} />{playing ? tr("Stop audio", "ऑडियो रोकें") : tr("Listen first", "पहले सुनें")}</button><label className="practice-speed"><span className="sr-only">Pronunciation speed</span><select aria-label="Pronunciation speed" disabled={busy || playing} value={speed} onChange={(event) => updateSpeed(Number(event.target.value))}><option value={0.5}>0.5× · {tr("Slow", "धीरे")}</option><option value={0.75}>0.75× · {tr("Relaxed", "आराम से")}</option><option value={1}>1× · {tr("Natural", "सामान्य")}</option></select></label></div>
          </div>

          <div className="practice-live-result" aria-live="polite">
            {processing ? <><span className="practice-spinner" /><div><strong>{tr("ASR · scoring · AI coaching", "वाक् पहचान · अंक · एआई सुझाव")}</strong><p>{analysisSeconds}s · {tr("Waiting for the server’s complete response", "सर्वर के पूरे उत्तर की प्रतीक्षा")}</p></div><button onClick={cancelAnalysis}>{tr("Cancel", "रद्द करें")}</button></> : result ? <><strong className="practice-inline-score">{Math.round(result.accuracy_score)}<small>%</small></strong><div><strong>{feedbackTr("Your pronunciation score", "आपका उच्चारण स्कोर")}</strong><p>{result.feedback}</p></div><button disabled={busy} onClick={tryAgain}>{tr("Try again", "फिर कोशिश करें")}</button></> : <><Icon name="spark" /><div><strong>{tr("Your result appears right here", "आपका परिणाम यहीं दिखेगा")}</strong><p>{tr("Record, follow the progress, and try again in one place.", "यहीं रिकॉर्ड करें, प्रक्रिया देखें और फिर अभ्यास करें।")}</p></div></>}
          </div>
          <div className="practice-audio-status"><span>{speaking && speechSource === "feedback" ? tr("Speaking your feedback…", "सुझाव सुनाए जा रहे हैं…") : playing && speechSource === "feedback" ? tr("Preparing feedback voice…", "सुझाव की आवाज़ तैयार हो रही है…") : autoSpeech ? tr("Automatic feedback voice is on", "स्वचालित सुझाव आवाज़ चालू है") : tr("Automatic feedback voice is off", "स्वचालित सुझाव आवाज़ बंद है")}</span><button onClick={toggleAutoSpeech}>{autoSpeech ? tr("Turn off", "बंद करें") : tr("Enable voice", "आवाज़ चालू करें")}</button>{result && <button disabled={busy} onClick={() => playing ? stopAudio() : void play("feedback")}>{playing ? tr("Stop", "रोकें") : tr("Hear feedback", "सुझाव सुनें")}</button>}</div>
          <div className="practice-record-area">
            {authLoading ? <p role="status">Getting your session ready…</p> : !isLoggedIn ? <div className="practice-signin"><p>{authError || "Your voice has a place here. Sign in to start recording and save your progress."}</p><div>{authError && <button className="button button-light" onClick={() => void checkAuth()}>Reconnect</button>}<Link className="button button-dark" href={`/login?next=${encodeURIComponent(`/practice${targetId ? `?wordId=${encodeURIComponent(targetId)}` : ""}`)}`}>Sign in to practice <Icon name="arrow" /></Link></div></div> : <>
              <div className="practice-mic-row"><div className={`practice-live-wave ${recording ? "is-active" : ""}`} aria-hidden="true">{Array.from({ length: 13 }, (_, bar) => <i key={bar} style={{ height: `${recording ? 5 + volume * (14 + ((bar * 7) % 27)) : 4 + ((bar * 11) % 14)}px` }} />)}</div>
                <button id="practice-record-button" className={`practice-mic ${recording ? "is-recording" : ""}`} aria-label={recording ? "Stop recording and analyze" : processing ? "Analyzing your pronunciation" : "Start recording"} disabled={processing || status === "requesting"} onClick={() => recording ? recorder.current?.stopRecording() : void startRecording()}>{processing || status === "requesting" ? <span className="practice-spinner" /> : <Icon name={recording ? "stop" : "mic"} size={27} />}</button>
                <div className={`practice-live-wave ${recording ? "is-active" : ""}`} aria-hidden="true">{Array.from({ length: 13 }, (_, bar) => <i key={bar} style={{ height: `${recording ? 5 + volume * (14 + ((bar * 9) % 27)) : 4 + ((bar * 13) % 14)}px` }} />)}</div>
              </div>
              <p className="practice-record-title" role="status">{processing ? "Listening to the details…" : recording ? `Listening · 0:${String(seconds).padStart(2, "0")}` : status === "requesting" ? "Allow microphone access to begin" : result ? "Make it yours. Try once more?" : "Whenever you’re ready."}</p>
              <p className="practice-record-hint">{recording ? "Speak naturally. Tap the square when you’re done. Maximum 30 seconds." : processing ? "Your pronunciation is being analyzed. This can take a little moment." : "Tap the microphone, then say what you see."}</p>
            </>}
          </div>

          {error && <div className="practice-error" role="alert">{error}</div>}
          {recordingUrl && <div className="practice-playback"><label htmlFor="practice-playback-audio">{tr("Your recording", "आपकी रिकॉर्डिंग")}</label><audio ref={playback} id="practice-playback-audio" controls src={recordingUrl} preload="metadata" onPlay={() => { audioGeneration.current += 1; stopSpeaking(); setPlaying(false); setSpeaking(false); setSpeechSource(null); }} /></div>}

          <div className="practice-workspace-bottom"><button disabled={busy || index === 0} className="practice-prev" onClick={() => goToWord(index - 1)}>← {tr("Previous", "पिछला")}</button><button disabled={busy} className="practice-next" onClick={nextWord}>{index + 1 === words.length ? tr("Finish session", "सत्र पूरा करें") : result ? mode === "word" ? tr("Next word", "अगला शब्द") : tr("Next sentence", "अगला वाक्य") : tr("Skip for now", "अभी छोड़ें")}<Icon name="arrow" size={18} /></button></div>
          <details className="practice-queue"><summary>{tr("Your practice set", "आपका अभ्यास सेट")} <span>{index + 1}/{words.length}</span></summary><div>{words.map((item, itemIndex) => <button key={item.id} disabled={busy} aria-current={index === itemIndex ? "step" : undefined} onClick={() => goToWord(itemIndex)}><span>{String(itemIndex + 1).padStart(2, "0")}</span><b lang="hi">{item.text_hi}</b>{results.some(attempt => attempt.word === item.text_hi) && <Icon name="check" size={13} />}</button>)}</div></details>
        </>}
      </section>

      <aside className="practice-sidebar">
        <section className="practice-model-card" aria-label="Visual pronunciation guide">
          <SpeechModel word={speechSource === "word" && playing ? spokenText : referenceText} isSpeaking={speaking && speechSource === "word"} speed={speed} onListen={() => playing ? stopAudio() : void play("word")} disabled={busy} loading={playing && !speaking} />
          <details className="practice-letter-lab"><summary><span>{tr("Explore Hindi sounds", "हिन्दी ध्वनियाँ देखें")}</span><span>अ → ह</span></summary><p>{tr("Tap a letter, then listen to watch its mouth movement. This is an unscored visual warm-up.", "अक्षर चुनें और सुनकर होंठों की गति देखें। यह बिना अंक वाला शुरुआती अभ्यास है।")}</p>{LETTER_GROUPS.map(group => <div className="practice-letter-group" key={group.name}><span>{group.name}</span><div>{group.letters.map(item => <button key={item} lang="hi" disabled={busy} aria-pressed={letter === item} onClick={() => { stopAudio(); setLetter(item); }}>{item}</button>)}</div></div>)}{letter && <button className="practice-letter-reset" onClick={() => { stopAudio(); setLetter(null); }}>{tr("Return to practice word", "अभ्यास शब्द पर लौटें")} ↗</button>}</details>
        </section>
        <section className={`practice-coach ${result ? "has-feedback" : ""}`} aria-labelledby="coach-heading">
          <div className="practice-coach-head"><div className="practice-coach-symbol"><Icon name="spark" size={21} /></div><div><h2 id="coach-heading">{tr("A little guidance.", "थोड़ा मार्गदर्शन।")}</h2><span>MITRA · {tr("YOUR SPEECH COMPANION", "आपका वाक् साथी")}</span></div></div>
          <div className="practice-language"><span>{tr("Feedback in", "सुझाव की भाषा")}</span><div><button aria-pressed={language === "en"} disabled={busy} onClick={() => updateLanguage("en")}>EN</button><button lang="hi" aria-pressed={language === "hi"} disabled={busy} onClick={() => updateLanguage("hi")}>हिं</button></div></div>
          <label className="practice-auto-speech"><span><Icon name="volume" size={16} />{tr("Read feedback aloud", "सुझाव अपने आप सुनाएँ")}</span><input type="checkbox" checked={autoSpeech} onChange={toggleAutoSpeech} aria-label="Read feedback aloud automatically" /><span className="practice-switch" aria-hidden="true" /></label>
          {processing ? <div className="practice-coach-processing"><div className="practice-pulse"><Icon name="spark" size={30} /></div><h3>{tr("Your feedback is on its way.", "आपके सुझाव आ रहे हैं।")}</h3><p>{tr("Follow your recording in the processing panel above.", "ऊपर दिए गए पैनल में प्रक्रिया देखें।")}</p></div> : result ? <div className="practice-feedback" aria-live="polite">
            <div className="practice-feedback-metrics"><div className="practice-score"><strong>{Math.round(result.accuracy_score)}<span>%</span></strong><span>{tr("Pronunciation accuracy", "उच्चारण सटीकता")}</span></div><div className="practice-cer"><strong>{Number.isFinite(result.cer) ? `${(result.cer * 100).toFixed(1)}%` : "—"}</strong><span>{tr("Character error rate", "अक्षर त्रुटि दर")}</span><small>{tr("Lower is better", "कम बेहतर है")}</small></div></div>
            <h3>{result.is_correct ? feedbackTr("Beautifully spoken.", "बहुत अच्छा बोला।") : feedbackTr("A step in the right direction.", "सही दिशा में एक कदम।")}</h3><p lang={result.feedback_language || language}>{result.feedback}</p>
            <div className="practice-comparison"><div><span>{tr("REFERENCE", "सही उच्चारण")}</span><p lang="hi">{result.target_text || word?.text_hi}</p><button disabled={busy} onClick={() => { setLetter(null); void play("word", result.target_text || word?.text_hi); }}><Icon name="volume" size={14} />{tr("Listen to reference", "सही उच्चारण सुनें")}</button></div><div><span>{tr("WE HEARD", "हमने सुना")}</span><p lang="hi">{result.prediction_text || tr("No speech was recognized", "आवाज़ पहचानी नहीं गई")}</p>{recordingUrl && <button onClick={() => { stopAudio(); void playback.current?.play().catch(() => setError("Your recording could not play. Please try again.")); }}><Icon name="play" size={14} />{tr("Replay your voice", "अपनी आवाज़ सुनें")}</button>}</div></div>
            {result.gemini_suggestion && <div className="practice-articulation"><span className="eyebrow">{feedbackTr("ARTICULATION COACHING", "उच्चारण मार्गदर्शन")}</span><Guidance text={result.gemini_suggestion} language={result.feedback_language || language} /></div>}
            <button className="practice-feedback-listen" onClick={() => playing ? stopAudio() : void play("feedback")} disabled={busy}><Icon name={playing ? "stop" : "volume"} size={17} /> {playing ? tr("Stop audio", "ऑडियो रोकें") : tr("Listen to feedback", "सुझाव सुनें")}</button>
            <div className="practice-feedback-actions"><button className="button button-light" disabled={busy} onClick={tryAgain}><Icon name="repeat" size={15} />{tr("Try again", "फिर कोशिश करें")}</button><button className="button button-dark" disabled={busy} onClick={nextWord}>{tr("Continue", "आगे बढ़ें")} <Icon name="arrow" size={15} /></button></div>
            <div className="practice-saved"><Icon name="check" size={14} /> {tr("Attempt saved to your progress", "प्रयास आपकी प्रगति में जुड़ गया")}</div>
          </div> : <div className="practice-coach-intro"><h3>{tr("Watch. Listen. Try.", "देखें। सुनें। बोलें।")}</h3><p>{tr("Use the visual model to explore how a sound is formed. Then record yourself and let Mitra talk you through your feedback.", "ध्वनि बनाते समय होंठों की गति देखें। फिर अपनी आवाज़ रिकॉर्ड करें और मित्र के सुझाव सुनें।")}</p><ol><li><span>01</span><div><strong>{tr("Watch the articulation.", "मुख की गति देखें।")}</strong><p>{tr("Slow down the voice to notice each movement.", "हर गति देखने के लिए आवाज़ धीमी करें।")}</p></div></li><li><span>02</span><div><strong>{tr("Speak at your own pace.", "अपनी लय में बोलें।")}</strong><p>{tr("Tap the microphone to start and stop.", "रिकॉर्डिंग शुरू और बंद करने के लिए माइक दबाएँ।")}</p></div></li><li><span>03</span><div><strong>{tr("Listen to your coach.", "अपने साथी को सुनें।")}</strong><p>{tr("Feedback reads aloud automatically. You can switch it off above.", "सुझाव अपने आप सुनाई देंगे। ऊपर से इसे बंद कर सकते हैं।")}</p></div></li></ol></div>}
        </section>
        <div className="practice-session-note"><div><span>THIS SESSION</span><Icon name="spark" size={17} /></div><p><strong>{results.length}</strong> {results.length === 1 ? "attempt" : "attempts"}<span>{accuracy === null ? "A fresh beginning" : `${accuracy}% average accuracy`}</span></p><div className="practice-session-dots" aria-hidden="true">{Array.from({ length: words.length || 10 }, (_, dot) => <i key={dot} className={dot < (complete ? words.length : index) ? "is-done" : dot === index && !complete ? "is-current" : ""} />)}</div></div>
      </aside>
    </div>
    <div className="practice-footnote"><span lang="hi">अभ्यास से आत्मविश्वास।</span><p>Confidence grows with practice.</p></div>
  </div>;
}
