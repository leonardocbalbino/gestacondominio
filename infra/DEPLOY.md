# Deploy em VPS (Docker)

Requisitos: Ubuntu 22.04+ (ou similar), 2 GB de RAM, Docker com o plugin compose, um domínio apontando (registro A) para o IP da VPS.

## 1. Acesso seguro à VPS

Antes de tudo: use chave SSH e desative o login por senha do root.

```bash
ssh-copy-id root@SEU_IP                     # da sua máquina
# na VPS:
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

## 2. Instalar e subir

```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/leonardocbalbino/gestacondominio.git /opt/gestacondominio
cd /opt/gestacondominio/infra
cp .env.example .env
for v in POSTGRES_PASSWORD GC_APP_PASSWORD APP_CRYPTO_KEY; do sed -i "s|^$v=.*|$v=$(openssl rand -base64 48 | tr -d '/+=' )|" .env; done
nano .env                                    # DOMINIO e SMTP
chmod 600 .env
docker compose up -d --build
docker compose logs -f migrar web            # acompanhe a primeira subida
```

O Caddy emite o certificado HTTPS sozinho. Guarde uma cópia do `APP_CRYPTO_KEY` fora da VPS (gerenciador de senhas): sem ela, CPFs, segredos 2FA e arquivos cifrados ficam ilegíveis.

### Sem domínio (teste por IP:porta)

Só para testes com dados fictícios: sem HTTPS, senhas trafegam sem criptografia. O Caddy não sobe e o painel fica em `http://IP:PORTA`.

```bash
# no .env: DOMINIO=<ip da VPS> e PORTA=8900
docker compose -f docker-compose.yml -f docker-compose.ip.yml up -d --build
```

Nesse modo o link facial usa a câmera nativa do celular, porque o navegador só libera a câmera ao vivo em HTTPS. Quando tiver domínio, troque `DOMINIO` e suba só com `docker-compose.yml`.

## 3. Primeiro acesso (dono do sistema)

Não existe cadastro aberto. Crie o dono uma única vez:

```bash
docker compose exec postgres psql -U gc_admin gestacondominio -c "
  insert into auth.users (email, nome, senha_hash, email_confirmado_em)
  values ('voce@seudominio.com', 'Seu Nome', extensions.crypt('TROQUE-ESTA-SENHA-LONGA', extensions.gen_salt('bf')), now());
  insert into public.plataforma_admins (user_id) select id from auth.users where email = 'voce@seudominio.com';"
```

Entre em `https://DOMINIO/login`, cadastre o 2FA, crie o primeiro condomínio e o síndico recebe o convite por e-mail.

## Atualizar

```bash
cd /opt/gestacondominio && git pull && cd infra && docker compose up -d --build
```

As migrações pendentes rodam automaticamente (serviço `migrar`) antes do painel subir.

## Backups

O serviço `backup` faz `pg_dump` diário no volume `backups` (14 dias). Copie também o volume `arquivos` (cifrado) para fora da VPS:

```bash
docker run --rm -v gestacondominio_backups:/b -v gestacondominio_arquivos:/a -v /root:/out alpine \
  tar czf /out/gc-$(date +%F).tgz /b /a
```

Restaurar: `docker compose exec -T postgres pg_restore -U gc_admin -d gestacondominio --clean < gc-AAAA-MM-DD.dump`.
