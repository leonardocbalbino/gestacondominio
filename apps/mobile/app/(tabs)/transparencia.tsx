import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BADGE_ETAPA, formatDiaMes, resumoCotacoes } from '@gc/core';
import type { DemandaDemo } from '@gc/core/demo';
import { Badge, Card, T, Titulo } from '@/components/ui';
import { listarDemandas } from '@/lib/dados';
import { useDados } from '@/lib/useDados';

export default function TelaTransparencia() {
  const { dados } = useDados<DemandaDemo[]>(listarDemandas);
  const lista = dados ?? [];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="gap-3.5 px-[18px] py-5">
        <Titulo className="text-[24px]">Transparência</Titulo>
        <T className="text-muted">Obras, cotações e decisões do condomínio, abertas para todos os moradores.</T>
        <Card className="overflow-hidden">
          {lista.map((d, i) => (
            <Pressable
              key={d.id}
              accessibilityRole="link"
              onPress={() => router.push(`/transparencia/${d.id}`)}
              className={`min-h-11 flex-row items-center justify-between gap-2.5 px-4 py-3 ${i ? 'border-t border-surface-2' : ''}`}
            >
              <View className="flex-1">
                <T className="font-inter-semibold">
                  {d.titulo}
                  {d.local ? ` · ${d.local}` : ''}
                </T>
                <T className="text-[12px] text-muted">
                  {d.assembleiaEm ? `Assembleia em ${formatDiaMes(d.assembleiaEm)}` : resumoCotacoes(d.cotacoes.map((c) => c.valor))}
                </T>
              </View>
              <Badge tom={BADGE_ETAPA[d.etapa].tom}>{BADGE_ETAPA[d.etapa].textoCurto}</Badge>
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
