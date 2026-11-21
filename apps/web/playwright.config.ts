import { defineConfig, devices } from '@playwright/test';

const PORTA = Number(process.env.PORTA_E2E ?? 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORTA}`, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /link-facial/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /link-facial/ },
  ],
  webServer: {
    // Sem variáveis do Supabase → modo demonstração com dados fictícios.
    command: `pnpm exec next start -p ${PORTA}`,
    port: PORTA,
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' },
  },
});
