'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { IconeCamera, IconeSemOculos, IconePessoa, IconeSol } from '@/components/icones';
import { consentir } from './actions';

interface Props {
  token: string;
  condominio: string;
  sigla: string;
  primeiroNome: string;
  unidade: string;
  versaoTermo: string;
  validade: string;
}

type Etapa = 'inicio' | 'camera' | 'arquivo' | 'enviando' | 'pronto' | 'erro';

/** Reduz para no máx. 720×960 e converte em JPEG (o servidor aceita só JPEG ≤ 2 MB). */
function paraJpeg(fonte: CanvasImageSource, largura: number, altura: number): Promise<Blob | null> {
  const escala = Math.min(1, 720 / largura, 960 / altura);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(largura * escala);
  canvas.height = Math.round(altura * escala);
  canvas.getContext('2d')?.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
}

export function CadastroFacial(p: Props) {
  const [aceite, setAceite] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  // Libera a câmera ao sair da página.
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  async function abrirCamera() {
    // Sem HTTPS (ou em navegadores antigos) não há câmera ao vivo: usa a câmera nativa do celular.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setEtapa('arquivo');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 720, height: 960 }, audio: false });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setEtapa('camera');
    } catch {
      setErro('Não foi possível abrir a câmera ao vivo. Use o botão abaixo para tirar a foto com a câmera do celular.');
      setEtapa('arquivo');
    }
  }

  async function enviar(blob: Blob | null) {
    if (!blob) return setEtapa('erro');
    setEtapa('enviando');
    const fd = new FormData();
    fd.set('token', p.token);
    fd.set('foto', blob, 'face.jpg');
    const r = await fetch('/api/facial', { method: 'POST', body: fd });
    if (r.ok) setEtapa('pronto');
    else {
      setErro((await r.json().catch(() => null))?.erro ?? 'Falha ao enviar a foto');
      setEtapa('erro');
    }
  }

  // Foto tirada pela câmera nativa: decodifica, reduz e envia (nada fica salvo pelo site).
  function fotoDoArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErro(null);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = async () => {
      const blob = await paraJpeg(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      await enviar(blob);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErro('Não foi possível ler a foto. Tente novamente.');
    };
    img.src = url;
  }

  function tirarFoto() {
    setErro(null);
    if (etapa !== 'camera') {
      // 1º toque: registra o consentimento e abre a câmera.
      iniciar(async () => {
        const r = await consentir(p.token, p.versaoTermo);
        if (!r.ok) {
          setErro(r.erro ?? 'Não foi possível continuar');
          return;
        }
        await abrirCamera();
      });
      return;
    }
    // 2º toque: captura o quadro e envia direto ao servidor (nada fica salvo no aparelho).
    const v = video.current;
    if (!v) return;
    setEtapa('enviando');
    void paraJpeg(v, v.videoWidth || 720, v.videoHeight || 960).then((blob) => {
      stream.current?.getTracks().forEach((t) => t.stop());
      return enviar(blob);
    });
  }

  if (etapa === 'pronto') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 bg-bg px-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-2xl text-success">✓</span>
        <h1 className="font-heading text-2xl font-semibold">Pronto, {p.primeiroNome}!</h1>
        <p className="text-muted">
          Seu acesso facial foi enviado ao {p.condominio}. Ele vale só durante o período aprovado, e a foto é apagada depois.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-bg">
      <div className="flex flex-1 flex-col gap-4 px-5 pb-4 pt-[22px]">
        <header className="flex items-center gap-2.5">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-primary-dark font-heading text-[13px] font-bold text-white">
            {p.sigla}
          </div>
          <div>
            <div className="font-semibold">{p.condominio}</div>
            <div className="text-xs text-muted">Cadastro de acesso facial</div>
          </div>
        </header>

        <div>
          <h1 className="m-0 font-heading text-2xl font-semibold">Olá, {p.primeiroNome}</h1>
          <div className="text-muted">Unidade {p.unidade} · leva menos de 1 minuto</div>
        </div>

        <div
          className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-[20px] bg-camera"
          role="img"
          aria-label="Pré-visualização da câmera com guia oval para o rosto"
        >
          <video
            ref={video}
            playsInline
            muted
            className={etapa === 'camera' || etapa === 'enviando' ? 'absolute inset-0 h-full w-full -scale-x-100 object-cover' : 'hidden'}
          />
          <div className="relative h-[236px] w-[180px] rounded-[50%] border-[3px] border-accent-ring shadow-[0_0_0_999px_rgba(0,0,0,.35)]" />
          <div className="absolute inset-x-0 bottom-3.5 text-center text-[13px] font-semibold text-white">
            {etapa === 'enviando' ? 'Enviando com segurança…' : 'Centralize o rosto no contorno'}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icone: <IconeSol />, texto: 'Boa luz' },
            { icone: <IconeSemOculos />, texto: 'Sem óculos escuros' },
            { icone: <IconePessoa />, texto: 'Rosto de frente' },
          ].map((d) => (
            <div key={d.texto} className="flex flex-col items-center gap-1 text-center text-xs font-semibold text-ink-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-primary">{d.icone}</span>
              {d.texto}
            </div>
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            disabled={etapa !== 'inicio'}
            className="mt-px h-5 w-5 flex-none accent-primary"
          />
          <span className="text-[13px]">
            Autorizo o uso da minha imagem facial <b>só para liberar o acesso</b> ao condomínio, conforme a LGPD. Posso pedir a exclusão a
            qualquer momento. <a href="/privacidade/termo-biometria" target="_blank">Ler termo</a>
          </span>
        </label>
        {erro ? (
          <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
            {erro}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-surface px-5 pb-6 pt-3">
        <input ref={arquivo} type="file" accept="image/*" capture="user" className="hidden" onChange={fotoDoArquivo} />
        {etapa === 'arquivo' ? (
          <Button size="lg" onClick={() => arquivo.current?.click()}>
            <IconeCamera />
            Abrir câmera do celular
          </Button>
        ) : (
          <Button size="lg" onClick={tirarFoto} disabled={!aceite || pendente || etapa === 'enviando'}>
            <IconeCamera />
            {etapa === 'camera' ? 'Capturar foto' : 'Tirar foto'}
          </Button>
        )}
        <div className="text-center text-xs text-muted">{p.validade}</div>
      </div>
    </main>
  );
}
