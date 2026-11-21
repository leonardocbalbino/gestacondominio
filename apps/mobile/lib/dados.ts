/**
 * Dados do app do morador via API do painel (/api/v1). No servidor tudo roda sob o RLS
 * do próprio usuário. Sem EXPO_PUBLIC_API_URL, usa os dados fictícios do seed.
 */
import type { CessaoVagaInput, ReservaInput } from '@gc/core';
import {
  demoAreas,
  demoAssembleias,
  demoCederVaga,
  demoDemandas,
  demoEncomendas,
  demoMoradorInicio,
  demoOcorrencias,
  type DemandaDemo,
} from '@gc/core/demo';
import { Platform } from 'react-native';
import { api, MODO_DEMO } from './api';

export type Inicio = typeof demoMoradorInicio;
export type Assembleia = (typeof demoAssembleias)[number];
export type Encomenda = (typeof demoEncomendas)[number];
export type Ocorrencia = (typeof demoOcorrencias)[number];

const atraso = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

export const carregarInicio = () => (MODO_DEMO ? atraso(demoMoradorInicio) : api<Inicio>('inicio'));
export const listarDemandas = () => (MODO_DEMO ? atraso(demoDemandas) : api<DemandaDemo[]>('demandas'));
export const carregarDemanda = async (id: string) => (await listarDemandas()).find((d) => d.id === id) ?? null;
export const enviarDuvida = (demandaId: string, pergunta: string) =>
  MODO_DEMO ? atraso(undefined) : api('duvidas', { corpo: { demandaId, pergunta } });

export const opcoesCessao = () => (MODO_DEMO ? atraso(demoCederVaga) : api<typeof demoCederVaga>('cessao/opcoes'));
/** A unidade cessionária confirma no app antes de ir ao síndico. */
export const enviarCessao = (v: CessaoVagaInput) => (MODO_DEMO ? atraso(undefined) : api('cessoes', { corpo: v }));

export type NovaLocacao =
  | { tipo: 'temporada'; responsavel: string; celular: string; checkin: Date; checkout: Date; hospedes: number; origem: string }
  | { tipo: 'aluguel'; nome: string; celular: string; inicio: string; fim: string; imobiliaria?: string; moradores: number; contratoPath?: string };

/** Cria a locação; para temporada devolve os links faciais (uso único) para compartilhar. */
export const enviarLocacao = (v: NovaLocacao) =>
  MODO_DEMO
    ? atraso({ links: ['https://app.gestacondominio.com/f/demo-pedro-1102b-0123456789abcdef0123456789abcdef'] })
    : api<{ links: string[] }>('locacoes', { corpo: v });

/** Envia o PDF do contrato (o servidor guarda cifrado) e devolve a referência. */
export async function enviarContrato(arquivo: { uri: string; name: string; file?: File }): Promise<string> {
  if (MODO_DEMO) return atraso('demo.bin');
  const form = new FormData();
  if (Platform.OS === 'web' && arquivo.file) form.append('arquivo', arquivo.file);
  else form.append('arquivo', { uri: arquivo.uri, name: arquivo.name, type: 'application/pdf' } as unknown as Blob);
  return (await api<{ contratoPath: string }>('contratos', { form })).contratoPath;
}

export const listarAreas = () => (MODO_DEMO ? atraso(demoAreas) : api<{ id: string; nome: string }[]>('areas'));
export const enviarReserva = (v: ReservaInput) => (MODO_DEMO ? atraso(undefined) : api('reservas', { corpo: v }));

export const listarAssembleias = () => (MODO_DEMO ? atraso(demoAssembleias) : api<Assembleia[]>('assembleias'));
export const votar = (pautaId: string, opcao: 'sim' | 'nao' | 'abstencao') =>
  MODO_DEMO ? atraso(undefined) : api('votos', { corpo: { pautaId, opcao } });

export const listarEncomendas = () => (MODO_DEMO ? atraso(demoEncomendas) : api<Encomenda[]>('encomendas'));
export const listarOcorrencias = () => (MODO_DEMO ? atraso(demoOcorrencias) : api<Ocorrencia[]>('ocorrencias'));
export const abrirOcorrencia = (titulo: string, descricao?: string) =>
  MODO_DEMO ? atraso(undefined) : api('ocorrencias', { corpo: { titulo, descricao } });

export const exportarMeusDados = () => (MODO_DEMO ? atraso({ aviso: 'Modo demonstração' }) : api<unknown>('meus-dados'));
export const revogarFacial = () => (MODO_DEMO ? atraso(undefined) : api('facial/revogar', { metodo: 'POST' }));
export const pedidoTitular = (tipo: 'correcao' | 'exclusao') => (MODO_DEMO ? atraso(undefined) : api('pedidos-titular', { corpo: { tipo } }));
export const registrarPush = (token: string, plataforma: string) =>
  MODO_DEMO ? atraso(undefined) : api('push', { corpo: { token, plataforma } });
