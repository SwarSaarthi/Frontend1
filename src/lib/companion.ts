"use client";

import { useSyncExternalStore } from "react";

export type CompanionCommand = "listen" | "slower" | "record" | "repeat" | "next" | "toggleAutoSpeech" | "stop";
export type PracticeStatus = "idle" | "loading" | "listening" | "analyzing" | "speaking" | "feedback" | "error";
export interface PracticeSnapshot {
  available: boolean;
  isLoggedIn: boolean;
  busy: boolean;
  word: string;
  status: PracticeStatus;
  speechSource: "word" | "feedback" | null;
  autoSpeech: boolean;
  speed: number;
  score: number | null;
  error: string | null;
  canNext: boolean;
}

const initial: PracticeSnapshot = {
  available: false, isLoggedIn: false, busy: false, word: "", status: "idle",
  speechSource: null, autoSpeech: true, speed: .85, score: null, error: null, canNext: false,
};
let snapshot = initial;
const listeners = new Set<() => void>();
const commandListeners = new Set<(command: CompanionCommand) => void>();

/** Ephemeral, browser-only UI state. No recordings or account identifiers are stored. */
export function publishPracticeState(patch: Partial<PracticeSnapshot>): void {
  if (typeof window === "undefined") return;
  const next = { ...snapshot, ...patch };
  if ((Object.keys(next) as (keyof PracticeSnapshot)[]).every(key => next[key] === snapshot[key])) return;
  snapshot = next;
  listeners.forEach(listener => listener());
}

export function resetPracticeState(): void {
  if (typeof window === "undefined") return;
  snapshot = initial;
  listeners.forEach(listener => listener());
}

export function dispatchCompanionCommand(command: CompanionCommand): void {
  if (typeof window === "undefined" || !snapshot.available) return;
  commandListeners.forEach(listener => listener(command));
}

export function subscribePracticeCommands(listener: (command: CompanionCommand) => void): () => void {
  commandListeners.add(listener);
  return () => { commandListeners.delete(listener); };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function usePracticeSnapshot(): PracticeSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => initial);
}
