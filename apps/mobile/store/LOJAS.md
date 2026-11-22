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

## Pendências (bloqueiam a publicação)

1. **Domínio com HTTPS.** O app de produção precisa de `EXPO_PUBLIC_API_URL=https://...` (em `eas.json` está `PREENCHER_DOMINIO_COM_HTTPS`). Android e iOS bloqueiam HTTP puro por padrão, então o servidor de teste `http://IP:8900` não serve para o app das lojas. Sem a variável, o build sai em **modo demonstração**.
2. **2FA reativado em produção.** O servidor de teste está com `DESATIVAR_2FA=1`. No ambiente de produção use `docker-compose.yml` sozinho (padrão `0`).
3. **Contas de desenvolvedor:** Apple Developer Program (US$ 99/ano) e Google Play Console (US$ 25, verificação de identidade; conta pessoal nova exige teste fechado com 12 testadores por 14 dias antes da produção).
4. **`eas init`:** gera o `projectId` (sem ele o push não registra).
5. **App Store Connect:** criar o app com bundle `app.gestacondominio` e preencher `ascAppId` no `eas.json`.
6. **Google Play:** criar o app com pacote `app.gestacondominio`, conta de serviço com acesso à API e salvar a chave em `apps/mobile/play-service-account.json` (já no `.gitignore`). O primeiro envio do AAB costuma ser manual pelo Console.
7. **URL pública da política de privacidade** (`https://DOMINIO/privacidade`) — obrigatória nas duas lojas — e **URL de suporte** (iOS).
8. **Conta de demonstração para a revisão** (Apple e Google): um morador num condomínio de teste com dados fictícios, e-mail e senha informados nas notas da revisão. Como o login é só por convite, sem isso o app é rejeitado.
9. **Identificadores:** `app.gestacondominio` fica permanente após o primeiro envio. Confirme se é o desejado (o comum é domínio invertido de um domínio seu, ex.: `br.com.seudominio.gestacondominio`).
10. **Revisão das capturas:** são do modo demonstração (dados fictícios, nomes inventados). Confira se representam o app e troque os títulos se quiser.
11. **Notificações push iOS:** a chave APNs é criada pelo `eas build` (aceite quando perguntar).
