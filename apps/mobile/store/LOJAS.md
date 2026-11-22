# Publicação nas lojas (App Store e Google Play)

As artes são geradas por `apps/mobile/scripts/gerar-artes.mjs` (veja o cabeçalho do script).
Para refazer as capturas, exporte o app em modo demonstração e passe a pasta:

```powershell
cd apps/mobile; Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
npx expo export --platform web --output-dir "$env:TEMP\gc-web-demo"
cd ..\..; node apps/mobile/scripts/gerar-artes.mjs "$env:TEMP\gc-web-demo"
```

## Arquivos

| Arquivo | Uso |
|---|---|
| `assets/icon.png` (1024, opaco) | Ícone iOS / App Store |
| `assets/adaptive-icon.png` + `-monochrome.png` | Ícone adaptativo Android (fundo `#0F3B37`) |
| `assets/splash-icon.png` | Splash (fundo `#0F3B37`) |
| `assets/notification-icon.png` | Ícone de notificação Android |
| `store/play-icone-512.png` | Ícone da ficha da Google Play |
| `store/play-feature-graphic.png` (1024x500) | Gráfico de recursos da Google Play |
| `store/capturas/ios-6.9/*.png` (1290x2796) | Capturas iPhone 6,9" (a Apple reduz para os demais tamanhos) |
| `store/capturas/android/*.png` (1080x1920) | Capturas de telefone da Google Play |

## Textos da ficha (pt-BR)

**Nome:** GestaCondomínio
**Subtítulo (iOS, até 30):** Seu condomínio no celular
**Descrição curta (Play, até 80):** Transparência, reservas, encomendas e portaria do seu condomínio no celular.

**Descrição completa:**

> O GestaCondomínio reúne no celular o que o morador precisa no dia a dia do condomínio.
>
> • Transparência: veja orçamentos, cotações e para onde vai o dinheiro da taxa, e tire dúvidas com o síndico.
> • Reservas: peça o salão de festas e outras áreas comuns em poucos toques.
> • Encomendas: saiba quando sua encomenda chegou na portaria.
> • Vaga de garagem: ceda sua vaga com registro e aprovação.
> • Locatários e temporada: cadastre inquilinos e hóspedes, que recebem um link para o acesso facial válido só durante a estadia.
> • Assembleias: acompanhe as pautas e vote pelo celular.
> • Ocorrências: registre e acompanhe chamados.
>
> Privacidade em primeiro lugar (LGPD): você exporta seus dados, pede correção ou exclusão da conta e revoga o consentimento da biometria direto no app.
>
> Acesso por convite do seu condomínio. Não existe cadastro aberto.

**Palavras-chave (iOS, até 100):** condomínio,síndico,portaria,morador,reserva,encomenda,assembleia,transparência,vaga,LGPD
**Categoria:** Estilo de vida (iOS) / Casa e decoração ou Produtividade (Play)
**Classificação etária:** 4+ / Livre (não há conteúdo gerado sem moderação visível a terceiros)

## Formulários de privacidade

**Apple (App Privacy)** e **Google (Segurança dos dados)**: dados coletados e vinculados à identidade, sem rastreamento e sem compartilhamento com terceiros para publicidade.
- Contato: nome, e-mail, telefone (funcionalidade do app)
- Identificadores: ID do usuário; token de push (funcionalidade)
- Dados sensíveis: CPF e foto facial (biometria) — a foto é enviada pelo link web, não pelo app; declare mesmo assim se o mesmo serviço a processa
- Criptografia em trânsito: sim (exige HTTPS — veja pendências). Exclusão de dados: sim, pelo app (Perfil → Pedir exclusão da conta) e pela página `/privacidade`.

## Comandos

```bash
cd apps/mobile
npx eas login && npx eas init            # grava extra.eas.projectId no app.json (necessário para o push)
npx eas build -p android --profile production
npx eas build -p ios --profile production
npx eas submit -p android --profile production
npx eas submit -p ios --profile production
```

## Links públicos (preencher nas lojas)

| Campo | URL |
|---|---|
| Política de privacidade (Apple e Google) | `https://DOMINIO/politica-de-privacidade` |
| URL de suporte (Apple) / site e e-mail de contato (Google) | `https://DOMINIO/suporte` |
| Exclusão de conta (Google, Segurança dos dados) | `https://DOMINIO/excluir-conta` |

Enquanto não houver domínio, funcionam no servidor de teste: http://169.58.37.26:8900/politica-de-privacidade, /suporte e /excluir-conta.
O contato exibido vem de `SUPORTE_EMAIL` e `RESPONSAVEL_LEGAL` no `infra/.env`. No app, Perfil → Ajuda abre a política e o suporte.

## Pendências

Feito: artes, capturas, textos da ficha, páginas de política, suporte e exclusão de conta, contas de desenvolvedor (Apple e Google).

Bloqueiam a publicação:

1. **Domínio com HTTPS.** O app de produção precisa de `EXPO_PUBLIC_API_URL=https://...` (em `eas.json` está `PREENCHER_DOMINIO_COM_HTTPS`). Android e iOS bloqueiam HTTP puro, então o servidor `http://IP:8900` não serve para o app das lojas, e as lojas também esperam os links de política/suporte em HTTPS. Sem a variável, o build sai em **modo demonstração**.
2. **Contato e responsável legal.** Definir `SUPORTE_EMAIL` (caixa que alguém lê) e `RESPONSAVEL_LEGAL` (razão social + CNPJ, ou nome) no `infra/.env`. Sem e-mail, as páginas mandam o usuário ao app.
3. **Revisão jurídica da política** (`apps/web/app/politica-de-privacidade/page.tsx`): foi escrita a partir do que o sistema faz; confirme bases legais, prazos e fornecedores (hospedagem, e-mail) com quem responde pela LGPD.
4. **2FA de volta em produção.** O servidor de teste está com `DESATIVAR_2FA=1`; a produção sobe só com `docker-compose.yml` (padrão `0`).
5. **Identificador do app.** `app.gestacondominio` fica permanente após o primeiro envio. Confirmar (ou trocar por domínio invertido, ex.: `br.com.seudominio.gestacondominio`) antes do passo 6.
6. **Criar o app nas lojas e ligar ao EAS:**
   - `npx eas login && npx eas init` em `apps/mobile` (gera o `projectId`; sem ele o push não registra).
   - App Store Connect: criar o app com o bundle ID e colocar o `ascAppId` (Apple ID numérico do app) no `eas.json`.
   - Play Console: criar o app; conta de serviço do Google Cloud com acesso ao app e a chave em `apps/mobile/play-service-account.json` (já no `.gitignore`). O primeiro AAB normalmente é enviado à mão pelo Console.
7. **Conta de demonstração para a revisão** (Apple e Google): um morador num condomínio de teste com dados fictícios; e-mail e senha nas notas da revisão. O login é só por convite, então sem isso o app é rejeitado.
8. **Teste fechado na Google Play** (só se a conta for pessoal criada depois de nov/2023): 12 testadores por 14 dias antes de liberar a produção.
9. **Formulários das lojas:** App Privacy (Apple), Segurança dos dados, classificação de conteúdo, público-alvo e declaração de app de governo/finanças "não" (Google), conforme a seção acima.
10. **Revisar capturas e títulos:** são do modo demonstração (dados fictícios); a tela de Reservas aparece com a data vazia.
11. **Push no iOS:** aceite criar a chave APNs quando o `eas build` perguntar.
