# GestaCondomínio

Plataforma SaaS multi-condomínio: painel web (dono do sistema, síndico, portaria), app do morador (Expo) e link público de cadastro facial. Privacidade por padrão (LGPD).

**Banco: PostgreSQL puro** (sem Supabase). O isolamento entre condomínios e as regras de privacidade são aplicados **no próprio Postgres** com Row Level Security.

## Arquitetura

```
App do morador (Expo) ──HTTPS /api/v1 (Bearer)──┐
Navegador (painéis, link facial) ──cookie──────┤
                                                ▼
                         Next.js 15 (apps/web) ──► PostgreSQL 17
                         Worker (apps/worker)  ──►   ├ schema auth (login, sessões, TOTP)
                                                     ├ RLS em todas as tabelas
                         Disco privado (/dados) ◄─   └ jobs LGPD (pg_cron ou worker)
                         arquivos cifrados AES-256-GCM
```

- **Conexão:** a aplicação entra como `gc_app`, que não tem privilégio nenhum. Cada requisição abre uma transação com `SET LOCAL ROLE authenticated` + o id do usuário. As políticas RLS usam `auth.uid()`, então mesmo um bug no código não vaza dados de outro condomínio.
- **Login próprio** (`schema auth`): senhas bcrypt, sessões com token opaco (só o hash fica no banco), bloqueio após 5 erros, **TOTP verificado dentro do Postgres** (o segredo não sai do banco), 2FA obrigatório para dono, síndico e portaria.
- **Arquivos** (biometria, contratos): cifrados com AES-256-GCM em disco privado, nome aleatório, servidos só por rotas que checam permissão.
- **Chave de criptografia** (`APP_CRYPTO_KEY`): injetada por transação. Nunca fica gravada no banco nem nos backups.

| Caminho | O quê |
|---|---|
| `apps/web` | Next.js 15 + Tailwind 4 (padrão shadcn/ui). Painéis `/dono`, `/sindico`, `/portaria`, link facial `/f/[token]`, `/privacidade`, convite `/convite/[token]`, API do app `/api/v1/*`. |
| `apps/mobile` | Expo SDK 58 + Expo Router + NativeWind 4. Início, Ceder vaga, Cadastrar locatário, Orçamento público, Transparência, Reservas, Assembleias, Encomendas, Ocorrências, Perfil (LGPD), login. |
| `apps/worker` | Jobs LGPD, fila de exclusão de arquivos, push (Expo), limpeza de sessões. |
| `packages/db` | Migrações SQL, seed fictício, migrador, cliente `Banco` (transação com papel), testes de auth/RLS. |
| `packages/core` | Regras de negócio, formatação pt-BR, schemas Zod, adaptadores de leitores faciais (Control iD, Hikvision, Intelbras). |
| `packages/ui` | Design tokens (web + mobile). |
| `infra/` | `docker-compose.yml` de produção (Postgres, painel, worker, Caddy/HTTPS, backup diário). |

## Desenvolvimento

```bash
pnpm install
pnpm db:test:up                                   # Postgres 17 em Docker (porta 55339)
docker exec test-postgres-teste-1 createdb -U postgres gc_dev
cp .env.example apps/web/.env.local               # preencha GC_APP_PASSWORD e APP_CRYPTO_KEY
pnpm db:migrate && pnpm db:seed && pnpm db:app-user   # com as variáveis do .env.example exportadas
pnpm --filter @gc/web dev                         # http://localhost:3000
pnpm --filter @gc/mobile dev                      # EXPO_PUBLIC_API_URL=http://<seu-ip>:3000
```

Sem `DATABASE_URL`, o painel abre em **modo demonstração** (dados fictícios em memória); sem `EXPO_PUBLIC_API_URL`, o app também.

Usuários do seed (fictícios, senha `Demo@2026!`): `dono@example.com`, `helena.prado@example.com` (síndica), `portaria.acacias@example.com`, `ricardo.alves@example.com` (morador 304-A), `marcos.teixeira@example.com` (síndico de outro condomínio) e outros em `packages/db/seed.sql`. No primeiro login de dono, síndico ou portaria, o painel pede para cadastrar o 2FA.

## Testes

```bash
pnpm --filter @gc/core test        # regras de negócio (26)
pnpm test:rls                      # auth + RLS + LGPD no Postgres (70)
pnpm --filter @gc/web build
pnpm test:e2e                      # Playwright, modo demonstração (8)
pnpm test:e2e:real                 # Playwright contra Postgres real: login, 2FA, aprovação, portaria, link facial (5)
```

Os testes de banco usam o mesmo migrador e o mesmo seed de produção. Entre outras coisas, eles verificam que:

- o dono do sistema **não lê** `pessoas.nome` nem nenhum dado pessoal; vê só agregados com contagens < 3 como “< 3”;
- um condomínio não enxerga outro; o `gc_app` sem papel não lê nada;
- a portaria vê CPF mascarado (`***.456.789-**`), sem contrato, valor ou contato;
- o acesso de suporte (break-glass) só vale com aprovação do síndico, somente leitura, e expira;
- a auditoria é imutável (nem o superusuário altera) e não guarda valores pessoais;
- o bloqueio de login após 5 erros persiste; o TOTP confere com o vetor oficial da RFC 6238;
- o link facial é de uso único, expira e só aceita foto com consentimento;
- o banco impede duas reservas no mesmo horário;
- os jobs apagam biometria no check-out e na revogação, e registros da portaria após 6 meses.

## Produção (VPS)

Veja [infra/DEPLOY.md](infra/DEPLOY.md). Resumo: `cd infra && cp .env.example .env` → preencher → `docker compose up -d --build`.

## Status

| Área | Feito | Pendente |
|---|---|---|
| Base | Monorepo, tokens, auth própria + TOTP, RLS + 70 testes, migrador, Docker/Compose | — |
| Dono | Métricas agregadas, criar condomínio, convite por e-mail (SMTP) | Cobrança (gateway de pagamento) |
| Síndico | Visão geral, aprovações (com motivo e histórico), aluguéis e temporadas (ficha, hóspedes, contrato, encerrar), contratos com fornecedores (vigência, alertas, PDF cifrado), moradores e convites por unidade, ocorrências, comunicados, break-glass, aceite do DPA | Transparência e assembleias pelo painel |
| Portaria | Pessoas autorizadas (CPF mascarado), vagas cedidas, registro de acesso, aviso de encomenda | — |
| Morador (app) | 5 telas do design + reservas, assembleias/voto, encomendas, ocorrências, LGPD, login, push | Builds nas lojas (contas Apple/Google, `eas init`) |
| Hardware | Adaptadores Control iD/Hikvision/Intelbras (testados com HTTP simulado) | Validar em equipamento real; agente local na rede do condomínio |
