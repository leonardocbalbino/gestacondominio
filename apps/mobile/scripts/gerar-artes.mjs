#!/usr/bin/env node
/**
 * Gera as artes do app e das lojas a partir de SVG/HTML, renderizados no Chromium do Playwright.
 *
 *   node apps/mobile/scripts/gerar-artes.mjs                 # ícones, splash, feature graphic
 *   node apps/mobile/scripts/gerar-artes.mjs <dir-web-demo>  # + capturas de tela das lojas
 *
 * <dir-web-demo> é a saída de `expo export --platform web` SEM EXPO_PUBLIC_API_URL (modo demonstração).
 * Saídas: apps/mobile/assets/ (usadas no app.json) e apps/mobile/store/ (enviadas às lojas).
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = resolve(MOBILE, '../..');
const ASSETS = join(MOBILE, 'assets');
const STORE = join(MOBILE, 'store');
const { chromium } = createRequire(join(RAIZ, 'apps/web/package.json'))('@playwright/test');
const reqMobile = createRequire(join(MOBILE, 'package.json'));

const C = { primary: '#0F766E', dark: '#0F3B37', deeper: '#0A2926', mint: '#5EEAD4', bg: '#F4F5F2', soft: '#E6F2F0' };

function fonte(pacote, arquivo) {
  const p = reqMobile.resolve(`${pacote}/${arquivo}`);
  return `data:font/ttf;base64,${readFileSync(p).toString('base64')}`;
}
const FONTES = `
@font-face{font-family:SG;font-weight:700;src:url(${fonte('@expo-google-fonts/space-grotesk', '700Bold/SpaceGrotesk_700Bold.ttf')})}
@font-face{font-family:Inter;font-weight:500;src:url(${fonte('@expo-google-fonts/inter', '500Medium/Inter_500Medium.ttf')})}
@font-face{font-family:Inter;font-weight:600;src:url(${fonte('@expo-google-fonts/inter', '600SemiBold/Inter_600SemiBold.ttf')})}`;

/**
 * Marca: dois prédios (janelas vazadas) e um selo de "ok". Desenhada numa caixa 1024,
 * centrada; `escala` encolhe em torno do centro (ícone adaptativo precisa da zona segura de 66%).
 */
function marca({ cor = '#fff', selo = C.mint, escala = 1, fundo = null } = {}) {
  const janelas = [];
  for (const x of [342, 420]) for (const y of [346, 426, 506, 586]) janelas.push(`<rect x="${x}" y="${y}" width="50" height="50" rx="8"/>`);
  for (const x of [568, 640]) for (const y of [476, 552]) janelas.push(`<rect x="${x}" y="${y}" width="48" height="48" rx="8"/>`);
  janelas.push('<rect x="600" y="636" width="56" height="140" rx="8"/>'); // porta
  const seloCor = selo ?? cor;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.primary}"/><stop offset="1" stop-color="${C.dark}"/></linearGradient>
    <mask id="m"><rect width="1024" height="1024" fill="#fff"/><g fill="#000">${janelas.join('')}</g>
      <circle cx="706" cy="352" r="78" fill="#000"/></mask>
    <mask id="v"><rect width="1024" height="1024" fill="#fff"/>
      <path d="M676 352 l22 22 l40 -44" fill="none" stroke="#000" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></mask>
  </defs>
  ${fundo === 'gradiente' ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ''}
  <g transform="translate(512 512) scale(${escala}) translate(-523 -516)">
    <g mask="url(#m)" fill="${cor}">
      <rect x="300" y="292" width="212" height="448" rx="22"/>
      <rect x="532" y="432" width="192" height="308" rx="22"/>
    </g>
    <circle cx="706" cy="352" r="62" fill="${seloCor}" mask="url(#v)"/>
  </g>
</svg>`;
}

const pagina = (corpo, css = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${FONTES}
  *{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}${css}</style></head><body>${corpo}</body></html>`;

async function render(navegador, arquivo, w, h, html, { transparente = false } = {}) {
  const page = await navegador.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: arquivo, omitBackground: transparente });
  await page.close();
  console.log('  ✓', arquivo.replace(RAIZ + '\\', '').replace(RAIZ + '/', ''), `${w}x${h}`);
}

async function artesBase(nav) {
  mkdirSync(ASSETS, { recursive: true });
  mkdirSync(STORE, { recursive: true });
  const svg = (s) => pagina(s);

  // iOS e ícone geral: opaco, sem cantos arredondados (a loja/sistema aplica a máscara).
  await render(nav, join(ASSETS, 'icon.png'), 1024, 1024, svg(marca({ fundo: 'gradiente' })));
  // Android adaptativo: primeiro plano transparente dentro da zona segura; fundo vem do app.json.
  await render(nav, join(ASSETS, 'adaptive-icon.png'), 1024, 1024, svg(marca({ escala: 0.72 })), { transparente: true });
  // Android 13+ "ícones temáticos": silhueta de uma cor só.
  await render(nav, join(ASSETS, 'adaptive-icon-monochrome.png'), 1024, 1024, svg(marca({ escala: 0.72, selo: '#fff' })), { transparente: true });
  // Splash: marca branca sobre o fundo escuro definido no plugin expo-splash-screen.
  await render(nav, join(ASSETS, 'splash-icon.png'), 1024, 1024, svg(marca()), { transparente: true });
  // Notificação Android: branco puro sobre transparente.
  await render(nav, join(ASSETS, 'notification-icon.png'), 96, 96, svg(marca({ selo: '#fff', escala: 1.15 })), { transparente: true });
  await render(nav, join(ASSETS, 'favicon.png'), 48, 48, svg(marca({ fundo: 'gradiente', escala: 1.1 })));

  // Google Play: ícone 512 (32 bits) e gráfico de recursos 1024x500.
  await render(nav, join(STORE, 'play-icone-512.png'), 512, 512, svg(marca({ fundo: 'gradiente' })));
  await render(
    nav,
    join(STORE, 'play-feature-graphic.png'),
    1024,
    500,
    pagina(
      `<div class="f"><div class="m">${marca()}</div><div class="t"><h1>GestaCondomínio</h1>
       <p>Transparência, reservas, encomendas e portaria do seu condomínio no celular.</p></div></div>`,
      `.f{width:1024px;height:500px;display:flex;align-items:center;gap:36px;padding:0 84px;
        background:radial-gradient(circle at 85% 15%,rgba(94,234,212,.22),transparent 45%),linear-gradient(135deg,${C.primary},${C.dark} 70%)}
       .m{width:230px;height:230px;flex:none}
       h1{font:700 64px/1.05 SG;color:#fff;letter-spacing:-1.5px}
       p{margin-top:18px;font:500 26px/1.35 Inter;color:${C.soft};max-width:560px}`,
    ),
  );
}

// ---------- capturas de tela ----------

const TELAS = [
  { rota: '/', titulo: 'Tudo do seu condomínio em um só lugar' },
  { rota: '/transparencia', titulo: 'Veja para onde vai cada real da taxa' },
  { rota: '/reservar', titulo: 'Reserve áreas comuns em poucos toques' },
  { rota: '/encomendas', titulo: 'Saiba quando sua encomenda chegar' },
  { rota: '/ceder-vaga', titulo: 'Ceda sua vaga de garagem com segurança' },
  { rota: '/assembleias', titulo: 'Vote nas assembleias pelo celular' },
];

// iOS 6,9" (1290x2796 é aceito) e Android (proporção máx. 2:1 → 1080x1920).
const FORMATOS = [
  { nome: 'ios-6.9', w: 1290, h: 2796, topo: 470, largura: 1040, fonte: 84 },
  { nome: 'android', w: 1080, h: 1920, topo: 340, largura: 780, fonte: 64 },
];

function servir(dir) {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
  return new Promise((ok) => {
    const s = createServer((req, res) => {
      let p = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!existsSync(p) || statSync(p).isDirectory()) p = existsSync(p + '.html') ? p + '.html' : join(dir, 'index.html');
      res.writeHead(200, { 'content-type': tipos[extname(p)] ?? 'application/octet-stream' });
      createReadStream(p).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}

async function capturas(nav, dirWeb) {
  const srv = await servir(dirWeb);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const dirBruto = join(STORE, 'capturas', 'bruto');
  mkdirSync(dirBruto, { recursive: true });
  const ctx = await nav.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const brutos = [];
  for (const [i, t] of TELAS.entries()) {
    const page = await ctx.newPage();
    await page.goto(base + t.rota, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800); // dados demo têm atraso simulado
    const arq = join(dirBruto, `${String(i + 1).padStart(2, '0')}${t.rota.replace(/\//g, '-') || '-inicio'}.png`);
    await page.screenshot({ path: arq });
    brutos.push({ ...t, arq });
    await page.close();
    console.log('  ✓ captura', t.rota);
  }
  await ctx.close();
  srv.close();

  for (const f of FORMATOS) {
    const dir = join(STORE, 'capturas', f.nome);
    mkdirSync(dir, { recursive: true });
    for (const [i, b] of brutos.entries()) {
      const img = `data:image/png;base64,${readFileSync(b.arq).toString('base64')}`;
      await render(
        nav,
        join(dir, `${String(i + 1).padStart(2, '0')}.png`),
        f.w,
        f.h,
        pagina(
          `<div class="c"><h1>${b.titulo}</h1><img src="${img}"></div>`,
          `.c{position:relative;width:${f.w}px;height:${f.h}px;overflow:hidden;
             background:radial-gradient(circle at 90% 5%,rgba(94,234,212,.25),transparent 40%),linear-gradient(160deg,${C.primary},${C.dark} 75%)}
           h1{position:absolute;left:${Math.round(f.w * 0.08)}px;right:${Math.round(f.w * 0.08)}px;top:${Math.round(f.topo * 0.2)}px;
             font:700 ${f.fonte}px/1.1 SG;color:#fff;letter-spacing:-1px;text-align:center}
           img{position:absolute;left:${(f.w - f.largura) / 2}px;top:${f.topo}px;width:${f.largura}px;
             border-radius:${Math.round(f.largura * 0.07)}px;border:${Math.round(f.largura * 0.018)}px solid ${C.deeper};
             box-shadow:0 30px 80px rgba(0,0,0,.35)}`,
        ),
      );
    }
  }
}

const nav = await chromium.launch();
try {
  console.log('Artes base');
  await artesBase(nav);
  const dirWeb = process.argv[2];
  if (dirWeb) {
    console.log('Capturas de tela (modo demonstração)');
    await capturas(nav, resolve(dirWeb));
  }
} finally {
  await nav.close();
}
