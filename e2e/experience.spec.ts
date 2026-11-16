import { test, expect } from "@playwright/test";

const user = { id: "qa-user", full_name: "Aarav Sharma", email: "aarav@example.test", created_at: "2026-01-01T00:00:00" };
const word = { id: "qa-word", text_hi: "नमस्ते", transliteration: "namaste", meaning_en: "Hello", category: "greetings", difficulty: "basic", item_type: "word" };

test("homepage, sample selector, FAQ and route navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little closer to your voice." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("swar-intro-v2"))).toBe("seen");
  await expect(page.locator(".intro-screen")).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator(".hero-copy > div")).toHaveCSS("opacity", "1");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: "test-results/home-desktop.png" });
  for (const section of await page.locator(".home-page > section").all()) { await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(120); }
  await expect(page.locator(".closing-section > div")).toHaveCSS("opacity", "1");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: "test-results/home-full.png", fullPage: true });
  await page.getByRole("button", { name: "Preview खुशी" }).click();
  await expect(page.getByRole("heading", { name: "खुशी" })).toBeVisible();
  await page.getByText("What is SwarSaarthi?", { exact: true }).click();
  await expect(page.locator("details[open]")).toContainText("companion for practising Hindi speech");
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hello, again." })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("mobile layouts, navigation and reduced motion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little closer to your voice." })).toBeVisible();
  await expect(page.locator(".hero-copy > div")).toHaveCSS("opacity", "1");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".intro-screen")).toHaveCount(0);
  await expect(page.locator("body")).toBeVisible();
  await page.screenshot({ path: "test-results/home-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator("#mobile-menu").getByRole("link", { name: "Log in" }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.screenshot({ path: "test-results/login-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("sign in uses token, fetches user and renders real response data", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("swar-intro-v2", "seen"));
  const levels = Object.fromEntries(["basic", "intermediate", "advanced"].map(level => [level, { total_words: 30, attempted_words: 4, mastered_words: 2, avg_accuracy: 81, completion_percentage: 13 }]));
  await page.route("**/backend/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      "/backend/api/auth/login": { access_token: "qa-token", token_type: "bearer" },
      "/backend/api/auth/me": user,
      "/backend/api/profile": { user, streak: { current_streak: 3, longest_streak: 5, total_practice_days: 9 }, stats: { unique_words_practiced: 12, total_attempts: 25, overall_accuracy: 81, focus_words_count: 1, total_words_available: 90 } },
      "/backend/api/profile/focus-words": { focus_words: [{ ...word, word_id: word.id, total_attempts: 3, correct_attempts: 1, avg_accuracy: 60, best_score: 80, last_practiced_at: null }], count: 1 },
      "/backend/api/profile/streak-calendar": { calendar: [] },
      "/backend/api/profile/progress": { breakdown: levels },
    };
    await route.fulfill({ json: responses[path] || [] });
  });
  await page.goto("/login?next=/profile");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Continue to your practice" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "A little further, Aarav." })).toBeVisible();
  await expect(page.locator(".profile-stat").nth(2)).toContainText("81%");
  await expect(page.locator(".profile-focus-word")).toHaveAttribute("href", "/practice?wordId=qa-word");
  await expect(page.locator("main")).toHaveCount(1);
  await page.screenshot({ path: "test-results/profile-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/profile-mobile.png", fullPage: true });
});

test("practice filters, sign-in gate, API failure and recovery", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("swar-intro-v2", "seen"));
  let fail = false;
  const queries: string[] = [];
  await page.route("**/backend/api/words/**", async route => {
    queries.push(route.request().url());
    if (fail) await route.fulfill({ status: 503, json: { detail: "Practice service is offline." } });
    else await route.fulfill({ json: [{ ...word, text_hi: new URL(route.request().url()).searchParams.get("item_type") === "sentence" ? "आप कैसे हैं?" : word.text_hi }] });
  });
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "नमस्ते" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to practice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start recording", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/practice-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Sentences", exact: true }).click();
  await expect(page.getByRole("heading", { name: "आप कैसे हैं?" })).toBeVisible();
  expect(queries.some(url => url.includes("item_type=sentence"))).toBe(true);
  fail = true;
  await page.getByLabel("Your level").selectOption("advanced");
  await expect(page.locator("main").getByRole("alert")).toContainText("Practice service is offline");
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "आप कैसे हैं?" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/practice-mobile.png", fullPage: true });
});

test("signup surfaces backend validation without navigating", async ({ page }) => {
  await page.route("**/backend/api/auth/signup", route => route.fulfill({ status: 400, json: { detail: "Email already registered." } }));
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Aarav");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Create your account", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Email already registered");
  await expect(page).toHaveURL(/\/signup$/);
});

test("microphone capture submits multipart audio and displays feedback", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => localStorage.setItem("swarsaarthi_token", "qa-token"));
  let submitted = false;
  await page.route("**/backend/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ json: user });
    if (path.endsWith("/words/random")) return route.fulfill({ json: [word] });
    if (path.endsWith("/asr/predict")) {
      expect(route.request().headers()["authorization"]).toBe("Bearer qa-token");
      expect(route.request().headers()["content-type"]).toContain("multipart/form-data");
      expect(route.request().postDataBuffer()?.toString()).toContain('name="word_id"');
      submitted = true;
      return route.fulfill({ json: { session_id: "qa-session", word_id: word.id, target_text: word.text_hi, prediction_text: word.text_hi, accuracy_score: 94, cer: .06, is_correct: true, feedback: "Clear pronunciation. Keep practising!", feedback_language: "en", needs_focus: false, streak: 1 } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/practice");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop recording and analyze" })).toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Stop recording and analyze" }).click();
  await expect(page.getByRole("heading", { name: "Beautifully spoken." })).toBeVisible();
  await expect(page.locator(".practice-score")).toContainText("94");
  expect(submitted).toBe(true);
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByRole("heading", { name: "That’s how progress begins." })).toBeVisible();
  await expect(page.locator(".practice-complete-stats")).toContainText("94%");
});
