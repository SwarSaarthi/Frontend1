"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "./AuthProvider";
import { BrandMark, Icon } from "./Icons";
const RobotCompanion = dynamic(() => import("./RobotCompanion"), { ssr: false });

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const [intro, setIntro] = useState(false);
  const introDecision = useRef<boolean | null>(null);
  const reduced = useReducedMotion();
  const cursor = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (introDecision.current === null) {
      try {
        introDecision.current = !sessionStorage.getItem("swar-intro-v2");
        sessionStorage.setItem("swar-intro-v2", "seen");
      } catch { introDecision.current = true; }
    }
    if (!introDecision.current) return;
    setIntro(true);
    const timer = setTimeout(() => setIntro(false), 1100);
    return () => clearTimeout(timer);
  }, []);

  if (menuPath !== pathname) { setMenuPath(pathname); setMenuOpen(false); }
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0, x = 0, y = 0, target: HTMLElement | null = null, label = "";
    const move = (event: PointerEvent) => {
      x = event.clientX; y = event.clientY; target = event.target as HTMLElement;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!cursor.current) return;
        const surface = target?.closest<HTMLElement>("[data-cursor]");
        cursor.current.dataset.visible = surface ? "true" : "false";
        if (!surface) return;
        cursor.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (label !== surface.dataset.cursor) { label = surface.dataset.cursor || ""; cursor.current.textContent = label; }
      });
    };
    const leave = () => { if (cursor.current) cursor.current.dataset.visible = "false"; };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave); };
  }, [reduced]);

  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <AnimatePresence>{intro && <motion.div className="intro-screen" aria-hidden="true" initial={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: .75, ease: [.76, 0, .24, 1] }}><BrandMark /><span>SwarSaarthi<span className="intro-dot">.</span></span><small>A LITTLE PRACTICE. A LITTLE MORE YOU.</small><div className="intro-line" /></motion.div>}</AnimatePresence>
    <header className="site-header">
      <Link href="/" className="brand" aria-label="SwarSaarthi home"><BrandMark /><span>SwarSaarthi<span className="brand-dot">.</span></span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Discover</Link>
        <Link href="/practice" aria-current={pathname === "/practice" ? "page" : undefined}>Practice studio</Link>
        <Link href="/voice" aria-current={pathname === "/voice" ? "page" : undefined}>Voice studio</Link>
        <Link href="/profile" aria-current={pathname === "/profile" ? "page" : undefined}>Your journey</Link>
      </nav>
      <div className="header-actions">{isLoggedIn ? <><span className="nav-greeting">Hi, {user?.full_name.split(" ")[0]}</span><button className="text-button" onClick={logout}>Sign out</button></> : <Link href="/login" className="login-link">Log in</Link>}<Link href={isLoggedIn ? "/practice" : "/signup"} className="button button-dark button-small">{isLoggedIn ? "Keep practising" : "Find your voice"}<Icon name="arrow" /></Link></div>
      <button ref={menuButton} className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
      {menuOpen && <nav className="mobile-menu" id="mobile-menu" aria-label="Mobile navigation"><Link href="/" onClick={() => setMenuOpen(false)}>Discover</Link><Link href="/practice">Practice studio</Link><Link href="/voice">Voice studio</Link><Link href="/profile">Your journey</Link>{isLoggedIn ? <button onClick={() => { logout(); setMenuOpen(false); }}>Sign out</button> : <Link href="/login">Log in</Link>}<Link href="/signup" className="button button-dark">Get started <Icon name="arrow" /></Link></nav>}
    </header>
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><div className="footer-top"><Link href="/" className="brand"><BrandMark /><span>SwarSaarthi.</span></Link><p>Every voice deserves<br />to find its own way.</p><div className="footer-links"><Link href="/practice">Practice studio <Icon name="arrow" /></Link><Link href="/voice">Voice studio <Icon name="arrow" /></Link><Link href="/profile">Your journey <Icon name="arrow" /></Link><Link href="/#questions">A few answers <Icon name="arrow" /></Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} SwarSaarthi</span><span>Made for your voice. Built around you.</span><span className="hindi" lang="hi">हर आवाज़ मायने रखती है।</span></div><p className="footer-note">A supportive practice companion. Not a medical diagnosis or a replacement for professional speech therapy.</p></footer>
    <div className="custom-cursor" ref={cursor} data-visible="false" aria-hidden="true" />
    <RobotCompanion />
  </>;
}
