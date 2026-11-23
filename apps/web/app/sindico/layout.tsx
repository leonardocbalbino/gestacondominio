import { suporteAtivo } from '@gc/core';
import { Moldura } from '@/components/painel';
import type { ItemNav } from '@/components/nav-lateral';
import { aprovacoesPendentes, pedidosSuporte } from '@/lib/dados';
import { listarContratos, listarOcorrencias, situacaoContrato } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export default async function LayoutSindico({ children }: { children: React.ReactNode }) {
  const s = await exigirPerfil('sindico', 'conselho');
  const cid = s.condominioId!;
  const ehSindico = s.perfil === 'sindico';

  const [pendentes, contratos, ocorrencias, suporte] = await Promise.all([
    ehSindico ? aprovacoesPendentes(s.userId, cid) : [],
    listarContratos(s.userId, cid),
    ehSindico ? listarOcorrencias(s.userId, cid) : [],
    ehSindico ? pedidosSuporte(s.userId, cid) : [],
  ]);
  const alertasContratos = contratos.filter((c) => ['warn', 'bad'].includes(situacaoContrato(c).tom)).length;
  const suporteAberto = suporte.filter((x) => x.status === 'solicitado' || suporteAtivo({ status: x.status, expira_em: x.expiraEm })).length;

  const nav: ItemNav[] = ehSindico
    ? [
        { href: '/sindico', rotulo: 'Visão geral', icone: 'inicio', exato: true },
        { href: '/sindico/aprovacoes', rotulo: 'Aprovações', icone: 'aprovacoes', contador: pendentes.length },
        { href: '/sindico/alugueis', rotulo: 'Aluguéis', icone: 'alugueis' },
        { href: '/sindico/contratos', rotulo: 'Contratos', icone: 'contratos', contador: alertasContratos },
        { href: '/sindico/moradores', rotulo: 'Moradores', icone: 'moradores' },
        { href: '/sindico/ocorrencias', rotulo: 'Ocorrências', icone: 'ocorrencias', contador: ocorrencias.filter((o) => o.status === 'aberta').length },
        { href: '/sindico/comunicados', rotulo: 'Comunicados', icone: 'comunicados' },
        { href: '/sindico/suporte', rotulo: 'Acesso do suporte', icone: 'suporte', contador: suporteAberto },
        { href: '/privacidade', rotulo: 'Privacidade', icone: 'privacidade' },
      ]
    : [
        { href: '/sindico', rotulo: 'Visão geral', icone: 'inicio', exato: true },
        { href: '/sindico/contratos', rotulo: 'Contratos', icone: 'contratos', contador: alertasContratos },
        { href: '/sindico/comunicados', rotulo: 'Comunicados', icone: 'comunicados' },
        { href: '/privacidade', rotulo: 'Privacidade', icone: 'privacidade' },
      ];

  return (
    <Moldura sessao={s} nav={nav}>
      {children}
    </Moldura>
  );
}
