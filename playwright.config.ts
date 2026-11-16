import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3001",
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
    screenshot: "only-on-failure",
  },
  webServer: { command: "npm run dev", url: "http://localhost:3001", reuseExistingServer: true, timeout: 60000 },
});
