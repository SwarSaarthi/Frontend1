"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { AudioRecorder, primeAudioPlayback, speakFeedback, stopSpeaking } from "@/lib/audioRecorder";
import { asrApi, voiceApi, wordsApi, type VoiceMessage, type WordItem } from "@/lib/api";
import type { VoicePhase } from "@/components/VoiceSculpture";
import "./voice.css";

const VoiceSculpture = dynamic(() => import("@/components/VoiceSculpture"), { ssr: false, loading: () => <div className="voice-sculpture-loading">Preparing your sound space…</div> });
type Message = VoiceMessage & { id: number; score?: number };
type Mode = "conversation" | "practice";
const topics = [
  { label: "My day", hindi: "आज मेरा दिन कैसा रहा, इस बारे में बात करें।", icon: "01" },
  { label: "At a café", hindi: "मुझे चाय मंगाने की बातचीत का अभ्यास करवाइए।", icon: "02" },
  { label: "Introduce myself", hindi: "मुझे अपना परिचय देने का अभ्यास करवाइए।", icon: "03" },
];

export default function VoicePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("conversation");
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [active, setActive] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("A little space to speak freely.");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState("");
  const [words, setWords] = useState<WordItem[]>([]);
  const [index, setIndex] = useState(0);
  const [provider, setProvider] = useState("");
  const [speed, setSpeed] = useState(.85);
  const [scores, setScores] = useState<number[]>([]);
  const generation = useRef(0);
  const recording = useRef<AudioRecorder | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextTurn = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useRef<VoiceMessage[]>([]);
  const phaseRef = useRef<VoicePhase>("idle");
  const activeRef = useRef(false);
  const handsFreeRef = useRef(false);
  const startRef = useRef<() => void>(() => {});
  const transcript = useRef<HTMLDivElement>(null);
  const messageId = useRef(0);
  const word = words[index];

  function changePhase(value: VoicePhase) { phaseRef.current = value; setPhase(value); }
  function clearTimers() { if (timer.current) clearInterval(timer.current); if (nextTurn.current) clearTimeout(nextTurn.current); timer.current = null; nextTurn.current = null; }
  function add(role: VoiceMessage["role"], content: string, score?: number) {
    history.current = [...history.current, { role, content }].slice(-12);
    setMessages(previous => [...previous, { role, content, score, id: ++messageId.current }].slice(-100));
  }
  function stopCurrent() {
    generation.current++; clearTimers(); request.current?.abort(); recording.current?.destroy(); recording.current = null;
    stopSpeaking(); changePhase("idle"); setLevel(0);
  }
  function endSession() { stopCurrent(); activeRef.current = false; setActive(false); setHandsFree(false); handsFreeRef.current = false; setStatus("Session paused. Your conversation is still here."); }
  function fail(cause: unknown, token: number) {
    if (token !== generation.current) return;
    clearTimers(); changePhase("idle"); setLevel(0); setHandsFree(false); handsFreeRef.current = false;
    setError(cause instanceof Error ? cause.message : "Something interrupted this turn. Please try again.");
    setStatus("A small pause. You can try again.");
  }
  async function say(text: string, token: number) {
    if (token !== generation.current) return;
    changePhase("thinking"); setStatus("Preparing the Hindi voice…");
    try {
      await speakFeedback(text, "hi", speed, { onStart: () => { if (token === generation.current) { changePhase("speaking"); setStatus("Listen. Your voice coach is speaking."); } } });
      if (token !== generation.current) return;
      changePhase("idle"); setStatus("Your turn. Take your time.");
      if (handsFreeRef.current && activeRef.current) nextTurn.current = setTimeout(() => startRef.current(), 650);
    } catch (cause) { fail(cause, token); }
  }
  async function begin() {
    if (!isLoggedIn || phaseRef.current !== "idle") return;
    stopCurrent(); primeAudioPlayback(); setError(""); activeRef.current = true; setActive(true);
    document.querySelector(".voice-layout")?.scrollIntoView({ block: "start", behavior: "instant" });
    const token = generation.current;
    if (mode === "practice") {
      changePhase("thinking"); setStatus("Choosing your practice words…");
      const controller = new AbortController(); request.current = controller;
      try {
        const list = words.length ? words : await wordsApi.getRandom(10, "basic", "word", controller.signal);
        if (token !== generation.current) return;
        if (!list.length) throw new Error("No practice words are available. Try conversation mode instead.");
        setWords(list); const target = list[index] || list[0];
        const greeting = `आइए साथ अभ्यास करें। पहले सुनें और फिर बोलें। आपका शब्द है: ${target.text_hi}।`;
        add("assistant", greeting); await say(greeting, token);
      } catch (cause) { fail(cause, token); }
    } else {
      const greeting = messages.length ? "हम अपनी बातचीत जारी रखते हैं। आप क्या कहना चाहेंगे?" : "नमस्ते! मैं आपका हिंदी बातचीत साथी हूँ। आराम से बोलिए, हम एक साथ अभ्यास करेंगे। आज आपका दिन कैसा रहा?";
      add("assistant", greeting); await say(greeting, token);
    }
  }
  async function submitTurn(blob?: Blob, text?: string) {
    if (!activeRef.current) return;
    clearTimers(); setLevel(0); changePhase("thinking"); setError(""); setStatus(blob ? "Recognizing your Hindi and preparing a reply…" : "Your coach is thinking…");
    const token = generation.current;
    const controller = new AbortController(); request.current = controller;
    try {
      if (mode === "practice" && blob && word) {
        const result = await asrApi.predict(blob, word.id, "hi", controller.signal);
        if (token !== generation.current) return;
        add("user", result.prediction_text || "(आवाज़ पहचानी नहीं गई)", result.accuracy_score);
        setScores(previous => [...previous, result.accuracy_score]); setProvider("Pronunciation coaching");
        const nextIndex = result.is_correct && index + 1 < words.length ? index + 1 : index;
        const instruction = nextIndex !== index ? `अब अगला शब्द बोलें: ${words[nextIndex].text_hi}।` : `एक बार फिर बोलें: ${word.text_hi}।`;
        const reply = `${result.gemini_suggestion || result.feedback}\n\n${instruction}`;
        setIndex(nextIndex); add("assistant", reply); await say(reply, token);
      } else {
        const result = blob ? await voiceApi.turn(blob, history.current, controller.signal) : await voiceApi.chat(text || "", history.current, controller.signal);
        if (token !== generation.current) return;
        add("user", result.transcript); add("assistant", result.reply); setProvider(result.provider); setDraft("");
        await say(result.reply, token);
      }
    } catch (cause) { fail(cause, token); }
  }
  async function capture() {
    if (!isLoggedIn || !activeRef.current || phaseRef.current === "listening" || phaseRef.current === "thinking") return;
    stopCurrent(); primeAudioPlayback(); setError(""); setElapsed(0); changePhase("listening"); setStatus("Listening in Hindi. Speak naturally.");
    const token = generation.current;
    let started = 0, lastSpeech = 0, hasSpeech = false, meterAt = 0;
    const recorder = new AudioRecorder({
      onStatusChange: state => { if (state === "recording") started = Date.now(); },
      onVolumeChange: value => {
        if (token !== generation.current) return;
        if (value > .055) { lastSpeech = Date.now(); hasSpeech = true; }
        if (Date.now() - meterAt > 80 || value === 0) { setLevel(value); meterAt = Date.now(); }
      },
      onDataAvailable: blob => { if (token === generation.current) void submitTurn(blob); },
      onError: cause => fail(cause, token),
    });
    recording.current = recorder;
    await recorder.startRecording();
    if (token !== generation.current || recorder.status !== "recording") return;
    timer.current = setInterval(() => {
      const duration = (Date.now() - started) / 1000; setElapsed(Math.floor(duration));
      if (duration >= 30 || (handsFreeRef.current && hasSpeech && Date.now() - lastSpeech > 1400 && duration > 1.8)) { clearTimers(); recorder.stopRecording(); }
      else if (handsFreeRef.current && !hasSpeech && duration > 8) { recorder.destroy(); fail(new Error("No voice detected. Hands-free is paused; tap the microphone to try again."), token); }
    }, 150);
  }
  function sendText(value = draft) {
    if (!value.trim() || !isLoggedIn || phaseRef.current === "thinking" || phaseRef.current === "listening") return;
    stopCurrent(); primeAudioPlayback(); activeRef.current = true; setActive(true); void submitTurn(undefined, value.trim());
  }
  function changeMode(value: Mode) { endSession(); setMode(value); setMessages([]); history.current = []; setScores([]); setIndex(0); setError(""); setProvider(""); setStatus("A new space. Start when you’re ready."); }
  function toggleHandsFree() {
    const value = !handsFree; setHandsFree(value); handsFreeRef.current = value;
    if (!value && nextTurn.current) { clearTimeout(nextTurn.current); nextTurn.current = null; }
    if (value && activeRef.current && phaseRef.current === "idle") void capture();
  }
  useEffect(() => { startRef.current = () => { void capture(); }; });
  useEffect(() => { const box = transcript.current; if (box) box.scrollTop = box.scrollHeight; }, [messages]);
  useEffect(() => {
    const stop = () => { generation.current++; activeRef.current = false; clearTimers(); request.current?.abort(); recording.current?.destroy(); stopSpeaking(); setActive(false); setPhase("idle"); phaseRef.current = "idle"; setLevel(0); };
    const hidden = () => { if (document.hidden) stop(); };
    window.addEventListener("swarsaarthi-navigation-start", stop); document.addEventListener("visibilitychange", hidden);
    return () => { stop(); window.removeEventListener("swarsaarthi-navigation-start", stop); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  useEffect(() => { if (!isLoggedIn && !isLoading && activeRef.current) endSession(); }, [isLoggedIn, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastReply = [...messages].reverse().find(message => message.role === "assistant");
  const busy = phase === "thinking" || phase === "listening";
  return <div className="voice-page page-container">
    <header className="voice-heading"><div><p className="voice-eyebrow">A NEW WAY TO FIND YOUR VOICE</p><h1>A conversation.<br /><em>A little confidence.</em></h1></div><p>Speak. Be heard. Try again.<br />A Hindi voice companion, at your pace.</p></header>
    <div className="voice-mode-bar"><div className="voice-modes" aria-label="Voice studio mode"><button aria-pressed={mode === "conversation"} onClick={() => mode !== "conversation" && changeMode("conversation")}>Conversation<span>Talk about your world</span></button><button aria-pressed={mode === "practice"} onClick={() => mode !== "practice" && changeMode("practice")}>Guided practice<span>Listen · repeat · improve</span></button></div><Link href="/practice">Open the full practice studio ↗</Link></div>
    <div className="voice-layout">
      <section className={`voice-stage phase-${phase}`} aria-label="Voice conversation controls">
        <div className="voice-stage-top"><span><i /> SWAR / VOICE STUDIO</span><span>{active ? "SESSION OPEN" : "READY WHEN YOU ARE"}</span></div>
        <VoiceSculpture phase={phase} level={level} />
        <div className="voice-stage-copy"><p className="voice-status" role="status">{status}</p><h2 lang="hi">{mode === "practice" && word ? word.text_hi : phase === "listening" ? "आपकी बारी।" : phase === "speaking" ? "सुनिए, फिर बोलिए।" : "हर आवाज़ की अपनी जगह।"}</h2>{mode === "practice" && word && <p>{word.transliteration} · {word.meaning_en}</p>}</div>
        <div className="voice-controls">
          {!isLoggedIn ? <Link className="voice-start" href="/login?next=/voice">{isLoading ? "Checking your session…" : "Sign in to start speaking"} ↗</Link> : !active ? <button className="voice-start" onClick={() => void begin()}>Start {mode === "practice" ? "voice practice" : "a conversation"} <span>↗</span></button> : <><button className={`voice-mic ${phase === "listening" ? "is-listening" : ""}`} aria-label={phase === "listening" ? "Send voice message" : phase === "speaking" ? "Interrupt and speak" : "Speak to the coach"} disabled={phase === "thinking"} onClick={() => phase === "listening" ? recording.current?.stopRecording() : void capture()}>{phase === "thinking" ? <span className="voice-working" /> : phase === "listening" ? <span className="voice-stop-icon" /> : <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" /></svg>}</button><span className="voice-control-caption">{phase === "listening" ? `Listening · ${elapsed}s / 30s · tap to send` : phase === "speaking" ? "Tap to interrupt and speak" : phase === "thinking" ? "Preparing your next turn" : "Tap the microphone. Speak in Hindi."}</span><button className="voice-end" onClick={endSession}>End session</button></>}
        </div>
        <div className="voice-options"><label><input type="checkbox" checked={handsFree} onChange={toggleHandsFree} /> Hands-free turns</label><label>Voice pace<select value={speed} disabled={phase !== "idle"} onChange={event => setSpeed(Number(event.target.value))}><option value={.65}>Slow · 0.65×</option><option value={.85}>Relaxed · 0.85×</option><option value={1}>Natural · 1×</option></select></label></div>
        <p className="voice-privacy">{handsFree ? "After the coach finishes, your microphone opens for your next turn. Silence sends your message. End session stops it." : "Your microphone opens only when you start a turn. Recordings are processed by the speech service; conversation audio is not retained by the app."}</p>
      </section>
      <section className="voice-conversation" aria-labelledby="voice-transcript-heading">
        <header><div><p className="voice-eyebrow">THE CONVERSATION</p><h2 id="voice-transcript-heading">Words we share.</h2></div><span>{messages.filter(message => message.role === "user").length} turns</span></header>
        {mode === "practice" && <div className="voice-session-score"><span>Guided attempts <b>{scores.length}</b></span><span>Average <b>{scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : "—"}</b></span><Link href="/profile">Saved progress ↗</Link></div>}
        <div className="voice-messages" ref={transcript} role="log" aria-live="polite" aria-relevant="additions">
          {!messages.length && <div className="voice-empty"><span aria-hidden="true">“</span><h3>You don’t need<br />the perfect words.</h3><p>Start with a hello. Your coach listens, answers in Hindi, and helps you keep going.</p><p lang="hi">बस शुरुआत कीजिए।</p></div>}
          {messages.map(message => <article key={message.id} className={`voice-message from-${message.role}`}><span>{message.role === "user" ? "YOU" : "YOUR VOICE COACH"}{message.score !== undefined && <b>{Math.round(message.score)}% accuracy</b>}</span><p lang="hi">{message.content}</p>{message.role === "assistant" && <button disabled={busy || !isLoggedIn} onClick={() => { stopCurrent(); primeAudioPlayback(); void say(message.content, generation.current); }}>↻ Listen again</button>}</article>)}
        </div>
        {error && <div className="voice-error" role="alert"><p>{error}</p>{lastReply && <button disabled={busy} onClick={() => { stopCurrent(); primeAudioPlayback(); setError(""); void say(lastReply.content, generation.current); }}>Retry voice</button>}</div>}
        {mode === "conversation" && <form className="voice-text-input" onSubmit={event => { event.preventDefault(); sendText(); }}><label className="sr-only" htmlFor="voice-draft">Type a message instead</label><input id="voice-draft" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Or type a message in Hindi…" maxLength={2000} disabled={!isLoggedIn || busy} /><button type="submit" disabled={!draft.trim() || !isLoggedIn || busy} aria-label="Send typed message">↗</button></form>}
        <footer><span>{provider ? `${provider} · Hindi voice` : "Hindi conversation · spoken replies"}</span><button disabled={active} onClick={() => { setMessages([]); history.current = []; setScores([]); setIndex(0); setError(""); }}>Clear conversation</button></footer>
      </section>
    </div>
    {mode === "conversation" ? <section className="voice-topics"><div><p className="voice-eyebrow">A PLACE TO BEGIN</p><h2>What’s on your mind?</h2></div>{topics.map(topic => <button key={topic.icon} disabled={!isLoggedIn || busy} onClick={() => sendText(topic.hindi)}><span>{topic.icon}</span><strong>{topic.label}</strong><span>↗</span></button>)}</section> : <p className="voice-practice-note">Guided practice saves real pronunciation scores to your journey. Correct attempts advance to the next word; other attempts stay on the same word for another try. <Link href="/practice">All levels, letters and mouth guidance remain in the Practice studio ↗</Link></p>}
    <p className="voice-bottom-note">Turn-based voice conversation, with optional hands-free listening. Conversation transcripts stay in this page’s memory and the latest turns are sent for context. Refreshing clears them. Speech recognition can make mistakes.</p>
  </div>;
}
