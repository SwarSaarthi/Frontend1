"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import "./speech-model.css";

const ThreeSpeechFace = dynamic(() => import("./ThreeSpeechFace"), {
  ssr: false,
  loading: () => <div className="speech-model-loading" role="status"><div className="speech-model-loading-orbit" /><span>Preparing your visual speech guide…</span></div>,
});

export interface SpeechModelProps {
  word: string;
  isSpeaking: boolean;
  speed: number;
  onListen: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const shapes = [
  { symbol: "आ", name: "Open", hint: "आ / aa — Open the jaw gently. Let the vowel flow without rounding your lips." },
  { symbol: "ई", name: "Spread", hint: "ई / ee — Spread the lips softly and keep the tongue high toward the front." },
  { symbol: "ऊ", name: "Round", hint: "ऊ / oo — Bring the lips forward into a rounded shape." },
  { symbol: "त", name: "Dental", hint: "त / ta — Bring the tongue tip toward the upper teeth, then release." },
  { symbol: "ट", name: "Curl", hint: "ट / ṭa — Curl the tongue tip slightly back toward the roof of the mouth." },
  { symbol: "प", name: "Close", hint: "प / pa — Close both lips briefly, then release a small burst of air." },
  { symbol: "व", name: "Lip + teeth", hint: "व / va — Bring the lower lip gently toward the upper teeth." },
] as const;

function Speaker({ stop = false }: { stop?: boolean }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{stop ? <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /> : <><path d="m11 4-6 5H2v6h3l6 5V4Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>}</svg>;
}

export default function SpeechModel({ word, isSpeaking, speed, onListen, disabled = false, loading = false }: SpeechModelProps) {
  const [inspectSymbol, setInspectSymbol] = useState<string | null>(null);
  const [followPointer, setFollowPointer] = useState(true);
  const [closeUp, setCloseUp] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [lastDemonstration, setLastDemonstration] = useState({ word, isSpeaking });
  if (lastDemonstration.word !== word || lastDemonstration.isSpeaking !== isSpeaking) {
    setLastDemonstration({ word, isSpeaking });
    setInspectSymbol(null);
  }
  const shape = shapes.find(item => item.symbol === inspectSymbol);

  return <section className="speech-model" aria-labelledby="speech-model-heading">
    <div className="speech-model-heading"><div><span className="speech-model-kicker">SEE THE SOUND</span><h2 id="speech-model-heading">Your visual speech guide.</h2></div><button type="button" className="speech-model-collapse" aria-expanded={expanded} aria-controls="speech-model-content" onClick={() => setExpanded(value => !value)}>{expanded ? "Hide" : "Show"}<span aria-hidden="true">{expanded ? "−" : "+"}</span></button></div>
    {expanded && <div id="speech-model-content">
      <div className={`speech-model-stage ${isSpeaking ? "is-speaking" : ""}`}>
        <div className="speech-model-stage-label"><span className="speech-model-status"><i />{loading ? "Preparing audio" : isSpeaking ? "Speaking with you" : shape ? "Exploring a sound" : "Ready when you are"}</span><span>{speed}×</span></div>
        <ThreeSpeechFace word={word} isSpeaking={isSpeaking} speed={speed} inspectSymbol={inspectSymbol} trackPointer={followPointer} closeUp={closeUp} />
        <div className="speech-model-view-controls"><button type="button" aria-pressed={closeUp} onClick={() => setCloseUp(value => !value)}>{closeUp ? "Full view" : "Mouth close-up"}<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M3 7V3h4m6 0h4v4m0 6v4h-4m-6 0H3v-4" /></svg></button><button type="button" aria-pressed={followPointer} onClick={() => setFollowPointer(value => !value)}><span className="speech-model-switch" />Follow pointer</button></div>
      </div>
      <div className="speech-model-lesson"><button type="button" className="speech-model-listen" disabled={disabled || loading} onClick={() => { setInspectSymbol(null); onListen(); }}><Speaker stop={isSpeaking} /><span>{loading ? "Preparing pronunciation…" : isSpeaking ? "Stop demonstration" : "Watch & listen"}</span><span className="speech-model-listen-word" lang="hi">{word}</span></button><p>Watch the lips, jaw, and tongue as the word is spoken.</p></div>
      <details className="speech-model-inspector"><summary><span>Explore a sound, up close</span><span aria-hidden="true">+</span></summary><div className="speech-model-shapes" aria-label="Hindi mouth-shape examples">{shapes.map(item => <button type="button" key={item.symbol} aria-pressed={inspectSymbol === item.symbol} aria-label={`Inspect ${item.symbol}: ${item.name}`} disabled={disabled || isSpeaking || loading} onClick={() => setInspectSymbol(current => current === item.symbol ? null : item.symbol)}><span lang="hi">{item.symbol}</span><small>{item.name}</small></button>)}</div><p className="speech-model-shape-hint" aria-live="polite">{shape?.hint || "Choose a letter to hold its mouth shape. Listen to the practice word to see the sounds move together."}</p>{shape && <button type="button" className="speech-model-reset" onClick={() => setInspectSymbol(null)}>Return to a relaxed mouth <span aria-hidden="true">↗</span></button>}</details>
      <p className="speech-model-caption">An illustrative articulation guide. Mouth timing is estimated from the text; listen to the audio for the pronunciation.</p>
    </div>}
  </section>;
}
