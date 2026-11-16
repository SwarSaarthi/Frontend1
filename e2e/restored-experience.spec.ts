import { test, expect } from "@playwright/test";

const word = { id: "visual-word", text_hi: "नमस्ते", transliteration: "namaste", meaning_en: "Hello", category: "greetings", difficulty: "basic", item_type: "word" };
function silence() {
  const size = 16000 * 2 * 2, audio = Buffer.alloc(44 + size);
  audio.write("RIFF", 0); audio.writeUInt32LE(36 + size, 4); audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write("data", 36); audio.writeUInt32LE(size, 40); return audio;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem("swar-intro-v2", "seen"); localStorage.setItem("swarsaarthi_token", "qa-token"); });
  await page.route("**/backend/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/tts")) return route.fulfill({ contentType: "audio/wav", body: silence() });
    if (url.pathname.endsWith("/auth/me")) return route.fulfill({ json: { id: "qa", full_name: "Aarav", email: "qa@example.test", created_at: "2026-01-01" } });
    if (url.pathname.endsWith("/words/count")) return route.fulfill({ json: { total: 2, basic: 2 } });
    if (url.pathname.endsWith("/words/random")) return route.fulfill({ json: [word, { ...word, id: "second", text_hi: "खुशी" }] });
    if (url.pathname.endsWith("/asr/predict")) {
      expect(route.request().postDataBuffer()?.toString()).toMatch(/name="feedback_language"\r\n\r\nhi/);
      return route.fulfill({ json: { session_id: "auto-speech-test", word_id: word.id, target_text: word.text_hi, prediction_text: word.text_hi, accuracy_score: 92, cer: .08, is_correct: true, feedback: "स्पष्ट उच्चारण। अभ्यास जारी रखें।", gemini_suggestion: "जीभ को सहज रखें।", feedback_language: "hi", needs_focus: false, streak: 1 } });
    }
    return route.fulfill({ json: {} });
  });
});

test("exit and entry are coordinated across a deliberate chapter transition", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open Mitra companion" })).toBeVisible();
  const started = Date.now();
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Practice studio" }).click();
  await expect(page.locator(".chapter-transition")).toHaveAttribute("data-phase", "leaving");
  await expect(page).toHaveURL("http://localhost:3001/");
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.locator(".chapter-transition")).toHaveAttribute("data-phase", "idle", { timeout: 12000 });
  expect(Date.now() - started).toBeGreaterThan(1400);
  await expect(page.locator(".site-frame")).not.toHaveAttribute("inert");
  await page.goBack();
  await expect(page).toHaveURL("http://localhost:3001/");
  await expect(page.locator(".chapter-transition")).toHaveAttribute("data-phase", "idle", { timeout: 12000 });
});

test("restored mouth model, letter shapes and useful robot controls", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.locator(".speech-face-viewport canvas")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".speech-face-fallback")).toHaveCount(0);
  await page.getByRole("button", { name: "Watch & listen" }).click();
  await expect(page.locator(".speech-model-stage")).toHaveClass(/is-speaking/);
  await expect(page.locator(".speech-model-stage")).not.toHaveClass(/is-speaking/, { timeout: 7000 });
  await page.getByText("Explore a sound, up close", { exact: true }).click();
  await page.getByRole("button", { name: "Inspect आ: Open" }).click();
  await expect(page.locator(".speech-model-shape-hint")).toContainText("Open the jaw");
  await page.getByRole("button", { name: "Mouth close-up" }).click();
  await page.mouse.move(100, 200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/restored-model.png", fullPage: true });
  await page.getByRole("button", { name: "Open Mitra companion" }).click();
  const panel = page.getByRole("dialog", { name: "A little help from Mitra." });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /Take it slower/ }).click();
  await expect(page.getByLabel("Pronunciation speed", { exact: true })).toHaveValue("0.5");
  await panel.getByRole("switch", { name: "Automatic feedback speech" }).click();
  await expect(page.getByRole("checkbox", { name: "Read feedback aloud automatically" })).not.toBeChecked();
  await page.screenshot({ path: "test-results/restored-robot.png" });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Mitra companion" })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/restored-mobile.png", fullPage: true });
});

test("automatic feedback speech starts after analysis and preferences persist", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  const spoken: string[] = [];
  page.on("request", req => { const url = new URL(req.url()); if (url.pathname.endsWith("/tts")) { const body = req.method() === "POST" ? req.postDataJSON() : null; spoken.push(`${body?.lang || url.searchParams.get("lang")}:${body?.text || url.searchParams.get("text")}`); } });
  await page.goto("/practice");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop recording and analyze" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Stop recording and analyze" }).click();
  await expect(page.getByRole("heading", { name: "बहुत अच्छा बोला।" })).toBeVisible();
  await expect(page.locator(".practice-guidance")).toContainText("जीभ को सहज रखें।");
  await expect.poll(() => spoken).toContain("hi:जीभ को सहज रखें।");
  await expect(page.locator(".practice-cer")).toContainText("8.0%");
  await page.getByRole("checkbox", { name: "Read feedback aloud automatically" }).uncheck();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Read feedback aloud automatically" })).not.toBeChecked();
});

test("home scroll pauses unseen artwork and does not load a 3D canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open Mitra companion" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.locator("#questions").scrollIntoViewIfNeeded();
  await expect(page.locator(".hero")).toHaveAttribute("data-motion-active", "false");
  await expect(page.locator(".sculpture-parallax")).toHaveCSS("animation-play-state", "paused");
});

test("compact practice keeps recording, progress and score together", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/backend/api/asr/predict", async route => {
    await gate;
    await route.fulfill({ json: { session_id: "compact", accuracy_score: 92, cer: .08, is_correct: true, feedback: "बहुत अच्छा।", feedback_language: "hi" } });
  });
  await page.goto("/practice");
  const mic = page.getByRole("button", { name: "Start recording", exact: true });
  await expect(mic).toBeInViewport();
  await mic.click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Stop recording and analyze" }).click();
  const position = await page.evaluate(() => scrollY);
  await expect(page.locator(".practice-live-result")).toContainText("ASR");
  await expect(page.locator(".practice-live-result")).toBeInViewport();
  release();
  await expect(page.locator(".practice-inline-score")).toHaveText("92%");
  await expect(page.locator(".practice-inline-score")).toBeInViewport();
  expect((await page.locator(".practice-inline-score").boundingBox())!.y).toBeGreaterThan(95);
  expect(await page.evaluate(() => scrollY)).toBe(position);
  await page.screenshot({ path: "test-results/compact-practice.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Start recording", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator(".practice-inline-score")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("live local TTS plays Hindi feedback through the page", async ({ page, context }) => {
  test.setTimeout(120000);
  test.skip(!process.env.LIVE_TTS, "Opt in to testing the running local speech service");
  await context.grantPermissions(["microphone"]);
  await page.route("**/backend/api/tts", route => route.continue());
  await page.route("**/backend/api/asr/predict", route => route.fulfill({ json: { session_id: "live-tts", accuracy_score: 92, cer: .08, is_correct: true, feedback: "बहुत अच्छा।", gemini_suggestion: "आपका प्रयास अच्छा है। जीभ को सहज रखें और धीरे बोलें। अभ्यास जारी रखें।", feedback_language: "hi" } }));
  await page.goto("/practice");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await page.waitForTimeout(400);
  const response = page.waitForResponse(r => r.url().endsWith("/api/tts") && r.request().method() === "POST", { timeout: 95000 });
  await page.getByRole("button", { name: "Stop recording and analyze" }).click();
  const audio = await response;
  expect(audio.status()).toBe(200);
  expect(Number(audio.headers()["content-length"])).toBeGreaterThan(10000);
  await expect(page.locator(".practice-audio-status")).toContainText("Speaking your feedback", { timeout: 95000 });
});

test("delayed feedback reuses the gesture-primed player and retries broken backend audio", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const authorized = new WeakSet<HTMLMediaElement>();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.startsWith("data:audio/wav") && navigator.userActivation.isActive) authorized.add(this);
      if (!authorized.has(this)) return Promise.reject(new DOMException("Requires a user gesture", "NotAllowedError"));
      return play.call(this);
    };
  });
  await page.route("**/backend/api/asr/predict", async route => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ json: { session_id: "delayed-audio", accuracy_score: 90, cer: .1, is_correct: true, feedback: "बहुत अच्छा।", gemini_suggestion: "जीभ को सहज रखें।", feedback_language: "hi", feedback_audio: "data:audio/mpeg;base64,AAAA" } });
  });
  await page.goto("/practice");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Stop recording and analyze" }).click();
  await expect(page.getByRole("heading", { name: "बहुत अच्छा बोला।" })).toBeVisible();
  await expect(page.locator('.practice-feedback-listen')).toContainText("Stop audio");
  await expect(page.locator('.pipeline-status')).toContainText("Your coach is speaking");
  await expect(page.locator('.practice-error')).toHaveCount(0);
});

test("processing is visible above practice with honest pending and completed stages", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  let finish!: () => void;
  const released = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/backend/api/asr/predict", async route => {
    await released;
    await route.fulfill({ json: { session_id: "pipeline", accuracy_score: 90, cer: .1, is_correct: true, feedback: "बहुत अच्छा।", gemini_suggestion: "धीरे बोलें।", feedback_language: "hi" } });
  });
  await page.goto("/practice");
  await page.locator(".practice-process-details>summary").click();
  const pipeline = page.locator(".studio-pipeline");
  const bounds = await pipeline.boundingBox();
  const workspace = await page.locator(".practice-workspace").boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(workspace!.y);
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Stop recording and analyze" }).click();
  await expect(pipeline).toHaveAttribute("data-processing", "true");
  await expect(pipeline.locator('[data-state="pending"]')).toHaveCount(3);
  await expect(pipeline.getByRole("button", { name: "Cancel analysis" })).toBeVisible();
  await pipeline.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/processing-panel.png" });
  finish();
  await expect(pipeline).toHaveAttribute("data-processing", "false");
  await expect(pipeline.locator('[data-state="done"]')).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
