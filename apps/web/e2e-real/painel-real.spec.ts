/**
 * E2E com Postgres REAL (não o modo demonstração). Requer o painel rodando com DATABASE_URL
 * apontando para um banco recém-semeado: E2E_BASE_URL=http://localhost:3300 pnpm test:e2e:real
 */
import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

function base32ParaBytes(b32: string): Buffer {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const c of b32.replace(/=+$/, '')) {
    valor = (valor << 5) | A.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(b32: string): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac('sha1', base32ParaBytes(b32)).update(buf).digest();
  const o = h[19]! & 15;
  const bin = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 1_000_000).padStart(6, '0');
}

/** Login + cadastro do 2FA (obrigatório para dono, síndico e portaria). */
async function entrar(page: Page, email: string, destino: RegExp) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('Demo@2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/login\/2fa/);
  const chave = (await page.locator('code').textContent())!.trim();
  await page.getByLabel('Código de 6 dígitos').fill('000000' === totp(chave) ? '111111' : '000000');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByText('Código inválido')).toBeVisible();
  await page.getByLabel('Código de 6 dígitos').fill(totp(chave));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await page.waitForURL(destino);
}

test.describe.configure({ mode: 'serial' });

test('sem 2FA o painel não abre (síndico sem AAL2 volta para a verificação)', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('marcos.teixeira@example.com');
  await page.getByLabel('Senha').fill('Demo@2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/login\/2fa/);
  await page.goto('/sindico');
  await expect(page).toHaveURL(/\/login\/2fa/);
});

test('dono: 2FA, métricas agregadas com "< 3", sem nomes', async ({ page }) => {
  await entrar(page, 'dono@example.com', /\/dono$/);
  const ipes = page.getByRole('row', { name: /Vila dos Ipês/ });
  await expect(ipes.getByRole('cell', { name: '< 3' }).first()).toBeVisible();
  const html = await page.content();
  for (const nome of ['Ricardo', 'Marina', 'Bruno Melo', 'Helena Prado', '304-A']) expect(html).not.toContain(nome);
});

test('síndica: 2FA e aprovação da locação gravada no banco', async ({ page }) => {
  await entrar(page, 'helena.prado@example.com', /\/sindico$/);
  const item = page.getByText('Locatário(a) temporada · Marina Souza');
  await expect(item).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar Locatário(a) temporada · Marina Souza' }).click();
  await expect(item).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Locatário(a) temporada · Marina Souza')).toHaveCount(0);
});

test('portaria: 2FA, CPF mascarado e hóspede aprovado aparece', async ({ page }) => {
  await entrar(page, 'portaria.acacias@example.com', /\/portaria$/);
  const cpfs = await page.getByTestId('cpf-mascarado').allTextContents();
  expect(cpfs.length).toBeGreaterThan(3);
  for (const c of cpfs) expect(c).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
  // Marina foi aprovada no teste anterior → agora a portaria a vê (só nome, CPF mascarado e unidade)
  await expect(page.getByRole('cell', { name: 'Marina Souza' })).toBeVisible();
  await page.getByLabel('Unidade da encomenda').fill('207-a');
  await page.getByLabel('Descrição da encomenda').fill('Caixa grande · Transportadora');
  await page.getByRole('button', { name: 'Avisar encomenda' }).click();
});

test('link facial com banco real: consentimento → foto cifrada → uso único', async ({ page, context }) => {
  await context.grantPermissions(['camera']);
  const token = 'demo-pedro-1102b-0123456789abcdef0123456789abcdef';
  await page.goto(`/f/${token}`);
  await expect(page.getByRole('heading', { name: 'Olá, Pedro' })).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Tirar foto' }).click();
  await page.getByRole('button', { name: 'Capturar foto' }).click();
  await expect(page.getByRole('heading', { name: 'Pronto, Pedro!' })).toBeVisible();
  await page.goto(`/f/${token}`);
  await expect(page.getByRole('heading', { name: 'Link indisponível' })).toBeVisible();
});
