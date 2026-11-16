"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icons";
import { ttsApi } from "@/lib/api";
import HomePracticePlan from "./HomePracticePlan";

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div data-reveal className={className} style={{ "--reveal-delay": `${delay}s` } as CSSProperties}>{children}</div>;
}

function SoundSculpture() {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element || !matchMedia("(pointer:fine)").matches || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    let frame = 0, rect: DOMRect | null = null, x = 0, y = 0;
    const enter = () => { rect = element.getBoundingClientRect(); };
    const move = (event: PointerEvent) => {
      x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!rect) rect = element.getBoundingClientRect();
        element.style.setProperty("--tilt-x", `${((y - rect.top) / rect.height - .5) * -8}deg`);
        element.style.setProperty("--tilt-y", `${((x - rect.left) / rect.width - .5) * 9}deg`);
      });
    };
    const leave = () => { cancelAnimationFrame(frame); frame = 0; rect = null; element.style.setProperty("--tilt-x", "0deg"); element.style.setProperty("--tilt-y", "0deg"); };
    element.addEventListener("pointerenter", enter); element.addEventListener("pointermove", move, { passive: true }); element.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", leave, { passive: true });
    return () => { leave(); element.removeEventListener("pointerenter", enter); element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", leave); window.removeEventListener("scroll", leave); };
  }, []);
  return <div ref={surface} className="sound-art" data-cursor="EXPLORE">
    <div className="art-grid" /><span className="art-top-label"><span className="status-dot" /> YOUR VOICE. IN BLOOM.</span><span className="art-coordinate">स्वर / 01</span>
    <div className="sculpture-parallax"><div className="sculpture-tilt"><svg className="sound-sculpture" viewBox="0 0 600 590" fill="none" aria-label="An abstract sculpture of flowing green sound waves" role="img"><defs><linearGradient id="ribbon" x1="100" y1="100" x2="460" y2="470" gradientUnits="userSpaceOnUse"><stop stopColor="#c1d792" /><stop offset=".3" stopColor="#5f845a" /><stop offset=".57" stopColor="#2d5942" /><stop offset=".8" stopColor="#a3bd77" /><stop offset="1" stopColor="#d6e5ad" /></linearGradient><radialGradient id="core"><stop stopColor="#244638" /><stop offset="1" stopColor="#244638" stopOpacity="0" /></radialGradient></defs><ellipse cx="302" cy="513" rx="159" ry="24" fill="url(#core)" opacity=".18" /><g className="sculpture-rings">{Array.from({ length: 38 }, (_, index) => {
      const angle = (index / 38) * Math.PI * 2;
      const cx = (300 + Math.cos(angle) * 63).toFixed(3);
      const cy = (284 + Math.sin(angle) * 65).toFixed(3);
      return <ellipse key={index} cx={cx} cy={cy} rx={(136 + Math.sin(angle * 2) * 16).toFixed(3)} ry={(193 + Math.cos(angle * 2) * 15).toFixed(3)} transform={`rotate(${index * 4.74} ${cx} ${cy})`} stroke="url(#ribbon)" strokeWidth="2.2" opacity=".9" />;
    })}</g><ellipse cx="300" cy="288" rx="78" ry="95" fill="url(#core)" opacity=".13" /></svg></div></div>
    <div className="art-bottom-label"><span>SMALL SOUNDS.<br />INFINITE POSSIBILITIES.</span><Icon name="spark" /></div>
    <div className="art-note"><span className="note-icon"><Icon name="sound" /></span><div><strong>A space for your voice</strong><span>No rush. Just your rhythm.</span></div><span className="note-indicator" /></div>
  </div>;
}

const previews = [
  { word: "नमस्ते", roman: "na·mas·te", meaning: "Hello. A small word. A beautiful beginning.", category: "EVERYDAY CONNECTIONS" },
  { word: "खुशी", roman: "khu·shi", meaning: "Happiness. Sometimes, it starts with a sound.", category: "WORDS WITH FEELING" },
  { word: "धन्यवाद", roman: "dhan·ya·vaad", meaning: "Thank you. Make a little room for gratitude.", category: "EVERYDAY CONNECTIONS" },
];

function WordPreview() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const attemptRef = useRef(0);
  useEffect(() => () => { attemptRef.current++; audioRef.current?.pause(); }, []);
  const play = async () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    const attempt = ++attemptRef.current;
    setAudioError(""); setPlaying(true);
    const audio = new Audio(ttsApi.getAudioUrl(previews[selected].word));
    audioRef.current = audio;
    audio.onended = () => { if (attempt === attemptRef.current) setPlaying(false); };
    audio.onerror = () => { if (attempt === attemptRef.current) { setPlaying(false); setAudioError("Audio is unavailable right now. Please try again when the server is connected."); } };
    try { await audio.play(); } catch { if (attempt === attemptRef.current) { setPlaying(false); setAudioError("We couldn’t play the pronunciation. Please try again."); } }
  };
  const item = previews[selected];
  return <div className="word-preview">
    <div className="preview-top"><span className="eyebrow">A LITTLE TASTE OF PRACTICE</span><span className="preview-live">INTERACTIVE PREVIEW</span></div>
    <div className="preview-body"><div className="preview-word"><span className="eyebrow">{item.category}</span><h3 lang="hi" className="hindi" key={item.word}>{item.word}</h3><span className="phonetic">/{item.roman}/</span><p>{item.meaning}</p></div><div className="preview-audio"><button className={`listen-orb ${playing ? "is-playing" : ""}`} onClick={play} aria-label={playing ? "Stop pronunciation" : `Listen to ${item.word}`}><Icon name={playing ? "sound" : "play"} /></button><span>{playing ? "Take it in…" : "Listen to the word"}</span><div className={`mini-wave ${playing ? "active" : ""}`} aria-hidden="true">{Array.from({ length: 23 }, (_, index) => <i key={index} style={{ "--h": `${(8 + (Math.sin(index * 1.8) + 1) * 16).toFixed(2)}px`, "--delay": `${index * .04}s` } as CSSProperties} />)}</div></div></div>
    {audioError && <p className="preview-error" role="alert">{audioError}</p>}
    <div className="preview-bottom"><div className="word-selector" aria-label="Choose a sample word">{previews.map((preview, index) => <button key={preview.word} aria-label={`Preview ${preview.word}`} aria-pressed={selected === index} onClick={() => { attemptRef.current++; audioRef.current?.pause(); setPlaying(false); setAudioError(""); setSelected(index); }}>0{index + 1}</button>)}</div><Link href="/practice">Make it your turn <Icon name="arrow" /></Link></div>
  </div>;
}

const questions = [
  ["What is SwarSaarthi?", "SwarSaarthi is a companion for practising Hindi speech. You can listen to a word or sentence, record yourself, and receive pronunciation feedback. It gives your practice a little structure, at a pace you choose."],
  ["Do I need to know Hindi already?", "You can start with basic words. Each practice item includes Hindi text, a Roman transliteration, and an English meaning. When you feel ready, move on to intermediate words, advanced words, or sentences."],
  ["How does pronunciation feedback work?", "Your recording is sent to the speech-analysis service, which compares the recognised speech with the practice text. You’ll see a score and feedback, with additional coaching when the service is available. Speech recognition can make mistakes; use the feedback as guidance, not a judgment of your voice."],
  ["Can I practise at my own pace?", "Absolutely. Listen again, slow down the audio, repeat a word, or move to the next one. Your personal journey keeps track of your attempts and highlights words you can return to."],
  ["Is this a replacement for a speech therapist?", "No. SwarSaarthi supports independent speech practice. It does not diagnose conditions or replace a qualified speech-language professional’s advice or treatment."],
];

export default function HomeExperience() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const home = root.current;
    if (!home) return;
    const reduced = matchMedia("(prefers-reduced-motion:reduce)");
    const reveals = home.querySelectorAll<HTMLElement>("[data-reveal]");
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { (entry.target as HTMLElement).dataset.pending = "false"; revealObserver.unobserve(entry.target); } });
    }, { rootMargin: "0px 0px -30px 0px", threshold: .05 });
    if (!reduced.matches) reveals.forEach(element => {
      if (element.getBoundingClientRect().top > innerHeight - 30) { element.dataset.pending = "true"; revealObserver.observe(element); }
    });
    const sections = home.querySelectorAll<HTMLElement>("section");
    const motionObserver = new IntersectionObserver(entries => entries.forEach(entry => { (entry.target as HTMLElement).dataset.motionActive = String(entry.isIntersecting); }), { rootMargin: "60px" });
    sections.forEach(section => motionObserver.observe(section));
    const visibility = () => { home.dataset.documentHidden = String(document.hidden); };
    const preference = () => { if (reduced.matches) reveals.forEach(el => { el.dataset.pending = "false"; }); };
    document.addEventListener("visibilitychange", visibility); reduced.addEventListener("change", preference);
    return () => { revealObserver.disconnect(); motionObserver.disconnect(); document.removeEventListener("visibilitychange", visibility); reduced.removeEventListener("change", preference); };
  }, []);
  return <div className="home-page" ref={root}>
    <HomePracticePlan />
    <section className="hero section-wrap">
      <div className="hero-copy"><Reveal><div className="eyebrow hero-eyebrow"><span className="status-dot" /> A SPEECH COMPANION, AT YOUR PACE</div><h1>A little closer<br />to <em>your voice.</em></h1><p className="hero-description">Every word is a new beginning. Find a calmer, kinder way to practise Hindi speech—and the confidence to be heard.</p><div className="hero-cta"><Link href="/practice" className="button button-dark">Let’s find your rhythm <Icon name="arrow" /></Link><a href="#how-it-works" className="text-link"><span className="circle-play"><Icon name="play" /></span>See how it works</a></div><div className="hero-footnote"><span className="little-spark">✳</span><span>A little practice.<br /><strong>A little more you.</strong></span><span className="hero-footnote-rule" /><span className="hindi hero-hindi" lang="hi">आपकी आवाज़,<br />आपका सफ़र।</span></div></Reveal></div>
      <Reveal className="hero-art-wrap" delay={.12}><SoundSculpture /></Reveal>
      <div className="hero-bottom"><a href="#approach">SCROLL TO FIND YOUR RHYTHM <span>↓</span></a><span>DESIGNED AROUND YOU, NOT THE OTHER WAY AROUND.</span></div>
    </section>

    <section className="principles-strip" aria-label="Our approach"><span><Icon name="headphones" /> Listen closely</span><i /><span><Icon name="mic" /> Speak freely</span><i /><span><Icon name="spark" /> Grow gently</span><i /><span className="hindi" lang="hi">एक शब्द, एक नई शुरुआत।</span></section>

    <section className="approach section-wrap" id="approach"><Reveal className="section-side-label"><span className="eyebrow">01 / A DIFFERENT KIND OF PRACTICE</span><span className="side-line" /></Reveal><Reveal className="approach-content"><h2>Your voice doesn’t need a deadline.<br />It needs <em>a little room to grow.</em></h2><div className="approach-columns"><p>Some days, a word comes easily. On others, it takes another try. We’re here for both. SwarSaarthi makes space for the small steps that help you move forward.</p><p>Thoughtful Hindi practice. Clear, personal feedback. And a companion that meets you exactly where you are.</p></div></Reveal></section>

    <section className="method section-wrap" id="how-it-works"><Reveal className="section-heading"><div><span className="eyebrow">02 / FIND YOUR FLOW</span><h2>Simple steps.<br /><em>Meaningful progress.</em></h2></div><p>No complicated routines.<br />Just you, your voice, and a fresh start.</p></Reveal><div className="method-grid">
      <Reveal className="method-card listen-card"><div className="card-number">01 <Icon name="headphones" /></div><div className="listen-illustration" aria-hidden="true"><span /><span /><span /><div><Icon name="sound" /></div></div><h3>Listen. Take it in.</h3><p>Hear the word clearly. Slow it down. Give each sound a little space.</p><span className="card-detail">A MOMENT TO UNDERSTAND</span></Reveal>
      <Reveal className="method-card speak-card" delay={.08}><div className="card-number">02 <Icon name="mic" /></div><div className="speak-illustration" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <span key={i} style={{ height: `${(14 + Math.sin(i * .85) ** 2 * Math.sin(i / 25 * Math.PI) * 75).toFixed(2)}px`, animationDelay: `${i * .07}s` }} />)}</div><h3>Speak. Make it yours.</h3><p>When you’re ready, press record. There’s no perfect first attempt.</p><span className="card-detail">A SAFE SPACE TO TRY</span></Reveal>
      <Reveal className="method-card grow-card" delay={.16}><div className="card-number">03 <Icon name="spark" /></div><div className="grow-illustration" aria-hidden="true"><span className="grow-stem" /><span className="grow-leaf leaf-one" /><span className="grow-leaf leaf-two" /><span className="grow-leaf leaf-three" /><span className="grow-ground" /></div><h3>Grow. A little each day.</h3><p>Get helpful feedback, revisit tricky words, and see your journey take shape.</p><span className="card-detail">PROGRESS THAT’S PERSONAL</span></Reveal>
    </div></section>

    <section className="try-section section-wrap" id="first-word"><Reveal className="try-copy"><span className="eyebrow">03 / EVERY JOURNEY STARTS SOMEWHERE</span><h2>Let’s start with<br /><em>a simple hello.</em></h2><p>You don’t have to have it all figured out.<br />Listen to a word. Let it settle. Try it your way.</p><span className="handwritten-note">Small word. Big possibility. <span>↗</span></span></Reveal><Reveal className="try-preview"><WordPreview /></Reveal></section>

    <section className="journey-section"><div className="section-wrap journey-inner"><Reveal className="journey-visual"><div className="journey-orbit orbit-one" /><div className="journey-orbit orbit-two" /><div className="journey-orbit orbit-three" /><div className="journey-symbol"><Icon name="spark" /></div><div className="journey-tag tag-one"><span /> Your own pace</div><div className="journey-tag tag-two"><Icon name="check" /> Every attempt counts</div><span className="journey-caption">GROWTH ISN’T ALWAYS A STRAIGHT LINE.</span></Reveal><Reveal className="journey-copy"><span className="eyebrow">04 / MORE THAN A SCORE</span><h2>Notice the small wins.<br /><em>They’re the big things.</em></h2><p>A word that feels a little easier. A sound you want to try again. A practice streak that’s becoming a habit.</p><p>Your journey brings these moments together, so you can see how far you’ve come—and where to go next.</p><Link className="button button-lime" href="/profile">Explore your journey <Icon name="arrow" /></Link><div className="journey-features"><span><Icon name="check" /> Personal progress</span><span><Icon name="check" /> Words to revisit</span></div></Reveal></div></section>

    <section className="faq-section section-wrap" id="questions"><Reveal className="faq-title"><span className="eyebrow">A LITTLE CLARITY</span><h2>Before you<br /><em>begin.</em></h2><p>A few things you might be wondering.</p></Reveal><Reveal className="faq-list">{questions.map(([question, answer], index) => <details key={question}><summary><span className="faq-index">0{index + 1}</span><span>{question}</span><Icon name="plus" /></summary><p>{answer}</p></details>)}</Reveal></section>

    <section className="closing-section section-wrap"><Reveal><span className="eyebrow">YOUR NEXT CHAPTER SOUNDS LIKE YOU</span><h2>One word today.<br /><em>A little more confidence tomorrow.</em></h2><Link href="/signup" className="button button-dark">Begin your journey <Icon name="arrow" /></Link><span className="closing-note">Come as you are. Start where you are.</span></Reveal><span className="closing-flower" aria-hidden="true">✳</span></section>
  </div>;
}
