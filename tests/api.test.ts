import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError, asrApi, authApi, getAuthToken, profileApi, removeAuthToken,
  setAuthToken, ttsApi, wordsApi,
} from "../src/lib/api";

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function lastRequest() {
  const [url, options] = fetchMock.mock.calls.at(-1)!;
  return { url, ...options, headers: new Headers(options?.headers) };
}

beforeEach(() => {
  const values = new Map<string, string>();
  const browser = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("fetch", fetchMock);
  removeAuthToken();
  fetchMock.mockReset();
});

afterEach(() => { removeAuthToken(); vi.unstubAllGlobals(); });

describe("FastAPI client contracts", () => {
  it("uses the same-origin proxy, preserves offset zero, and omits credentials for public words", async () => {
    setAuthToken("stored-session");
    fetchMock.mockResolvedValueOnce(json([]));
    await wordsApi.list({ limit: 20, offset: 0, item_type: "word" });
    expect(lastRequest().url).toBe("/backend/api/words?limit=20&offset=0&item_type=word");
    expect(lastRequest().headers.has("Authorization")).toBe(false);
  });

  it("accepts the token-only auth response without inventing an account", async () => {
    const response = { access_token: "new-session", token_type: "bearer" };
    fetchMock.mockResolvedValueOnce(json(response));
    expect(await authApi.login({ email: "learner@example.com", password: "secret123" })).toEqual(response);
    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(lastRequest().body as string)).toEqual({ email: "learner@example.com", password: "secret123" });
  });

  it("does not sign out an existing account when a new login is rejected", async () => {
    setAuthToken("stored-session");
    fetchMock.mockResolvedValueOnce(json({ detail: "Incorrect email or password" }, 401));
    await expect(authApi.login({ email: "learner@example.com", password: "incorrect" })).rejects.toThrow("Incorrect email or password");
    expect(lastRequest().headers.has("Authorization")).toBe(false);
    expect(getAuthToken()).toBe("stored-session");
  });

  it("clears an expired session after an authenticated 401", async () => {
    setAuthToken("expired-session");
    fetchMock.mockResolvedValueOnce(json({ detail: "Session expired" }, 401));
    await expect(authApi.getMe()).rejects.toMatchObject({ status: 401, message: "Session expired" });
    expect(lastRequest().headers.get("Authorization")).toBe("Bearer expired-session");
    expect(getAuthToken()).toBeNull();
  });

  it("ignores a late 401 belonging to a previous account", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    setAuthToken("old-session");
    const request = authApi.getMe();
    setAuthToken("new-session");
    finish(json({ detail: "Old session expired" }, 401));
    await expect(request).rejects.toBeInstanceOf(ApiError);
    expect(getAuthToken()).toBe("new-session");
  });

  it("turns structured FastAPI validation details into readable field errors", async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: [{ loc: ["body", "password"], msg: "String should have at least 6 characters" }] }, 422));
    await expect(authApi.signup({ email: "learner@example.com", full_name: "Learner", password: "bad" })).rejects.toThrow("password: String should have at least 6 characters");
  });

  it.each([
    ["audio/mp4", "m4a"], ["audio/ogg;codecs=opus", "ogg"],
    ["audio/webm;codecs=opus", "webm"], ["audio/wav", "wav"],
  ])("uploads %s with the correct filename and browser multipart boundary", async (mime, extension) => {
    setAuthToken("stored-session");
    fetchMock.mockResolvedValueOnce(json({ session_id: "attempt" }));
    await asrApi.predict(new Blob(["recorded audio"], { type: mime }), "word-123", "hi");
    const request = lastRequest();
    const body = request.body as FormData;
    expect(request.url).toBe("/backend/api/asr/predict");
    expect(request.headers.get("Authorization")).toBe("Bearer stored-session");
    expect(request.headers.has("Content-Type")).toBe(false);
    expect((body.get("audio") as File).name).toBe(`recording.${extension}`);
    expect(body.get("word_id")).toBe("word-123");
    expect(body.get("feedback_language")).toBe("hi");
  });

  it("preserves cancellation and forwards the caller's AbortSignal", async () => {
    const controller = new AbortController();
    const error = new DOMException("Cancelled", "AbortError");
    fetchMock.mockRejectedValueOnce(error);
    await expect(profileApi.getSummary(controller.signal)).rejects.toBe(error);
    expect(lastRequest().signal).toBe(controller.signal);
  });

  it("reports network failures and non-JSON upstream failures without exposing HTML", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(wordsApi.list()).rejects.toMatchObject({ status: 0, message: expect.stringContaining("connection") });
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(wordsApi.list()).rejects.toMatchObject({ status: 502, message: expect.stringContaining("temporarily unavailable") });
  });

  it("encodes Hindi text and speech settings in the TTS URL", () => {
    const url = new URL(ttsApi.getAudioUrl("नमस्ते & स्वागत", "hi", 0.7), "http://localhost");
    expect(url.pathname).toBe("/backend/api/tts");
    expect(url.searchParams.get("text")).toBe("नमस्ते & स्वागत");
    expect(url.searchParams.get("speed")).toBe("0.7");
  });
});
