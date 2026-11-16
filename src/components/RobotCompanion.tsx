"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dispatchCompanionCommand, usePracticeSnapshot, type CompanionCommand, type PracticeStatus } from "@/lib/companion";
import styles from "./RobotCompanion.module.css";

type Gesture = "wave" | "celebrate" | "nod";
type VisualState = { status: PracticeStatus; paused: boolean; gesture: Gesture; gestureAt: number; score: number | null };

function RobotGlyph({ compact = false }: { compact?: boolean }) {
  return <svg className={compact ? styles.compactGlyph : styles.glyph} viewBox="0 0 80 86" fill="none" aria-hidden="true"><path d="M40 15V8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="40" cy="6" r="4" fill="#c9dda3" /><rect x="12" y="18" width="56" height="43" rx="19" fill="#e9eddf" stroke="#728766" strokeWidth="1.5" /><rect x="18" y="25" width="44" height="29" rx="12" fill="#173d32" /><rect x="26" y="32" width="7" height="11" rx="3.5" fill="#c9dda3" /><rect x="47" y="32" width="7" height="11" rx="3.5" fill="#c9dda3" /><path d="M35 47q5 4 10 0" stroke="#c9dda3" strokeWidth="2" strokeLinecap="round" /><path d="M12 32H8v16h4m56-16h4v16h-4" stroke="#728766" strokeWidth="4" strokeLinejoin="round" /><path d="M27 61v9c0 7 26 7 26 0v-9" fill="#e9eddf" stroke="#728766" strokeWidth="1.5" /><circle cx="40" cy="67" r="4" fill="#879d67" /></svg>;
}

function RobotScene({ visual }: { visual: VisualState }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(visual);
  const invalidate = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { latest.current = visual; invalidate.current(); }, [visual]);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    let disposed = false;
    let cleanup = () => {};
    void import("three").then(T => {
      if (disposed) return;
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
      catch { setFallback(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(172, 184);
      mount.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(35, 172 / 184, .1, 30);
      camera.position.set(0, .4, 7.5); camera.lookAt(0, 0, 0);
      scene.add(new T.HemisphereLight(0xf5f6e9, 0x50604a, 2.8));
      const key = new T.DirectionalLight(0xfff9e9, 3.5); key.position.set(-3, 4, 5); scene.add(key);
      const rim = new T.DirectionalLight(0xc9dda3, 2); rim.position.set(3, 2, -2); scene.add(rim);
      const porcelain = new T.MeshStandardMaterial({ color: 0xf1f1e7, roughness: .35, metalness: .12 });
      const sage = new T.MeshStandardMaterial({ color: 0x849e69, roughness: .38, metalness: .2 });
      const forest = new T.MeshStandardMaterial({ color: 0x234a3b, roughness: .32, metalness: .3 });
      const glass = new T.MeshStandardMaterial({ color: 0x102c24, roughness: .18, metalness: .3 });
      const glow = new T.MeshStandardMaterial({ color: 0xd8e9a0, emissive: 0x94b366, emissiveIntensity: 1.1 });
      const materials = [porcelain, sage, forest, glass, glow];
      const sphere = new T.SphereGeometry(1, 20, 14);
      const geometries = new Set<InstanceType<typeof T.BufferGeometry>>([sphere]);
      type Object3D = InstanceType<typeof T.Object3D>;
      type Material = InstanceType<typeof T.MeshStandardMaterial>;
      const oval = (parent: Object3D, material: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
        const mesh = new T.Mesh(sphere, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
      };
      const hoop = (parent: Object3D, material: Material, radius: number, tube: number, x: number, y: number, z: number) => {
        const geometry = new T.TorusGeometry(radius, tube, 8, 32); geometries.add(geometry);
        const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
      };
      const robot = new T.Group(); scene.add(robot);
      oval(robot, porcelain, 0, -.45, 0, .65, .72, .46);
      oval(robot, forest, 0, -.38, .42, .4, .4, .09);
      oval(robot, sage, 0, -.38, .49, .34, .34, .07);
      hoop(robot, glow, .17, .025, 0, -.36, .56);
      oval(robot, glow, 0, -.36, .57, .065, .065, .025);
      for (let i = -1; i <= 1; i++) oval(robot, forest, i * .13, -.82, .36, .035, .05, .025);
      hoop(robot, forest, .25, .07, 0, .05, 0).rotation.x = Math.PI / 2;
      const head = new T.Group(); head.position.y = .65; robot.add(head);
      oval(head, porcelain, 0, 0, 0, .94, .75, .59);
      oval(head, sage, 0, 0, .4, .81, .57, .24);
      oval(head, glass, 0, 0, .46, .76, .52, .24);
      const eyes = [-.3, .3].map(x => oval(head, glow, x, .07, .7, .115, .16, .045));
      const mouth = oval(head, glow, 0, -.24, .7, .18, .035, .025);
      [-1, 1].forEach(side => {
        oval(head, forest, side * .91, 0, 0, .15, .3, .3);
        oval(head, sage, side * 1.01, 0, 0, .1, .24, .24);
        oval(head, porcelain, side * 1.08, 0, 0, .045, .16, .16);
        oval(head, glow, side * .53, -.23, .65, .075, .025, .025);
      });
      oval(head, sage, 0, .8, 0, .045, .18, .045);
      oval(head, glow, 0, .98, 0, .1, .1, .1);
      const arms = [-1, 1].map(side => {
        const pivot = new T.Group(); pivot.position.set(side * .64, -.12, 0); robot.add(pivot);
        oval(pivot, forest, side * .06, 0, 0, .17, .17, .17);
        oval(pivot, porcelain, side * .16, -.22, 0, .2, .3, .22);
        oval(pivot, sage, side * .21, -.43, 0, .16, .07, .17);
        oval(pivot, porcelain, side * .23, -.55, .02, .17, .14, .17);
        for (let i = -1; i <= 1; i++) oval(pivot, porcelain, side * .23 + i * .09, -.69, .07, .037, .1, .055);
        return pivot;
      });
      hoop(robot, forest, .24, .07, 0, -1.08, 0).rotation.x = Math.PI / 2;
      const jet = oval(robot, glow, 0, -1.31, 0, .17, .3, .17);
      const ring = hoop(scene, sage, .67, .025, 0, -1.72, 0); ring.rotation.x = Math.PI / 2;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      let visible = true, frame = 0, timer = 0, lastDraw = 0;
      const pointer = { x: 0, y: 0, smoothX: 0, smoothY: 0 };
      const onPointer = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        const bounds = mount.getBoundingClientRect();
        pointer.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / 180));
        pointer.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / 180));
      };
      const onPointerLeave = () => { pointer.x = 0; pointer.y = 0; };
      const render = (now: number) => {
        if (disposed || document.hidden || !visible) return;
        const t = now / 1000;
        const state = latest.current;
        const quiet = reduced.matches || state.paused;
        const speaking = state.status === "speaking", listening = state.status === "listening";
        const active = now - state.gestureAt < 2300;
        const dance = active && state.gesture === "celebrate";
        pointer.smoothX += (pointer.x - pointer.smoothX) * .12;
        pointer.smoothY += (pointer.y - pointer.smoothY) * .12;
        robot.position.y = quiet ? 0 : Math.sin(t * 2) * .055 + (dance ? Math.abs(Math.sin(t * 5)) * .1 : 0);
        robot.rotation.set(0, quiet ? 0 : pointer.smoothX * .12, quiet ? 0 : dance ? Math.sin(t * 7) * .09 : 0);
        head.rotation.set(quiet ? 0 : pointer.smoothY * .08 + (active && state.gesture === "nod" ? Math.sin(t * 4) * .08 : 0), quiet ? 0 : pointer.smoothX * .16, quiet ? 0 : listening ? Math.sin(t * 1.4) * .1 : .025);
        arms[0].rotation.z = quiet ? -.15 : active && state.gesture === "wave" || dance ? -1.8 + Math.sin(t * 8) * .25 : -.15 + Math.sin(t * 2) * .08;
        arms[1].rotation.z = quiet ? .15 : dance ? 1.8 - Math.sin(t * 8) * .25 : speaking ? .5 + Math.sin(t * 5) * .15 : .15;
        eyes.forEach((eye, index) => {
          eye.scale.y = !quiet && Math.sin(t * 1.1) > .995 ? .025 : .16;
          eye.position.x = (index === 0 ? -.3 : .3) + (quiet ? 0 : pointer.smoothX * .035);
        });
        mouth.scale.y = speaking && !quiet ? .05 + Math.abs(Math.sin(t * 11)) * .06 : .035;
        jet.scale.y = quiet ? .3 : .28 + Math.sin(t * 7) * .035;
        glow.emissive.setHex(listening ? 0xa9ca76 : state.status === "analyzing" ? 0xb8ac70 : 0x94b366);
        renderer.render(scene, camera); lastDraw = now;
      };
      const halt = () => { cancelAnimationFrame(frame); clearTimeout(timer); frame = 0; timer = 0; };
      const tick = (now: number) => {
        frame = 0;
        if (disposed || document.hidden || !visible) return;
        render(now);
        if (!reduced.matches && !latest.current.paused) timer = window.setTimeout(() => { frame = requestAnimationFrame(tick); }, 32);
      };
      const resume = () => {
        halt();
        if (!disposed && visible && !document.hidden) frame = requestAnimationFrame(tick);
      };
      invalidate.current = resume;
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resume(); else halt(); });
      observer.observe(mount);
      document.addEventListener("visibilitychange", resume);
      document.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave);
      reduced.addEventListener("change", resume);
      const contextLost = (event: Event) => { event.preventDefault(); halt(); setFallback(true); };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      if (!lastDraw) resume();
      setReady(true);
      cleanup = () => {
        halt(); observer.disconnect(); invalidate.current = () => {};
        document.removeEventListener("visibilitychange", resume);
        document.removeEventListener("pointermove", onPointer);
        document.removeEventListener("pointerleave", onPointerLeave);
        reduced.removeEventListener("change", resume);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
        renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      };
    }).catch(() => { if (!disposed) setFallback(true); });
    return () => { disposed = true; cleanup(); };
  }, []);

  return <div className={styles.scene} aria-hidden="true"><div ref={host} className={styles.canvas} hidden={fallback} />{(!ready || fallback) && <RobotGlyph />}</div>;
}

const tips = [
  "Listen once, then watch the mouth guide. Try the sound at your own pace.",
  "A quiet room helps the speech service hear you clearly.",
  "Use slower playback to notice where a tricky sound begins.",
  "A score is a guide. Your next attempt is a fresh start.",
];

function readPreference(key: string) {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
}

export default function RobotCompanion() {
  const pathname = usePathname();
  const practice = usePracticeSnapshot();
  const [open, setOpen] = useState(false);
  // This component is dynamically mounted with SSR disabled.
  const [paused, setPaused] = useState(() => readPreference("swar-mitra-paused"));
  const [discreet, setDiscreet] = useState(() => readPreference("swar-mitra-discreet"));
  const [tip, setTip] = useState<number | null>(null);
  const [gesture, setGesture] = useState<Gesture>("wave");
  const [gestureAt, setGestureAt] = useState(0);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previousScore = useRef<number | null>(null);
  const [initialPath, setInitialPath] = useState(pathname);
  const [tipContext, setTipContext] = useState({ score: practice.score, status: practice.status });

  if (initialPath !== pathname) { setInitialPath(pathname); setOpen(false); setTip(null); }
  if (tipContext.score !== practice.score || tipContext.status !== practice.status) {
    setTipContext({ score: practice.score, status: practice.status });
    setTip(null);
  }
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); launcher.current?.focus({ preventScroll: true }); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  useEffect(() => {
    const score = practice.score;
    if (score === null) { previousScore.current = null; return; }
    if (score === previousScore.current) return;
    // Start the 3D reaction on a frame boundary, synchronized with its animation clock.
    const frame = requestAnimationFrame(() => {
      previousScore.current = score;
      setGesture(score >= 80 ? "celebrate" : "nod");
      setGestureAt(performance.now());
    });
    return () => cancelAnimationFrame(frame);
  }, [practice.score]);

  const toggleOpen = () => { setOpen(value => !value); setGesture("wave"); setGestureAt(performance.now()); };
  const close = () => { setOpen(false); launcher.current?.focus({ preventScroll: true }); };
  const command = (value: CompanionCommand) => { setTip(null); dispatchCompanionCommand(value); };
  const setPreference = (key: string, value: boolean) => { try { localStorage.setItem(key, String(value)); } catch { /* Remains available for this visit. */ } };
  const recording = practice.status === "listening";
  const speaking = practice.status === "speaking";
  const preparing = practice.status === "loading" || practice.status === "analyzing";
  const canPlay = practice.available && !!practice.word && !practice.busy && !preparing;
  const subtitle = recording ? "I’m listening with you." : practice.status === "analyzing" ? "Your feedback is on its way." : speaking ? practice.speechSource === "feedback" ? "Let’s listen to your feedback." : "Watch the mouth. Hear the sound." : practice.error ? "A small pause. We can try again." : practice.score !== null ? practice.score >= 80 ? "That’s a lovely step forward." : "Every attempt teaches us something." : "A little support, right here.";
  const visual: VisualState = { status: practice.status, paused, gesture, gestureAt, score: practice.score };

  return <aside className={`${styles.companion} ${open ? styles.isOpen : ""}`} aria-label="Mitra practice companion">
    {open && <div ref={panel} id="mitra-panel" className={styles.panel} role="dialog" aria-modal="false" aria-labelledby="mitra-title">
      <div className={styles.panelHeader}><div><span className={styles.eyebrow}>YOUR PRACTICE COMPANION</span><h2 id="mitra-title">A little help from Mitra.</h2></div><button ref={closeButton} className={styles.iconButton} onClick={close} aria-label="Close Mitra">×</button></div>
      <div className={styles.introduction}><RobotScene visual={visual} /><div className={styles.liveCopy}><span className={`${styles.stateBadge} ${recording || speaking || preparing ? styles.stateActive : ""}`}><i />{recording ? "LISTENING" : preparing ? "WORKING WITH YOU" : speaking ? "SPEAKING" : "READY WHEN YOU ARE"}</span><p aria-live="polite">{tip === null ? subtitle : tips[tip]}</p>{practice.available && practice.word && <span className={styles.currentWord} lang="hi">{practice.word}</span>}</div></div>
      {practice.available ? <>
        <div className={styles.commands} aria-label="Practice shortcuts">
          <button disabled={!canPlay && !speaking} onClick={() => command(speaking ? "stop" : "listen")}><span aria-hidden="true">{speaking ? "□" : "▷"}</span><b>{speaking ? "Stop audio" : "Hear the sound"}</b><small>{speaking ? "A moment of quiet" : "Listen & watch the mouth"}</small></button>
          <button disabled={!canPlay || practice.speed <= .5} onClick={() => command("slower")}><span aria-hidden="true">◷</span><b>Take it slower</b><small>Current pace · {practice.speed}×</small></button>
          <button disabled={!practice.isLoggedIn || (!recording && (!practice.word || practice.busy || preparing))} onClick={() => command("record")}><span aria-hidden="true">{recording ? "■" : "◎"}</span><b>{recording ? "Finish recording" : "Your turn"}</b><small>{recording ? "Send for feedback" : "Start your microphone"}</small></button>
          <button disabled={!practice.canNext || practice.busy || preparing} onClick={() => command("next")}><span aria-hidden="true">↗</span><b>Next step</b><small>Move through your practice</small></button>
        </div>
        {!practice.isLoggedIn && <p className={styles.signInNote}><Link href="/login?next=/practice" onClick={() => setOpen(false)}>Sign in</Link> to record and save your progress.</p>}
        <div className={styles.feedbackSetting}><div><strong>Read my feedback aloud</strong><span>Hear your coaching after each attempt.</span></div><button role="switch" aria-checked={practice.autoSpeech} aria-label="Automatic feedback speech" disabled={practice.busy} className={styles.switch} onClick={() => command("toggleAutoSpeech")}><i /></button></div>
        {practice.score !== null && <button className={styles.retry} disabled={practice.busy} onClick={() => command("repeat")}>↺ &nbsp; Give this sound another try</button>}
      </> : <div className={styles.homeActions}><p>I can slow a sound down, help you start recording, and read your feedback. Meet me in the studio.</p><Link className={styles.primaryLink} href="/practice" onClick={() => setOpen(false)}>Open the practice studio <span>↗</span></Link><Link className={styles.secondaryLink} href="/profile" onClick={() => setOpen(false)}>See your practice journey <span>→</span></Link></div>}
      <div className={styles.panelFooter}><button onClick={() => { setTip(value => value === null ? 0 : (value + 1) % tips.length); setGesture("nod"); setGestureAt(performance.now()); }}>A practice tip</button><button aria-pressed={paused} onClick={() => { setPaused(!paused); setPreference("swar-mitra-paused", !paused); }}>{paused ? "Resume motion" : "Pause motion"}</button><button aria-pressed={discreet} onClick={() => { setDiscreet(!discreet); setPreference("swar-mitra-discreet", !discreet); }}>{discreet ? "Show label" : "Stay discreet"}</button></div>
    </div>}
    <button ref={launcher} className={`${styles.launcher} ${discreet ? styles.discreet : ""}`} onClick={toggleOpen} aria-label={open ? "Close Mitra companion" : "Open Mitra companion"} aria-expanded={open} aria-controls={open ? "mitra-panel" : undefined}><RobotGlyph compact /><span className={styles.launcherLabel}><strong>Mitra</strong><small>{recording ? "Listening…" : preparing ? "One little moment…" : speaking ? "Listen with me" : "Your practice companion"}</small></span><span className={`${styles.launcherDot} ${recording || speaking || preparing ? styles.launcherDotActive : ""}`} /></button>
  </aside>;
}
