'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { supabaseNavegador } from '@/lib/supabase/client';

export function DoisFatores({ cadastrar }: { cadastrar: boolean }) {
  const router = useRouter();
  const [fatorId, setFatorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseNavegador();
    (async () => {
      if (cadastrar) {
        const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'GestaCondomínio' });
        if (error) return setErro('Não foi possível iniciar o cadastro do 2FA');
        setFatorId(data.id);
        setQr(data.totp.qr_code);
      } else {
        const { data } = await sb.auth.mfa.listFactors();
        setFatorId(data?.totp[0]?.id ?? null);
      }
    })();
  }, [cadastrar]);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!fatorId) return;
    const sb = supabaseNavegador();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo.trim() });
    if (error) return setErro('Código inválido');
    router.replace('/');
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <img src={qr} alt="QR code para o app autenticador" width={180} height={180} className="self-center" /> : null}
      <form onSubmit={verificar} className="flex flex-col gap-3">
        <Field label="Código de 6 dígitos">
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        </Field>
        {erro ? (
          <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
            {erro}
          </p>
        ) : null}
        <Button size="lg" disabled={!fatorId}>
          Verificar
        </Button>
      </form>
    </Card>
  );
}
