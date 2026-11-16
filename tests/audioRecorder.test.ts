import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioRecorder, playDirectAudio, speakFeedback, stopSpeaking } from "@/lib/audioRecorder";

afterEach(() => {
  stopSpeaking();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function pendingPermission() {
  let grant!: (stream: MediaStream) => void;
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { grant = resolve; }));
  const constructor = vi.fn();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", constructor);
  return { grant: () => grant(stream), stop, constructor, getUserMedia };
}

describe("microphone lifecycle", () => {
  it("releases a late permission grant after navigation without recording or delivering audio", async () => {
    const permission = pendingPermission();
    const onDataAvailable = vi.fn();
    const onError = vi.fn();
    const recorder = new AudioRecorder({ onDataAvailable, onError });
    const start = recorder.startRecording();
    recorder.destroy();
    permission.grant();
    await start;
    expect(permission.stop).toHaveBeenCalledOnce();
    expect(permission.constructor).not.toHaveBeenCalled();
    expect(onDataAvailable).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not issue competing permission requests when start is clicked twice", async () => {
    const permission = pendingPermission();
    const recorder = new AudioRecorder();
    const first = recorder.startRecording();
    await recorder.startRecording();
    expect(permission.getUserMedia).toHaveBeenCalledOnce();
    recorder.destroy();
    permission.grant();
    await first;
  });

  it("cancels an outstanding permission request and stops its late stream", async () => {
    const permission = pendingPermission();
    const recorder = new AudioRecorder();
    const start = recorder.startRecording();
    recorder.stopRecording();
    expect(recorder.status).toBe("idle");
    permission.grant();
    await start;
    expect(permission.stop).toHaveBeenCalledOnce();
    expect(permission.constructor).not.toHaveBeenCalled();
  });

  it("shows a recoverable permission error without producing a recording", async () => {
    const error = new Error("Denied");
    error.name = "NotAllowedError";
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(error) } });
    vi.stubGlobal("MediaRecorder", vi.fn());
    const onError = vi.fn();
    const onDataAvailable = vi.fn();
    const recorder = new AudioRecorder({ onError, onDataAvailable });
    await recorder.startRecording();
    expect(recorder.status).toBe("error");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Allow microphone access") }));
    expect(onDataAvailable).not.toHaveBeenCalled();
    recorder.destroy();
  });

  it("keeps the browser's MIME type and releases input tracks after recording", async () => {
    const stopTrack = vi.fn();
    const onDataAvailable = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    let capture!: FakeRecorder;
    class FakeRecorder {
      static isTypeSupported(type: string) { return type === "audio/mp4"; }
      state = "inactive";
      mimeType = "audio/mp4";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      // Capture the fake browser instance to verify event handlers are detached on cleanup.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      constructor() { capture = this; }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["recorded sample"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const recorder = new AudioRecorder({ onDataAvailable });
    await recorder.startRecording();
    expect(recorder.status).toBe("recording");
    recorder.stopRecording();
    expect(onDataAvailable).toHaveBeenCalledOnce();
    const audio: Blob = onDataAvailable.mock.calls[0][0];
    expect(audio.type).toBe("audio/mp4");
    expect(await audio.text()).toBe("recorded sample");
    expect(stopTrack).toHaveBeenCalledOnce();
    recorder.destroy();
    expect(capture.ondataavailable).toBeNull();
    expect(capture.onstop).toBeNull();
  });
});

describe("speech playback lifecycle", () => {
  it("submits full Hindi coaching in a POST body and reports service failures", async () => {
    const text = "जीभ को सहज रखें। ".repeat(50).trim();
    const request = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", request);
    await expect(speakFeedback(text)).rejects.toThrow("503");
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("/backend/api/tts");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ text, lang: "hi", speed: .9 });
  });

  it("cancels speech generation when stopped before audio arrives", async () => {
    const request = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason));
    }));
    vi.stubGlobal("fetch", request);
    const speech = speakFeedback("अभ्यास जारी रखें।");
    stopSpeaking();
    await speech;
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  });

  function audioMock() {
    const instances: FakeAudio[] = [];
    class FakeAudio {
      onplaying: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      removeAttribute = vi.fn();
      load = vi.fn();
      constructor(public src: string) { instances.push(this); }
    }
    vi.stubGlobal("Audio", FakeAudio);
    return instances;
  }

  it("stops and releases previous speech before playing the next pronunciation", async () => {
    const instances = audioMock();
    const first = playDirectAudio("first.mp3");
    const second = playDirectAudio("second.mp3");
    await first;
    expect(instances[0].pause).toHaveBeenCalledOnce();
    expect(instances[0].removeAttribute).toHaveBeenCalledWith("src");
    stopSpeaking();
    await second;
    expect(instances[1].pause).toHaveBeenCalledOnce();
    expect(instances[1].onended).toBeNull();
  });

  it("rejects stalled audio loading and clears playback resources", async () => {
    vi.useFakeTimers();
    const instances = audioMock();
    const result = expect(playDirectAudio("stalled.mp3")).rejects.toThrow("too long to load");
    await vi.advanceTimersByTimeAsync(20000);
    await result;
    expect(instances[0].pause).toHaveBeenCalledOnce();
    expect(instances[0].onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
