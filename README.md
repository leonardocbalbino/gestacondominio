# GestaCondomínio

Plataforma SaaS multi-condomínio: painel web (dono do sistema, síndico, portaria), app do morador (Expo) e link público de cadastro facial — com privacidade por padrão (LGPD).

## Estrutura

| Caminho | O quê |
|---|---|
| `apps/web` | Next.js 15 (App Router) + Tailwind 4 + componentes no padrão shadcn/ui. Painéis `/dono`, `/sindico`, `/portaria`, link facial `/f/[token]`, `/privacidade`. |
| `apps/mobile` | Expo SDK 58 + Expo Router + NativeWind 4. Telas do morador: Início, Ceder vaga, Cadastrar locatário, Orçamento público, Transparência, Serviços, Perfil (direitos LGPD). |
| `packages/ui` | Design tokens (cores, raios, fontes) — fonte única para web e mobile. |
| `packages/core` | Regras de negócio, formatação pt-BR (R$, dd/mm, America/Sao_Paulo), schemas Zod, adaptadores de controle de acesso (Control iD, Hikvision, Intelbras, mock). |
| `packages/db` | Supabase: migrações SQL (schema, RLS, RPCs, jobs, storage), seed com 2 condomínios fictícios, testes de RLS, Edge Functions. |
| `docs/design` | As 5 telas de referência (HTML). |

## Rodando

```bash
pnpm install

# Painel web em modo demonstração (sem Supabase, dados fictícios em memória)
pnpm --filter @gc/web dev            # http://localhost:3000

# App do morador (modo demonstração)
pnpm --filter @gc/mobile dev         # Expo Go, ou "w" para web
```

Com Supabase local (Docker): `pnpm db:start` sobe a stack em `http://127.0.0.1:55321` (portas 553xx — a faixa 54301–54400 é reservada pelo Hyper-V no Windows). Copie `.env.example` para `apps/web/.env.local` / `apps/mobile/.env` com as chaves exibidas. Seed: `pnpm db:reset`. Usuários de teste: `*@example.com`, senha `Demo@2026!` (ver `packages/db/supabase/seed.sql`).

## Testes

```bash
pnpm --filter @gc/core test          # regras de negócio (23)
pnpm db:test:up && pnpm test:rls     # RLS/LGPD direto no Postgres (59)
pnpm --filter @gc/web build && pnpm test:e2e   # Playwright (8)
```

Os testes de RLS rodam as migrações reais num Postgres efêmero (porta 55339) com um shim mínimo do Supabase (`auth.uid()`, roles). Exemplos do que é verificado:

- dono do sistema **não lê** `pessoas.nome` (nem nenhuma outra tabela pessoal) e não grava; vê só métricas agregadas com contagens < 3 exibidas como “< 3”;
- isolamento total entre condomínios;
- portaria vê CPF mascarado (`***.456.789-**`), sem contrato, valor ou contato;
- valor da cessão de vaga visível só para cedente, cessionária e síndico;
- break-glass: só após aprovação do síndico, somente leitura, expira sozinho, nunca vê biometria;
- auditoria imutável (nem o superusuário altera) e sem valores pessoais;
- link facial: anônimo só vê primeiro nome/unidade/validade; foto só com consentimento; uso único; expira;
- jobs: exclusão de biometria no check-out/revogação, retenção de 6 meses da portaria.

## LGPD — como está implementado

- **Papéis:** condomínio = controlador; plataforma = operadora. Aceite do DPA registrado (data, IP, versão) no aceite do convite do síndico. Campo de encarregado (DPO) por condomínio.
- **Dono sem dados pessoais:** política `RESTRICTIVE` em todas as tabelas do tenant + métricas via RPC agregada.
- **Criptografia:** CPF e celular com `pgp_sym_encrypt` (chave no Supabase Vault), hash HMAC para busca, versões mascaradas para exibição. CPF completo só via RPC auditada (síndico ou titular).
- **Biometria:** consentimento explícito antes da câmera abrir; bucket privado sem políticas para clientes; caminho aleatório; exclusão automática no fim do período; revogação apaga.
- **Direitos do titular:** exportar JSON, pedir correção/exclusão/revogação (prazo 15 dias), no web (`/privacidade`) e no app (Perfil).
- **2FA (TOTP)** para dono, síndico e portaria.

## Status por fase

| Fase | Feito | Pendente |
|---|---|---|
| 1 — Base | Monorepo, tokens, auth (e-mail/senha + fluxo TOTP), schema multi-tenant com RLS + 59 testes, painel do dono (métricas agregadas, criar condomínio, convite do síndico), seed 2 condomínios | Validar ponta a ponta com `supabase start` (os testes rodam no Postgres puro); e-mail de convite (hoje o link é exibido uma vez ao dono) |
| 2 — Morador | 4 telas no app + link facial na web, fiéis ao design; aprovações do síndico | Tela de login no app; seletor de data/hora nativo no check-in/out; upload do PDF do contrato |
| 3 — Operação | Painel da portaria (registro de acesso, CPF mascarado, vagas cedidas), notificações no banco, jobs (pg_cron + Edge Functions) | Push (Expo Notifications); encomendas/ocorrências na UI |
| 4 — Governança | Transparência (cotações, teto, linha do tempo), break-glass, auditoria, direitos do titular; assembleias/voto no banco (1 voto por unidade) | UI de assembleias; rate limit no link público |
| 5 — Integrações | Adaptadores Control iD / Hikvision / Intelbras (testados com cliente HTTP simulado), planos, `eas.json` | Validar em equipamento real; agente local na rede do condomínio; gateway de cobrança; contas das lojas |
