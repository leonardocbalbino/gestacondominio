import 'server-only';
import nodemailer from 'nodemailer';

/**
 * Envio de e-mail via SMTP (SMTP_URL=smtps://usuario:senha@smtp.exemplo.com:465).
 * Sem SMTP configurado (desenvolvimento), devolve false e o chamador mostra o link na tela.
 */
export async function enviarEmail(para: string, assunto: string, texto: string): Promise<boolean> {
  const url = process.env.SMTP_URL;
  if (!url) return false;
  const t = nodemailer.createTransport(url);
  await t.sendMail({ from: process.env.SMTP_FROM ?? 'GestaCondomínio <nao-responda@gestacondominio.app>', to: para, subject: assunto, text: texto });
  return true;
}
