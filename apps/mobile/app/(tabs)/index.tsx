import { Link, router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BADGE_ETAPA, BADGE_STATUS, formatDiaMes, formatFaixaHoras, formatPeriodo, resumoCotacoes } from '@gc/core';
import type { DemandaDemo } from '@gc/core/demo';
import { colors } from '@gc/ui';
import { AddPessoa, Calendario, Facial, Sino, Vaga } from '@/components/icones';
import { Badge, Card, T, Titulo } from '@/components/ui';
import { carregarInicio, listarDemandas, type Inicio } from '@/lib/dados';

/** Morador · Início */
export default function TelaInicio() {
  const [d, setD] = useState<Inicio | null>(null);
  const [demandas, setDemandas] = useState<DemandaDemo[]>([]);

  useEffect(() => {
    carregarInicio().then(setD);
    listarDemandas().then(setDemandas);
  }, []);

  if (!d) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const acoes: { rotulo: string; href: Href; Icone: typeof AddPessoa }[] = [
    { rotulo: 'Cadastrar locatário', href: '/locatario', Icone: AddPessoa },
    { rotulo: 'Ceder minha vaga', href: '/ceder-vaga', Icone: Vaga },
    { rotulo: 'Cadastro facial', href: '/perfil', Icone: Facial },
    { rotulo: 'Reservar espaço', href: '/servicos', Icone: Calendario },
  ];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="gap-[18px] px-[18px] py-5">
        <View className="flex-row items-center justify-between">
          <View>
            <T className="text-[13px] text-muted">{d.condominio.nome}</T>
            <Titulo className="mt-0.5 text-[24px] leading-[30px]">Olá, {d.usuario.primeiroNome}</Titulo>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Notificações${d.usuario.notificacoesNaoLidas ? `, ${d.usuario.notificacoesNaoLidas} não lidas` : ''}`}
            className="h-11 w-11 items-center justify-center rounded-full border border-line bg-surface"
          >
            <Sino />
            {d.usuario.notificacoesNaoLidas > 0 ? <View className="absolute right-[10px] top-[9px] h-2 w-2 rounded-full bg-alert" /> : null}
          </Pressable>
        </View>

        <View className="gap-3 rounded-[18px] bg-primary-dark px-[18px] py-4">
          <View className="flex-row items-center justify-between">
            <View>
              <T className="font-inter-semibold text-[12px] text-primary-soft-border">MINHA UNIDADE</T>
              <Titulo className="text-[26px] leading-[32px] text-white">{d.unidade.codigo}</Titulo>
            </View>
            <View className="rounded-full bg-white/10 px-2.5 py-1">
              <T className="font-inter-semibold text-[12px] text-white">{d.unidade.vinculo}</T>
            </View>
          </View>
          <View className="flex-row gap-2">
            {[
              ['Facial', `${d.resumo.facialCadastradas} de ${d.resumo.facialTotal}`],
              ['Vaga', `Nº ${d.resumo.vaga}`],
              ['Locatários', d.resumo.locatariosPendentes ? `${d.resumo.locatariosPendentes} pendente${d.resumo.locatariosPendentes > 1 ? 's' : ''}` : 'Nenhum'],
            ].map(([r, v]) => (
              <View key={r} className="flex-1 rounded-[10px] bg-white/[0.08] px-2.5 py-2">
                <T className="text-[12px] text-primary-soft-border">{r}</T>
                <T className="font-inter-semibold text-white">{v}</T>
              </View>
            ))}
          </View>
        </View>

        <View accessibilityLabel="Ações rápidas" className="flex-row flex-wrap gap-2.5">
          {acoes.map((a) => (
            <Link key={a.rotulo} href={a.href} asChild>
              <Pressable
                accessibilityRole="link"
                className="min-h-11 grow basis-[45%] gap-2.5 rounded-2xl border border-line bg-surface p-3.5 active:border-primary"
              >
                <View className="h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-primary-soft">
                  <a.Icone cor={colors.primary} />
                </View>
                <T className="font-inter-semibold">{a.rotulo}</T>
              </Pressable>
            </Link>
          ))}
        </View>

        <Card className="gap-2.5 px-4 py-3.5">
          <Titulo className="text-[16px]">Meus pedidos</Titulo>
          {d.pedidos.length === 0 ? <T className="text-muted">Nenhum pedido em andamento.</T> : null}
          {d.pedidos.map((p) => {
            const b = BADGE_STATUS[p.status] ?? { texto: p.status, tom: 'neu' as const };
            const quando = p.detalhe === 'reserva' ? `${formatDiaMes(p.inicio)} · ${formatFaixaHoras(p.inicio, p.fim)}` : `${formatPeriodo(p.inicio, p.fim)} · ${p.detalhe}`;
            return (
              <View key={p.id} className="flex-row items-center justify-between gap-2.5">
                <View className="flex-1">
                  <T className="font-inter-semibold">{p.titulo}</T>
                  <T className="text-[12px] text-muted">{quando}</T>
                </View>
                <Badge tom={b.tom}>{b.texto}</Badge>
              </View>
            );
          })}
        </Card>

        <Card className="overflow-hidden">
          <View className="flex-row items-center justify-between px-4 pb-1.5 pt-3.5">
            <Titulo className="text-[16px]">Transparência</Titulo>
            <Link href="/transparencia" accessibilityRole="link">
              <T className="font-inter-semibold text-[13px] text-primary underline">Ver tudo</T>
            </Link>
          </View>
          {demandas.slice(0, 2).map((dm) => (
            <Pressable
              key={dm.id}
              accessibilityRole="link"
              onPress={() => router.push(`/transparencia/${dm.id}`)}
              className="min-h-11 flex-row items-center justify-between gap-2.5 border-t border-surface-2 px-4 py-2.5"
            >
              <View className="flex-1">
                <T className="font-inter-semibold">{dm.titulo}</T>
                <T className="text-[12px] text-muted">
                  {dm.etapa === 'cotacoes'
                    ? resumoCotacoes(dm.cotacoes.map((c) => c.valor))
                    : dm.assembleiaEm
                      ? `Assembleia em ${formatDiaMes(dm.assembleiaEm)}`
                      : BADGE_ETAPA[dm.etapa].texto}
                </T>
              </View>
              <Badge tom={BADGE_ETAPA[dm.etapa].tom}>{BADGE_ETAPA[dm.etapa].textoCurto}</Badge>
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
