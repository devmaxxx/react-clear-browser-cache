import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const demoPort = 4174;
const demoBase = '/react-clear-browser-cache/';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure'
  },
  projects: [
    ...(['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari'] as const).map(
      (device) => ({
        name: devices[device].defaultBrowserType,
        testIgnore: /demo\.spec/,
        use: { ...devices[device] }
      })
    ),
    {
      name: 'demo',
      testMatch: /demo\.spec/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${demoPort}${demoBase}`
      }
    }
  ],
  webServer: [
    {
      // Both servers need the library built first, which `test:e2e` does; two
      // tsdown runs here would race on dist. The built index.html is checked
      // too: the build rewrites it.
      command: `pnpm example:build && html-validate example/dist/index.html && pnpm --filter react-clear-browser-cache-example preview --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      // Served under the same sub-path as GitHub Pages, so broken asset URLs
      // fail here first. `demo:build` skips the meta.json prebuild step (the
      // demo's fetch shim answers it), so it cannot race the build above.
      command: `pnpm demo:build && pnpm demo:preview --port ${demoPort} --strictPort`,
      url: `http://localhost:${demoPort}${demoBase}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
