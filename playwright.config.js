const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5100"
  },
  webServer: {
    command: "python -m flask --app app run --no-debugger --no-reload --host 127.0.0.1 --port 5100",
    url: "http://127.0.0.1:5100",
    reuseExistingServer: true,
    timeout: 120000,
    cwd: __dirname
  }
});
