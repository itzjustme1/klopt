import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173/",
    timezoneId: "Europe/Amsterdam",
    locale: "nl-NL",
    serviceWorkers: "allow",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173/",
    reuseExistingServer: false,
  },
});
