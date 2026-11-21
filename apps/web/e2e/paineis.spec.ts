import { expect, test, type Page } from '@playwright/test';

async function entrarComo(page: Page, perfil: 'dono' | 'sindico' | 'portaria') {
  await page.goto('/login');
  await page.locator(`input[name="perfil"][value="${perfil}"]`).check();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(perfil === 'dono' ? /\/dono$/ : perfil === 'sindico' ? /\/sindico$/ : /\/portaria$/);
}

test('raiz redireciona para o login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('dono vê só agregados, com supressão "< 3"', async ({ page }) => {
  await entrarComo(page, 'dono');
  await expect(page).toHaveURL(/\/dono$/);
  await expect(page.getByRole('heading', { name: 'Visão da plataforma' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Res\. Jardim das Acácias/ })).toBeVisible();
  // Vila dos Ipês tem 0 hóspedes no mês → "< 3"
  const linhaIpes = page.getByRole('row', { name: /Vila dos Ipês/ });
  await expect(linhaIpes.getByRole('cell', { name: '< 3' })).toBeVisible();
  // Nenhum nome de morador aparece
  const html = await page.content();
  for (const nome of ['Ricardo', 'Marina', 'Bruno Melo', 'Pedro Lima']) expect(html).not.toContain(nome);
});

test('dono cria condomínio e recebe link de convite', async ({ page }) => {
  await entrarComo(page, 'dono');
  await page.getByLabel('Nome', { exact: true }).fill('Res. Parque das Araucárias');
  await page.getByLabel('Cidade').fill('Londrina');
  await page.getByLabel('UF').fill('PR');
  await page.getByLabel('Nome do síndico').fill('Sílvia Costa');
  await page.getByLabel('E-mail do síndico').fill('silvia@example.com');
  await page.getByRole('button', { name: 'Criar e convidar síndico' }).click();
  await expect(page.getByRole('status')).toContainText('/convite/');
  await expect(page.getByRole('row', { name: /Parque das Araucárias/ })).toContainText('Implantação');
});

test('síndica aprova locação e libera acesso de suporte', async ({ page }) => {
  await entrarComo(page, 'sindico');
  await expect(page).toHaveURL(/\/sindico$/);
  await expect(page.getByText('Locatária · Marina Souza')).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar Locatária · Marina Souza' }).click();
  await expect(page.getByText('Locatária · Marina Souza')).toHaveCount(0);

  await page.getByRole('button', { name: 'Liberar 1h' }).click();
  await expect(page.getByText(/ativo até/)).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar agora' }).click();
  await expect(page.getByText('Encerrado')).toBeVisible();
});

test('portaria vê CPF mascarado e registra acesso', async ({ page }) => {
  await entrarComo(page, 'portaria');
  await expect(page).toHaveURL(/\/portaria$/);
  const cpfs = await page.getByTestId('cpf-mascarado').allTextContents();
  expect(cpfs.length).toBeGreaterThan(0);
  for (const c of cpfs) expect(c).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
  await expect(page.getByText('BRA-2E19')).toBeVisible();

  await page.getByLabel('Tipo').selectOption('visitante');
  await page.getByLabel('Unidade').fill('502-b');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText(/Visitante · 502-B/)).toBeVisible();
});

test('portaria não acessa o painel do síndico', async ({ page }) => {
  await entrarComo(page, 'portaria');
  await page.goto('/sindico');
  await expect(page).toHaveURL(/\/portaria$/);
});
