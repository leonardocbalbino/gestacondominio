import { expect, test } from '@playwright/test';

const TOKEN = 'demo-pedro-1102b-0123456789abcdef0123456789abcdef';

test.use({ permissions: ['camera'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

test('link facial: "Tirar foto" só libera com consentimento', async ({ page }) => {
  await page.goto(`/f/${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Olá, Pedro' })).toBeVisible();
  await expect(page.getByText('Unidade 1102-B · leva menos de 1 minuto')).toBeVisible();
  await expect(page.getByText(/Link pessoal · válido até \d{2}\/\d{2} às \d{2}:\d{2}/)).toBeVisible();

  const botao = page.getByRole('button', { name: 'Tirar foto' });
  await expect(botao).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(botao).toBeEnabled();

  await botao.click(); // registra consentimento e abre a câmera (falsa)
  await page.getByRole('button', { name: 'Capturar foto' }).click();
  await expect(page.getByRole('heading', { name: 'Pronto, Pedro!' })).toBeVisible();

  // Link de uso único
  await page.goto(`/f/${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Link indisponível' })).toBeVisible();
});

test('token inexistente mostra link indisponível', async ({ page }) => {
  await page.goto('/f/token-que-nao-existe');
  await expect(page.getByRole('heading', { name: 'Link indisponível' })).toBeVisible();
});
