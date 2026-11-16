import type {
  AsrPredictResult, AuthResponse, DifficultyProgress, FeedbackLanguage,
  FocusWordItem, PracticeHistoryItem, PracticeSubmitPayload, PracticeSubmitResult,
  ProfileSummary, StreakDay, User, WordCounts, WordItem,
} from "./types";

export type * from "./types";

// The default same-origin proxy keeps local ports and CORS out of browser calls.
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/backend").replace(/\/$/, "");
export const AUTH_STORAGE_KEY = "swarsaarthi_token";
export const AUTH_CHANGED_EVENT = "swarsaarthi_auth_changed";

export type VoiceMessage = { role: "user" | "assistant"; content: string };
export type VoiceReply = { transcript: string; reply: string; provider: string };
export const voiceApi = {
  chat: (text: string, history: VoiceMessage[], signal?: AbortSignal) => apiFetch<VoiceReply>("/api/voice/chat", { method: "POST", body: JSON.stringify({ text, history: history.slice(-12) }), signal }),
  turn: (audio: Blob, history: VoiceMessage[], signal?: AbortSignal) => {
    const body = new FormData();
    const extension = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
    body.append("audio", audio, `voice.${extension}`);
    body.append("history", JSON.stringify(history.slice(-12)));
    return apiFetch<VoiceReply>("/api/voice/turn", { method: "POST", body, signal });
  },
};

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(AUTH_STORAGE_KEY) ?? memoryToken; }
  catch { return memoryToken; }
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  memoryToken = token;
  try { window.localStorage.setItem(AUTH_STORAGE_KEY, token); } catch { /* Session works in memory if storage is blocked. */ }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function removeAuthToken(): void {
  if (typeof window === "undefined") return;
  memoryToken = null;
  try { window.localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* Storage can be disabled by the browser. */ }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const value = body as { detail?: unknown; message?: unknown };
  if (typeof value.detail === "string") return value.detail;
  if (typeof value.message === "string") return value.message;
  // FastAPI validation errors are structured arrays, not user-facing strings.
  if (Array.isArray(value.detail)) {
    return value.detail.map((item: { msg?: string; loc?: (string | number)[] }) => {
      const field = item.loc?.filter((part) => part !== "body").join(" ");
      return `${field ? `${field}: ` : ""}${item.msg || "Invalid value"}`;
    }).join(". ");
  }
  return null;
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const token = authenticated ? getAuthToken() : null;
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("We couldn’t reach SwarSaarthi. Please check your connection and try again.", 0);
  }
  if (!response.ok) {
    // Do not let an old request sign out a newly authenticated account.
    if (response.status === 401 && token && token === getAuthToken()) removeAuthToken();
    let detail: string | null = null;
    try { detail = errorMessage(await response.json()); } catch { /* Reverse proxies can return HTML error pages. */ }
    throw new ApiError(detail || (response.status >= 500
      ? "SwarSaarthi is temporarily unavailable. Please try again shortly."
      : `This request couldn’t be completed (${response.status}).`), response.status);
  }
  return response.json() as Promise<T>;
}

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") query.set(key, String(value));
  return query.size ? `?${query.toString()}` : "";
}

export const authApi = {
  signup: (data: { email: string; password: string; full_name: string }) =>
    apiFetch<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }, false),
  login: (data: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }, false),
  getMe: (signal?: AbortSignal) => apiFetch<User>("/api/auth/me", { signal }),
  logout: removeAuthToken,
};

export const wordsApi = {
  list: (params: { difficulty?: string; category?: string; item_type?: string; limit?: number; offset?: number } = {}, signal?: AbortSignal) =>
    apiFetch<WordItem[]>(`/api/words${queryString(params)}`, { signal }, false),
  getRandom: (count = 10, difficulty?: string, item_type?: string, signal?: AbortSignal) =>
    apiFetch<WordItem[]>(`/api/words/random${queryString({ count, difficulty, item_type })}`, { signal }, false),
  getCounts: (item_type?: string, signal?: AbortSignal) =>
    apiFetch<WordCounts>(`/api/words/count${queryString({ item_type })}`, { signal }, false),
  getCategories: (item_type?: string, signal?: AbortSignal) =>
    apiFetch<string[]>(`/api/words/categories${queryString({ item_type })}`, { signal }, false),
  getById: (id: string, signal?: AbortSignal) => apiFetch<WordItem>(`/api/words/${encodeURIComponent(id)}`, { signal }, false),
};

export const practiceApi = {
  submit: (payload: PracticeSubmitPayload, signal?: AbortSignal) =>
    apiFetch<PracticeSubmitResult>("/api/practice/submit", { method: "POST", body: JSON.stringify(payload), signal }),
  getHistory: (limit = 20, offset = 0, signal?: AbortSignal) =>
    apiFetch<{ items: PracticeHistoryItem[]; limit: number; offset: number }>(`/api/practice/history${queryString({ limit, offset })}`, { signal }),
};

export const profileApi = {
  getSummary: (signal?: AbortSignal) => apiFetch<ProfileSummary>("/api/profile", { signal }),
  getFocusWords: (limit = 20, signal?: AbortSignal) =>
    apiFetch<{ focus_words: FocusWordItem[]; count: number }>(`/api/profile/focus-words${queryString({ limit })}`, { signal }),
  getStreakCalendar: (days = 180, signal?: AbortSignal) =>
    apiFetch<{ calendar: StreakDay[] }>(`/api/profile/streak-calendar${queryString({ days })}`, { signal }),
  getProgress: (signal?: AbortSignal) => apiFetch<DifficultyProgress>("/api/profile/progress", { signal }),
};

export const asrApi = {
  predict: (audio: Blob, wordId: string, feedbackLanguage: FeedbackLanguage = "hi", signal?: AbortSignal) => {
    const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm";
    const body = new FormData();
    body.append("audio", audio, `recording.${extension}`);
    body.append("word_id", wordId);
    body.append("feedback_language", feedbackLanguage);
    return apiFetch<AsrPredictResult>("/api/asr/predict", { method: "POST", body, signal });
  },
};

export const ttsApi = {
  getAudioUrl: (text: string, lang = "hi", speed = 0.85) => `${API_BASE_URL}/api/tts${queryString({ text, lang, speed })}`,
};
