import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { Card } from '@/components/ui/card';
import { base32, sessaoDoCookie } from '@/lib/auth';
import { banco, MODO_DEMO } from '@/lib/db';
import { FormCodigo } from './form-codigo';

export const metadata: Metadata = { title: 'Verificação em duas etapas' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (MODO_DEMO) redirect('/login');
  const s = await sessaoDoCookie();
  if (!s) redirect('/login');

  let qr: string | null = null;
  let chaveManual: string | null = null;
  if (!s.totpAtivo) {
    // Novo segredo a cada visita até confirmar; o banco guarda criptografado e verifica o código.
    const [r] = await banco().comoAnon((q) => q<{ hex: string }>('select auth.iniciar_totp($1) as hex', [s.token]));
    chaveManual = base32(r!.hex);
    const uri = `otpauth://totp/GestaCondom%C3%ADnio:${encodeURIComponent(s.email)}?secret=${chaveManual}&issuer=GestaCondom%C3%ADnio&digits=6&period=30`;
    qr = await QRCode.toDataURL(uri, { margin: 1, width: 200 });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-4 px-5">
      <h1 className="m-0 font-heading text-2xl font-semibold">Verificação em duas etapas</h1>
      <p className="m-0 text-muted">
        Obrigatória para dono do sistema, síndico e portaria. Use um app autenticador (Google Authenticator, Authy, 1Password…).
      </p>
      <Card className="flex flex-col gap-3 p-5">
        {qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code para cadastrar no app autenticador" width={200} height={200} className="self-center" />
            <p className="m-0 text-center text-xs text-muted">
              Ou digite a chave: <code className="break-all">{chaveManual}</code>
            </p>
          </>
        ) : null}
        <FormCodigo />
      </Card>
    </main>
  );
}
