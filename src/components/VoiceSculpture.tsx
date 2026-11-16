"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

export default function VoiceSculpture({ phase, level }: { phase: VoicePhase; level: number }) {
  const mount = useRef<HTMLDivElement>(null);
  const current = useRef({ phase, level });
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { current.current = { phase, level }; }, [phase, level]);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
    catch {
      // WebGL availability is only known after attempting to initialize the renderer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnavailable(true); return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 50);
    camera.position.set(0, .3, 5.7);
    scene.add(new THREE.AmbientLight(0xe6f1c3, 2.2));
    const light = new THREE.DirectionalLight(0xffedcf, 5); light.position.set(2, 4, 3); scene.add(light);
    const rim = new THREE.DirectionalLight(0xb0dab7, 4); rim.position.set(-3, -1, -2); scene.add(rim);
    const sculpture = new THREE.Group(); scene.add(sculpture);
    const material = new THREE.MeshStandardMaterial({ color: 0xc9dab1, metalness: .52, roughness: .3 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8b18a, metalness: .5, roughness: .29 });
    const ribbons: THREE.Mesh[] = [];
    for (let n = 0; n < 7; n++) {
      const points = Array.from({ length: 96 }, (_, i) => {
        const t = i / 96 * Math.PI * 2;
        const radius = 1.03 + .14 * Math.sin(t * 3 + n * .5);
        return new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, Math.sin(t * 2) * .35);
      });
      const curve = new THREE.CatmullRomCurve3(points, true);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, .035, 7, true), n % 3 ? material : gold);
      mesh.rotation.y = n * Math.PI / 7;
      mesh.rotation.z = n * .19;
      sculpture.add(mesh); ribbons.push(mesh);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.39, 3), new THREE.MeshStandardMaterial({ color: 0xf0e8c7, roughness: .36, metalness: .45, emissive: 0x8ca35b, emissiveIntensity: .2 }));
    sculpture.add(core);
    const stars = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      const t = i * 2.39996, r = 1.5 + (i % 11) * .033;
      stars[i * 3] = Math.cos(t) * r; stars[i * 3 + 1] = Math.sin(t) * r; stars[i * 3 + 2] = Math.sin(i * 3) * .6;
    }
    const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ size: .017, color: 0xd3e7a8, transparent: true, opacity: .65 })); scene.add(dust);
    let frame = 0, visible = true, disposed = false, last = 0, pulse = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let pointerX = 0, pointerY = 0;
    const pointer = (event: PointerEvent) => { const box = host.getBoundingClientRect(); pointerX = (event.clientX - box.left) / box.width - .5; pointerY = (event.clientY - box.top) / box.height - .5; };
    const leave = () => { pointerX = 0; pointerY = 0; };
    const fit = () => { const { width, height } = host.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); };
    const resize = new ResizeObserver(fit); resize.observe(host); fit();
    function draw(now: number) {
      if (disposed || !visible || document.hidden) { frame = 0; return; }
      frame = requestAnimationFrame(draw);
      if (now - last < (reduced.matches ? 250 : 33)) return;
      last = now;
      const t = now * .0004, state = current.current;
      const energy = state.phase === "listening" ? state.level * .24 : state.phase === "speaking" ? .07 + Math.sin(t * 15) * .04 : .015;
      pulse += (energy - pulse) * .12;
      core.scale.setScalar(1 + (reduced.matches ? 0 : pulse * 1.5));
      if (!reduced.matches) {
        sculpture.rotation.y = t * (state.phase === "thinking" ? .8 : .25) + pointerX * .2;
        sculpture.rotation.x += (pointerY * .14 - sculpture.rotation.x) * .06;
        sculpture.position.y = Math.sin(t * 2) * .055;
        ribbons.forEach((ribbon, i) => { ribbon.rotation.z = i * .19 + Math.sin(t + i) * .1; ribbon.scale.setScalar(1 + pulse * Math.sin(i + t)); });
        dust.rotation.z = -t * .08;
      }
      core.material.emissiveIntensity = state.phase === "thinking" ? .55 : .2 + pulse;
      renderer.render(scene, camera);
    }
    const resume = () => { if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw); };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else resume(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame = 0; } else resume(); }); observer.observe(host);
    host.addEventListener("pointermove", pointer); host.addEventListener("pointerleave", leave); document.addEventListener("visibilitychange", visibility); resume();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      host.removeEventListener("pointermove", pointer); host.removeEventListener("pointerleave", leave); document.removeEventListener("visibilitychange", visibility);
      ribbons.forEach(ribbon => ribbon.geometry.dispose()); material.dispose(); gold.dispose(); core.geometry.dispose(); core.material.dispose(); dustGeometry.dispose(); dust.material.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className="voice-sculpture" ref={mount} role="img" aria-label={`Animated sound sculpture, ${phase}`}>
    {unavailable && <div className="voice-sculpture-fallback" aria-hidden="true"><i /><i /><i /><b>अ</b></div>}
  </div>;
}
