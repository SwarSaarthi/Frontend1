import { test, expect, type Page } from "@playwright/test";

const user = { id: "learner", full_name: "Aarav Sharma", email: "qa@example.test", created_at: "2026-01-01" };
const difficult = { word_id: "hard-word", id: "hard-word", text_hi: "धन्यवाद", transliteration: "dhanyavaad", meaning_en: "Thank you", difficulty: "intermediate", category: "greetings", item_type: "word", total_attempts: 1, correct_attempts: 0, avg_accuracy: 40, best_score: 40, last_practiced_at: null };
const other = { ...difficult, word_id: "other-word", id: "other-word", text_hi: "खुशी", transliteration: "khushi", meaning_en: "Happiness", avg_accuracy: 65, best_score: 65 };

async function setup(page: Page, options: { empty?: boolean; sentence?: boolean; fail?: boolean } = {}) {
  await page.addInitScript(() => { sessionStorage.setItem("swar-intro-v2", "seen"); localStorage.setItem("swarsaarthi_token", "qa-token"); localStorage.setItem("swarsaarthi_auto_feedback", "false"); });
  let attempts = options.empty ? 0 : 2;
  let focus = options.empty ? [] : options.sentence ? [{ ...difficult, item_type: "sentence", text_hi: "मेरा नाम रवि है।" }] : [other, difficult];
  let failed = !!options.fail;
  await page.route("**/backend/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ json: user });
    if (path.endsWith("/profile")) {
      if (failed) return route.fulfill({ status: 503, json: { detail: "Progress is temporarily unavailable." } });
      return route.fulfill({ json: { user, stats: { total_attempts: attempts, unique_words_practiced: focus.length, overall_accuracy: attempts ? 52.5 : 0, focus_words_count: focus.length, total_words_available: 100 }, streak: { current_streak: attempts ? 2 : 0, longest_streak: 3, total_practice_days: 4 } } });
    }
    if (path.endsWith("/focus-words")) return route.fulfill({ json: { focus_words: focus, count: focus.length } });
    if (path.endsWith("/progress")) return route.fulfill({ json: { breakdown: Object.fromEntries(["basic", "intermediate", "advanced"].map(level => [level, { attempted_words: options.empty ? 0 : level === "advanced" ? 0 : 2, total_words: 30, avg_accuracy: level === "basic" ? 80 : 52.5, mastered_words: 0, completion_percentage: 5 }])) } });
    if (path.endsWith("/words/random")) return route.fulfill({ json: [options.sentence ? focus[0] : difficult] });
    if (path.endsWith("/words/count")) return route.fulfill({ json: { total: 100 } });
    if (path.endsWith("/words/hard-word")) return route.fulfill({ json: options.sentence ? focus[0] : difficult });
    if (path.endsWith("/asr/predict")) {
      attempts++;
      focus = [other, { ...difficult, total_attempts: 2, correct_attempts: 1, avg_accuracy: 67.5, best_score: 95 }];
      return route.fulfill({ json: { session_id: "home-plan-attempt", word_id: difficult.word_id, target_text: difficult.text_hi, prediction_text: difficult.text_hi, accuracy_score: 95, cer: .05, is_correct: true, feedback: "बहुत अच्छा।", feedback_language: "hi" } });
    }
    return route.fulfill({ json: {} });
  });
  return { recover: () => { failed = false; } };
}

test("homepage prioritizes difficult words and tasks, then refreshes after practice", async ({ page, context }) => {
  await setup(page); await context.grantPermissions(["microphone"]);
  await page.goto("/");
  const plan = page.locator(".home-plan");
  await expect(plan.getByRole("heading", { name: /A little progress, Aarav/ })).toBeVisible();
  await expect(plan.locator(".home-focus li").first()).toContainText("धन्यवाद");
  await expect(plan.locator(".home-focus li").first()).toContainText("40%");
  await expect(plan.locator(".home-next")).toContainText("Focus on intermediate practice");
  await page.screenshot({ path: "test-results/personal-home.png" });
  await plan.getByRole("link", { name: "Practise धन्यवाद", exact: true }).click();
  await expect(page).toHaveURL(/wordId=hard-word/);
  await expect(page.locator(".practice-word h2")).toHaveText("धन्यवाद");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Stop recording and analyze" }).click();
  await expect(page.locator(".practice-inline-score")).toHaveText("95%");
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Discover" }).click();
  await expect(plan.locator(".home-focus li").first()).toContainText("खुशी");
  await expect(plan.locator(".home-focus li").nth(1)).toContainText("Best 95%");
  await expect(plan.locator(".home-plan-stats")).toContainText("3saved attempts");
  await expect(page.locator(".site-frame")).toHaveAttribute("data-route-phase", "idle");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/personal-home-mobile.png" });
});

test("focus sentences open sentence mode with the selected item", async ({ page }) => {
  await setup(page, { sentence: true }); await page.goto("/");
  await page.getByRole("link", { name: "Practise मेरा नाम रवि है।", exact: true }).click();
  await expect(page).toHaveURL(/itemType=sentence/);
  await expect(page.getByRole("button", { name: /Sentences/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".practice-word h2")).toHaveText("मेरा नाम रवि है।");
});

test("new learners see first steps without invented weak words", async ({ page }) => {
  await setup(page, { empty: true }); await page.goto("/");
  await expect(page.locator(".home-focus-empty")).toContainText("After your first scored attempts");
  await expect(page.locator(".home-next")).toContainText("Record your first word");
  await expect(page.locator(".home-focus li")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator(".home-plan")).toHaveCount(0);
});

test("progress errors can be retried without presenting false zero scores", async ({ page }) => {
  const api = await setup(page, { fail: true }); await page.goto("/");
  await expect(page.locator(".home-plan-error")).toContainText("unavailable");
  await expect(page.locator(".home-plan-stats")).toHaveCount(0);
  api.recover();
  await page.locator(".home-plan-error").getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".home-focus li")).toHaveCount(2);
});

test("guests retain the homepage without private progress requests", async ({ page }) => {
  const profileRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/profile")) profileRequests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little closer to your voice." })).toBeVisible();
  await expect(page.locator(".home-plan")).toHaveCount(0);
  expect(profileRequests).toHaveLength(0);
});
