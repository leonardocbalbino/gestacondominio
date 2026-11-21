import { defineConfig, devices } from '@playwright/test';

/** E2E contra Postgres real: suba o painel com DATABASE_URL de um banco recém-semeado e defina E2E_BASE_URL. */
export default defineConfig({
  testDir: './e2e-real',
  timeout: 45_000,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3300',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
});
