"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "./Icons";
import "./navigation-transition.css";

type Phase = "idle" | "leaving" | "covered" | "entering";
type Navigate = (href: string, options?: { replace?: boolean }) => void;
const NavigationContext = createContext<Navigate | null>(null);
const chapters: Record<string, [string, string, string]> = {
  "/": ["01", "A little possibility.", "Discover your rhythm"],
  "/practice": ["02", "Make room for your voice.", "The practice studio"],
  "/voice": ["05", "A conversation begins.", "The voice studio"],
  "/profile": ["03", "Every step belongs to you.", "Your personal journey"],
  "/login": ["04", "Welcome back to your rhythm.", "Your space is waiting"],
  "/signup": ["04", "A beautiful place to begin.", "Your next chapter"],
};

function LocationCommit({ onCommit }: { onCommit: (location: string) => void }) {
  const pathname = usePathname();
  const query = useSearchParams();
  const key = pathname + (query.size ? `?${query.toString()}` : "");
  useEffect(() => onCommit(key), [key, onCommit]);
  return null;
}

export function NavigationTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [chapter, setChapter] = useState(chapters["/"]);
  const [notice, setNotice] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const pending = useRef<{ key: string; started: number; committed: boolean; hash: string } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const current = useRef<string | null>(null);
  const schedule = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  const reset = useCallback(() => {
    clearTimers(); pending.current = null; setPhase("idle");
    document.documentElement.removeAttribute("data-navigating");
    if (frame.current) frame.current.inert = false;
  }, [clearTimers]);

  const reveal = useCallback(() => {
    const request = pending.current;
    if (!request || request.committed) return;
    request.committed = true;
    schedule(() => {
      if (pending.current !== request) return;
      if (request.hash) document.getElementById(decodeURIComponent(request.hash.slice(1)))?.scrollIntoView({ behavior: "instant" });
      else window.scrollTo({ top: 0, behavior: "instant" });
      setPhase("entering");
      schedule(() => {
        reset();
        document.querySelector<HTMLElement>("#main-content")?.focus({ preventScroll: true });
      }, 650);
    }, Math.max(0, 950 - (performance.now() - request.started)));
  }, [reset, schedule]);

  const prepare = useCallback((url: URL) => {
    setNotice("");
    pending.current = { key: url.pathname + url.search, hash: url.hash, started: performance.now(), committed: false };
    setChapter(chapters[url.pathname] || ["→", "Your next chapter.", "SwarSaarthi"]);
    setPhase("leaving");
    document.documentElement.setAttribute("data-navigating", "true");
    if (frame.current) frame.current.inert = true;
    window.dispatchEvent(new Event("swarsaarthi-navigation-start"));
    schedule(() => setPhase("covered"), 560);
    // Release the interface if a route fails to commit. Never leave a blocking curtain behind.
    schedule(() => { reset(); setNotice("That page is taking longer than expected. You can try the link again."); }, 10000);
  }, [reset, schedule]);

  const navigate = useCallback<Navigate>((href, options) => {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !["http:", "https:"].includes(url.protocol)) return;
    const key = url.pathname + url.search;
    if (pending.current || key === window.location.pathname + window.location.search) {
      if (!pending.current && url.hash) document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const push = () => options?.replace ? router.replace(key + url.hash, { scroll: false }) : router.push(key + url.hash, { scroll: false });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.dispatchEvent(new Event("swarsaarthi-navigation-start"));
      if (options?.replace) router.replace(key + url.hash); else router.push(key + url.hash);
      return;
    }
    router.prefetch(key);
    prepare(url);
    schedule(push, 600);
  }, [prepare, router, schedule]);

  const onCommit = useCallback((key: string) => {
    current.current = key;
    if (pending.current?.key === key) reveal();
  }, [reveal]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || anchor.dataset.noTransition !== undefined || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search || !["http:", "https:"].includes(url.protocol)) return;
      event.preventDefault();
      navigate(url.href);
    };
    const pop = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      reset(); prepare(new URL(location.href));
      // The browser has already changed history; the App Router commits the destination next.
      if (current.current === location.pathname + location.search) reveal();
    };
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop);
    return () => { document.removeEventListener("click", click, true); window.removeEventListener("popstate", pop); reset(); };
  }, [navigate, prepare, reset, reveal]);

  return <NavigationContext.Provider value={navigate}>
    <Suspense fallback={null}><LocationCommit onCommit={onCommit} /></Suspense>
    <div ref={frame} className="site-frame" data-route-phase={phase} aria-busy={phase !== "idle"}>{children}</div>
    <div className="chapter-transition" data-phase={phase} aria-hidden={phase === "idle"}>
      <div className="chapter-panel panel-a" /><div className="chapter-panel panel-b" /><div className="chapter-panel panel-c" />
      <div className="chapter-content"><div className="chapter-top"><BrandMark /><span>SWARSAARTHI / CHAPTER {chapter[0]}</span></div><p>{chapter[1]}</p><div className="chapter-bottom"><span>{chapter[2]}</span><div className="chapter-wave" aria-hidden="true">{[12, 24, 38, 22, 34, 16, 26].map((height, i) => <i key={i} style={{ height }} />)}</div></div></div>
    </div>
    <span className="navigation-status" role="status" aria-live="polite">{phase !== "idle" ? `Opening ${chapter[2]}` : notice}</span>
  </NavigationContext.Provider>;
}

export function useAnimatedNavigate() {
  const navigate = useContext(NavigationContext);
  if (!navigate) throw new Error("useAnimatedNavigate requires NavigationTransition");
  return navigate;
}
