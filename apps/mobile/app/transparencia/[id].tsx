import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BADGE_ETAPA, classificarCotacoes, detalheCotacao, estadoEtapas, formatBRL, ROTULO_ETAPA } from '@gc/core';
import type { DemandaDemo } from '@gc/core/demo';
import { colors } from '@gc/ui';
import { Balao } from '@/components/icones';
import { Badge, Botao, Cabecalho, Campo, Card, Carregando, T, Titulo } from '@/components/ui';
import { carregarDemanda, enviarDuvida } from '@/lib/dados';
import { tratarErro, useDados } from '@/lib/useDados';

/** Morador · Orçamento público (Transparência) */
export default function TelaOrcamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [duvidaAberta, setDuvidaAberta] = useState(false);
  const [duvida, setDuvida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { dados, erro, recarregar } = useDados<{ d: DemandaDemo | null }>(async () => ({ d: await carregarDemanda(String(id)) }), [id]);
  if (!dados) return <Carregando erro={erro} onTentar={recarregar} />;
  const d = dados.d;
  if (d === null) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Cabecalho sobretitulo="Transparência" />
        <T className="px-[18px] text-muted">Demanda não encontrada.</T>
      </SafeAreaView>
    );
  }

  const etapas = estadoEtapas(d.etapa);
  const detalhes = new Map(d.etapas.map((e) => [e.etapa, e.detalhe]));
  const cotacoes = classificarCotacoes(d.cotacoes, d.teto);
  const badge = BADGE_ETAPA[d.etapa];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Cabecalho sobretitulo="Transparência" />
      <ScrollView contentContainerClassName="gap-3.5 px-[18px] pb-6 pt-1">
        <View>
          <Badge tom={badge.tom} inicio>
            {badge.texto}
          </Badge>
          <Titulo className="mb-0.5 mt-2 text-[22px] leading-[28px]">
            {d.titulo}
            {d.local ? ` · ${d.local}` : ''}
          </Titulo>
          {d.teto !== null ? <T className="text-[13px] text-muted">Teto aprovado em assembleia: {formatBRL(d.teto)}</T> : null}
        </View>

        <Card className="px-4 py-3.5">
          <Titulo className="mb-2.5 text-[16px]">Andamento</Titulo>
          <View accessibilityRole="list">
            {etapas.map((e, i) => {
              const ultima = i === etapas.length - 1;
              const detalhe = detalhes.get(e.etapa);
              const proxConcluida = etapas[i + 1]?.estado === 'done' || e.estado === 'done';
              return (
                <View key={e.etapa} className="flex-row gap-3" accessibilityLabel={`${ROTULO_ETAPA[e.etapa]}: ${e.estado === 'done' ? 'concluída' : e.estado === 'cur' ? 'em andamento' : 'pendente'}`}>
                  <View className="items-center">
                    <View
                      className={`h-[22px] w-[22px] items-center justify-center rounded-full ${
                        e.estado === 'done' ? 'bg-primary' : e.estado === 'cur' ? 'border-2 border-primary bg-surface' : 'border-2 border-line-input bg-surface'
                      }`}
                    >
                      <Text className={`font-inter-bold text-[11px] ${e.estado === 'done' ? 'text-white' : e.estado === 'cur' ? 'text-primary' : 'text-muted-strong'}`}>
                        {e.estado === 'done' ? '✓' : e.numero}
                      </Text>
                    </View>
                    {!ultima ? <View className={`my-0.5 min-h-[14px] w-0.5 flex-1 ${proxConcluida && e.estado === 'done' ? 'bg-primary' : 'bg-line-input'}`} /> : null}
                  </View>
                  <View className={ultima ? '' : 'pb-2.5'}>
                    <T className="font-inter-bold">{ROTULO_ETAPA[e.etapa]}</T>
                    {detalhe ? <T className="text-[12px] text-muted">{detalhe}</T> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        <Card className="overflow-hidden">
          <Titulo className="px-4 pb-1.5 pt-3.5 text-[16px]">Cotações recebidas</Titulo>
          {cotacoes.length === 0 ? <T className="border-t border-surface-2 px-4 py-2.5 text-muted">Aguardando cotações.</T> : null}
          {cotacoes.map((c) => (
            <View key={c.id} className="flex-row items-center justify-between gap-2.5 border-t border-surface-2 px-4 py-2.5">
              <View className="flex-1">
                <T className="font-inter-semibold">{c.fornecedor}</T>
                <T className="text-[12px] text-muted">{detalheCotacao(c)}</T>
              </View>
              <View className="items-end gap-1">
                <Titulo className="text-[16px]">{formatBRL(c.valor)}</Titulo>
                {c.selo === 'menor_preco' ? <Badge tom="ok">Menor preço</Badge> : null}
                {c.selo === 'acima_do_teto' ? <Badge tom="bad">Acima do teto</Badge> : null}
              </View>
            </View>
          ))}
        </Card>

        {duvidaAberta ? (
          <Card className="gap-2.5 p-4">
            <Campo rotulo="Sua dúvida" value={duvida} onChangeText={setDuvida} multiline style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }} />
            <Botao
              titulo={enviando ? 'Enviando…' : 'Enviar ao síndico'}
              desabilitado={enviando || duvida.trim().length < 5}
              onPress={async () => {
                setEnviando(true);
                try {
                  await enviarDuvida(d.id, duvida);
                  setDuvida('');
                  setDuvidaAberta(false);
                  Alert.alert('Dúvida enviada', 'O síndico responde por aqui.');
                } catch (e) {
                  tratarErro(e);
                } finally {
                  setEnviando(false);
                }
              }}
            />
          </Card>
        ) : (
          <Botao variante="contorno" titulo="Enviar dúvida ao síndico" icone={<Balao />} onPress={() => setDuvidaAberta(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
