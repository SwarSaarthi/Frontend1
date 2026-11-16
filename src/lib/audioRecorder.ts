import { API_BASE_URL, ttsApi } from "./api";

export type RecorderStatus = "idle" | "requesting" | "recording" | "stopped" | "error";
export interface RecorderCallbacks {
  onStatusChange?: (status: RecorderStatus) => void;
  onDataAvailable?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onVolumeChange?: (volume: number) => void;
}

/** Browser audio capture with a real input meter and explicit resource cleanup. */
export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private frame: number | null = null;
  private chunks: Blob[] = [];
  private disposed = false;
  private generation = 0;
  private startedAt = 0;
  private _status: RecorderStatus = "idle";

  constructor(private callbacks: RecorderCallbacks = {}) {}
  get status(): RecorderStatus { return this._status; }
  get elapsedSeconds(): number { return this._status === "recording" ? Math.floor((Date.now() - this.startedAt) / 1000) : 0; }

  private setStatus(status: RecorderStatus) {
    this._status = status;
    this.callbacks.onStatusChange?.(status);
  }

  async startRecording(): Promise<void> {
    if (this.disposed || this._status === "requesting" || this._status === "recording") return;
    const generation = ++this.generation;
    this.setStatus("requesting");
    this.chunks = [];
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Microphone recording needs a supported browser on HTTPS or localhost.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (this.disposed || generation !== this.generation) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.recorder = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
      recorder.onstop = () => {
        if (this.disposed || generation !== this.generation) return;
        const audio = new Blob(this.chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        this.releaseStream();
        this.setStatus("stopped");
        if (audio.size) this.callbacks.onDataAvailable?.(audio);
        else this.callbacks.onError?.(new Error("No audio was captured. Please check your microphone and try again."));
      };
      recorder.onerror = () => {
        if (this.disposed || generation !== this.generation) return;
        this.generation++;
        this.releaseStream();
        this.setStatus("error");
        this.callbacks.onError?.(new Error("Recording was interrupted. Please try again."));
      };
      recorder.start(200);
      this.startedAt = Date.now();
      this.setStatus("recording");
      this.startMeter(stream);
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.releaseStream();
      this.setStatus("error");
      const name = error instanceof Error ? error.name : "";
      const message = name === "NotAllowedError" ? "Allow microphone access in your browser to begin recording."
        : name === "NotFoundError" ? "No microphone was found. Connect one and try again."
        : name === "NotReadableError" ? "Your microphone is busy. Close other recording apps and try again."
        : error instanceof Error ? error.message : "We couldn’t start your microphone.";
      this.callbacks.onError?.(new Error(message));
    }
  }

  private startMeter(stream: MediaStream) {
    if (!this.callbacks.onVolumeChange) return;
    try {
      const context = new AudioContext();
      this.context = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (this._status !== "recording" || this.disposed) return;
        analyser.getByteTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / data.length);
        this.callbacks.onVolumeChange?.(Math.min(1, rms * 5));
        this.frame = requestAnimationFrame(tick);
      };
      void context.resume().catch(() => {});
      tick();
    } catch { /* A browser can support recording without supporting the visual meter. */ }
  }

  stopRecording(): void {
    if (this._status === "requesting") {
      this.generation++;
      this.setStatus("idle");
      return;
    }
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.releaseStream();
  }

  private releaseStream() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    this.context = null;
    this.callbacks.onVolumeChange?.(0);
  }

  destroy(): void {
    this.disposed = true;
    this.generation++;
    this.callbacks = {};
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.onerror = null;
      if (this.recorder.state !== "inactive") this.recorder.stop();
    }
    this.releaseStream();
    this.recorder = null;
    this.chunks = [];
    this._status = "idle";
  }
}

let activePlayback: { stop: () => void } | null = null;
let primedAudio: HTMLAudioElement | null = null;
let playbackEpoch = 0;

/** Call synchronously during a microphone/listen gesture, before awaiting the server. */
export function primeAudioPlayback(): void {
  if (typeof Audio === "undefined" || activePlayback) return;
  try {
    primedAudio ??= new Audio();
    // A valid 20ms silent PCM WAV. Reuse this authorized element for delayed feedback.
    const bytes = new Uint8Array(44 + 320);
    const view = new DataView(bytes.buffer);
    const tag = (offset: number, value: string) => [...value].forEach((ch, i) => { bytes[offset + i] = ch.charCodeAt(0); });
    tag(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); tag(8, "WAVE"); tag(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    tag(36, "data"); view.setUint32(40, 320, true);
    primedAudio.src = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
    void primedAudio.play().catch(() => {});
  } catch { /* The normal playback path reports a recoverable error if permission is denied. */ }
}

export function stopSpeaking(): void {
  playbackEpoch++;
  activePlayback?.stop();
  activePlayback = null;
}

export interface FastTtsOptions {
  lang?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

export function playDirectAudio(src: string, callbacks: Pick<FastTtsOptions, "onStart" | "onEnd"> = {}): Promise<void> {
  stopSpeaking();
  if (!src) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const audio = primedAudio || new Audio();
    audio.src = src;
    let settled = false;
    const playback = { stop: () => finish() };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (activePlayback === playback) activePlayback = null;
      callbacks.onEnd?.();
      if (error) reject(error); else resolve();
    };
    activePlayback = playback;
    const timer = setTimeout(() => finish(new Error("Audio took too long to load. Please try again.")), 20000);
    audio.onplaying = () => { clearTimeout(timer); callbacks.onStart?.(); };
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error("Audio is unavailable right now. Please try again."));
    audio.play().catch(() => finish(new Error("Audio couldn’t play. Please try the listen button again.")));
  });
}

export function playFastTts(text: string, options: FastTtsOptions = {}): Promise<void> {
  if (!text.trim()) return Promise.resolve();
  return playDirectAudio(ttsApi.getAudioUrl(text.trim(), options.lang || "hi", options.rate ?? 0.85), options);
}

export function speakHindi(text: string, rate = 0.85, callbacks?: Pick<FastTtsOptions, "onStart" | "onEnd">) {
  return playFastTts(text, { lang: "hi", rate, ...callbacks });
}

export async function speakFeedback(text: string, lang = "hi", rate = 0.9, callbacks?: Pick<FastTtsOptions, "onStart" | "onEnd">) {
  const clean = text.replace(/[*_#`~>\[\]]/g, "").trim();
  // POST avoids very long percent-encoded Hindi URLs. Preserve all text while
  // respecting the server's 3000-character limit per synthesis request.
  const chunks: string[] = [];
  let remaining = clean;
  while (remaining.length > 2500) {
    const boundary = remaining.lastIndexOf(" ", 2500);
    const end = boundary > 0 ? boundary : 2500;
    chunks.push(remaining.slice(0, end)); remaining = remaining.slice(end).trimStart();
  }
  if (remaining) chunks.push(remaining);
  stopSpeaking();
  for (const chunk of chunks) {
    const controller = new AbortController();
    const playback = { stop: () => controller.abort() };
    activePlayback = playback;
    const timer = setTimeout(() => controller.abort(new Error("Voice generation took too long. Use Hear feedback to retry.")), 90000);
    let url = "";
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk, lang, speed: rate }), signal: controller.signal,
      });
      if (!response.ok) throw new Error(`The voice service returned ${response.status}. Use Hear feedback to retry.`);
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob.size) throw new Error("The voice service returned empty audio. Use Hear feedback to retry.");
      clearTimeout(timer);
      if (activePlayback === playback) activePlayback = null;
      url = URL.createObjectURL(blob);
      const pending = playDirectAudio(url, callbacks);
      const epoch = playbackEpoch;
      await pending;
      if (epoch !== playbackEpoch) return;
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason?.name === "AbortError") return;
      throw controller.signal.aborted ? controller.signal.reason : error;
    } finally {
      clearTimeout(timer);
      if (activePlayback === playback) activePlayback = null;
      if (url) URL.revokeObjectURL(url);
    }
  }
}
