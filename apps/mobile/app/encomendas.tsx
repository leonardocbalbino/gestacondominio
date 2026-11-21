import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDiaMesHora } from '@gc/core';
import { Badge, Cabecalho, Card, Carregando, T } from '@/components/ui';
import { listarEncomendas, type Encomenda } from '@/lib/dados';
import { useDados } from '@/lib/useDados';

export default function TelaEncomendas() {
  const { dados, erro, recarregar } = useDados<Encomenda[]>(listarEncomendas);
  if (!dados) return <Carregando erro={erro} onTentar={recarregar} />;
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Cabecalho titulo="Encomendas" />
      <ScrollView contentContainerClassName="px-[18px] pb-6 pt-2">
        <Card className="overflow-hidden">
          {dados.length === 0 ? <T className="px-4 py-4 text-muted">Nenhuma encomenda.</T> : null}
          {dados.map((e, i) => (
            <View key={e.id} className={`flex-row items-center justify-between gap-2.5 px-4 py-3 ${i ? 'border-t border-surface-2' : ''}`}>
              <View className="flex-1">
                <T className="font-inter-semibold">{e.descricao}</T>
                <T className="text-[12px] text-muted">Chegou {formatDiaMesHora(new Date(e.recebidaEm))}</T>
              </View>
              {e.retiradaEm ? <Badge tom="neu">Retirada</Badge> : <Badge tom="warn">Na portaria</Badge>}
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
