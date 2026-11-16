import { test, expect } from "@playwright/test";

function audio() {
  const samples = 16000, data = Buffer.alloc(44 + samples);
  data.write("RIFF"); data.writeUInt32LE(36 + samples, 4); data.write("WAVEfmt ", 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(16000, 24); data.writeUInt32LE(32000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(samples, 40); return data;
}
const word = { id: "voice-word", text_hi: "नमस्ते", transliteration: "namaste", meaning_en: "Hello", category: "greetings", difficulty: "basic", item_type: "word" };
test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => { sessionStorage.setItem("swar-intro-v2", "seen"); localStorage.setItem("swarsaarthi_token", "qa-token"); });
  await page.route("**/backend/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ json: { id: "qa", full_name: "Aarav", email: "qa@example.test", created_at: "2026-01-01" } });
    if (path.endsWith("/tts")) return route.fulfill({ contentType: "audio/wav", body: audio() });
    if (path.endsWith("/words/random")) return route.fulfill({ json: [word, { ...word, id: "second", text_hi: "खुशी" }] });
    if (path.endsWith("/voice/turn")) {
      expect(route.request().headers().authorization).toBe("Bearer qa-token");
      expect(route.request().postDataBuffer()?.toString()).toContain('name="history"');
      return route.fulfill({ json: { transcript: "मेरा दिन अच्छा था", reply: "अच्छा लगा सुनकर। आज आपने क्या किया?", provider: "Gemini" } });
    }
    if (path.endsWith("/voice/chat")) {
      const payload = route.request().postDataJSON();
      expect(payload.history.some((message: { content: string }) => message.content.includes("मेरा दिन"))).toBe(true);
      return route.fulfill({ json: { transcript: payload.text, reply: "किताब पढ़ना अच्छी बात है। कौन सी कहानी थी?", provider: "Gemini" } });
    }
    if (path.endsWith("/asr/predict")) {
      expect(route.request().postDataBuffer()?.toString()).toContain("voice-word");
      expect(route.request().postDataBuffer()?.toString()).toMatch(/name="feedback_language"\r\n\r\nhi/);
      return route.fulfill({ json: { session_id: "voice-practice", prediction_text: "नमस्ते", target_text: "नमस्ते", accuracy_score: 92, cer: .08, is_correct: true, feedback: "बहुत अच्छा बोला।", gemini_suggestion: "जीभ को सहज रखें।", feedback_language: "hi" } });
    }
    return route.fulfill({ json: {} });
  });
});

test("voice conversation records, replies aloud, remembers context and keeps all controls", async ({ page }) => {
  await page.goto("/voice");
  await expect(page.locator(".voice-sculpture canvas")).toBeVisible();
  await page.getByRole("button", { name: "Start a conversation" }).click();
  await expect(page.locator(".voice-status")).toContainText("Your turn");
  await page.getByRole("button", { name: "Speak to the coach" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Send voice message" }).click();
  await expect(page.locator(".from-user")).toContainText("मेरा दिन अच्छा था");
  await expect(page.locator(".from-assistant").last()).toContainText("आज आपने क्या किया");
  await expect(page.locator(".voice-status")).toContainText("Your turn");
  await page.getByLabel("Type a message instead").fill("मैंने किताब पढ़ी");
  await page.getByRole("button", { name: "Send typed message" }).click();
  await expect(page.locator(".from-assistant").last()).toContainText("कौन सी कहानी");
  await expect(page.locator(".voice-status")).toContainText("Your turn");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/voice-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("button", { name: "Start a conversation" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/voice-mobile.png", fullPage: true });
});

test("guided voice practice scores attempts and hands-free starts the next turn", async ({ page }) => {
  await page.goto("/voice");
  await page.getByRole("button", { name: /Guided practice/ }).click();
  await page.getByRole("button", { name: "Start voice practice" }).click();
  await expect(page.locator(".voice-status")).toContainText("Your turn");
  await page.getByLabel("Hands-free turns").check();
  await expect(page.getByRole("button", { name: "Send voice message" })).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Send voice message" }).click();
  await expect(page.locator(".voice-session-score")).toContainText("92%");
  await expect(page.locator(".voice-stage-copy h2")).toHaveText("खुशी");
  await expect(page.getByRole("button", { name: "Send voice message" })).toBeVisible();
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByLabel("Hands-free turns")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Send voice message" })).toHaveCount(0);
});

test("ending while waiting discards late replies", async ({ page }) => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/backend/api/voice/chat", async route => { await gate; await route.fulfill({ json: { transcript: "नमस्ते", reply: "देर से आया उत्तर", provider: "Gemini" } }).catch(() => {}); });
  await page.goto("/voice");
  await page.getByLabel("Type a message instead").fill("नमस्ते");
  await page.getByRole("button", { name: "Send typed message" }).click();
  await expect(page.locator(".voice-status")).toContainText("thinking");
  await page.getByRole("button", { name: "End session" }).click();
  finish();
  await expect(page.getByRole("button", { name: "Start a conversation" })).toBeVisible();
  await expect(page.locator(".voice-messages")).not.toContainText("देर से आया उत्तर");
});

test("voice service failure is visible and preserves typed input", async ({ page }) => {
  await page.route("**/backend/api/voice/chat", route => route.fulfill({ status: 503, json: { detail: "The conversation service is unavailable. Please try again." } }));
  await page.goto("/voice");
  await page.getByLabel("Type a message instead").fill("नमस्ते");
  await page.getByRole("button", { name: "Send typed message" }).click();
  await expect(page.locator(".voice-error")).toContainText("unavailable");
  await expect(page.getByLabel("Type a message instead")).toHaveValue("नमस्ते");
  await expect(page.locator(".from-assistant")).toHaveCount(0);
});
