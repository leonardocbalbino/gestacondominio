import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDiaMesHora } from '@gc/core';
import { Badge, Cabecalho, Card, Carregando, T, Titulo } from '@/components/ui';
import { listarAssembleias, votar, type Assembleia } from '@/lib/dados';
import { tratarErro, useDados } from '@/lib/useDados';

const OPCOES = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'abstencao', rotulo: 'Abstenção' },
] as const;

/** Assembleias: um voto por unidade; o resultado é agregado (não mostra quem votou). */
export default function TelaAssembleias() {
  const { dados, erro, recarregar } = useDados<Assembleia[]>(listarAssembleias);
  const [enviando, setEnviando] = useState<string | null>(null);
  if (!dados) return <Carregando erro={erro} onTentar={recarregar} />;

  function confirmar(pautaId: string, opcao: (typeof OPCOES)[number]) {
    Alert.alert(`Votar "${opcao.rotulo}"?`, 'O voto é da unidade e não pode ser alterado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setEnviando(pautaId);
          try {
            await votar(pautaId, opcao.valor);
            await recarregar();
          } catch (e) {
            tratarErro(e);
          } finally {
            setEnviando(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Cabecalho titulo="Assembleias" />
      <ScrollView contentContainerClassName="gap-3.5 px-[18px] pb-6 pt-2">
        {dados.length === 0 ? <T className="text-muted">Nenhuma assembleia convocada.</T> : null}
        {dados.map((a) => (
          <Card key={a.id} className="gap-3 p-4">
            <View>
              <Titulo className="text-[16px]">{a.titulo}</Titulo>
              <T className="text-[12px] text-muted">{formatDiaMesHora(new Date(a.dataHora))}</T>
            </View>
            {a.pautas.map((p) => {
              const total = p.resultado.sim + p.resultado.nao + p.resultado.abstencao;
              return (
                <View key={p.id} className="gap-2 border-t border-surface-2 pt-3">
                  <T className="font-inter-semibold">{p.titulo}</T>
                  {p.meuVoto ? (
                    <Badge tom="ok">Sua unidade votou: {OPCOES.find((o) => o.valor === p.meuVoto)?.rotulo}</Badge>
                  ) : p.votacaoAberta ? (
                    <View className="flex-row gap-2">
                      {OPCOES.map((o) => (
                        <Pressable
                          key={o.valor}
                          accessibilityRole="button"
                          disabled={enviando === p.id}
                          onPress={() => confirmar(p.id, o)}
                          className="min-h-11 flex-1 items-center justify-center rounded-xl border border-line-input bg-surface active:border-primary"
                        >
                          <Text className="font-inter-semibold text-[14px] text-ink">{o.rotulo}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Badge tom="neu">Votação ainda não aberta</Badge>
                  )}
                  {total > 0 ? (
                    <T className="text-[12px] text-muted">
                      Parcial: {p.resultado.sim} sim · {p.resultado.nao} não · {p.resultado.abstencao} abstenção
                    </T>
                  ) : null}
                </View>
              );
            })}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
