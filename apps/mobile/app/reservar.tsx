import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reservaSchema } from '@gc/core';
import { Botao, Cabecalho, Campo, Carregando, Rodape, Seletor, T } from '@/components/ui';
import { enviarReserva, listarAreas } from '@/lib/dados';
import { tratarErro, useDados } from '@/lib/useDados';

/** Morador · Reservar espaço (o banco impede dois pedidos no mesmo horário). */
export default function TelaReservar() {
  const { dados: areas, erro, recarregar } = useDados(listarAreas);
  const [areaId, setAreaId] = useState('');
  const [data, setData] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (areas?.[0] && !areaId) setAreaId(areas[0].id);
  }, [areas, areaId]);

  if (!areas) return <Carregando erro={erro} onTentar={recarregar} />;

  async function enviar() {
    const v = reservaSchema.safeParse({ areaId, data, inicio, fim });
    if (!v.success) {
      setErros(Object.fromEntries(v.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      await enviarReserva({ areaId, data, inicio, fim });
      Alert.alert('Pedido enviado', 'O síndico confirma a reserva e você é avisado no app.');
      router.back();
    } catch (e) {
      tratarErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Cabecalho titulo="Reservar espaço" />
        <ScrollView contentContainerClassName="gap-4 px-[18px] pb-[18px] pt-2" keyboardShouldPersistTaps="handled">
          <T className="text-muted">Escolha o espaço, o dia e o horário. O síndico confirma.</T>
          <Seletor rotulo="Espaço" valor={areaId} onChange={setAreaId} opcoes={areas.map((a) => ({ valor: a.id, rotulo: a.nome }))} />
          <Campo rotulo="Data" value={data} onChangeText={setData} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" erro={erros.data} />
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Campo rotulo="Início" value={inicio} onChangeText={setInicio} placeholder="18h" erro={erros.inicio} />
            </View>
            <View className="flex-1">
              <Campo rotulo="Fim" value={fim} onChangeText={setFim} placeholder="23h" erro={erros.fim} />
            </View>
          </View>
        </ScrollView>
        <Rodape>
          <Botao titulo={enviando ? 'Enviando…' : 'Pedir reserva'} onPress={enviar} desabilitado={enviando || !areaId} />
        </Rodape>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
