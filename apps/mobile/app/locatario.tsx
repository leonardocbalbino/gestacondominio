import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCheck, locacaoAluguelSchema, locacaoTemporadaSchema, ORIGENS_TEMPORADA } from '@gc/core';
import { demoLocatarioTemporada } from '@gc/core/demo';
import { colors } from '@gc/ui';
import { Moldura } from '@/components/icones';
import { Botao, Cabecalho, Campo, Rodape, Seletor, T } from '@/components/ui';
import { enviarLocacao } from '@/lib/dados';

type Tipo = 'temporada' | 'aluguel';

/** Morador · Cadastrar locatário (Temporada | Aluguel) */
export default function TelaLocatario() {
  const [tipo, setTipo] = useState<Tipo>('temporada');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  // Temporada (pré-preenchido com o exemplo do design no modo demonstração)
  const [responsavel, setResponsavel] = useState(demoLocatarioTemporada.responsavel);
  const [celularT, setCelularT] = useState(demoLocatarioTemporada.celular);
  const [checkin] = useState(demoLocatarioTemporada.checkin);
  const [checkout] = useState(demoLocatarioTemporada.checkout);
  const [hospedes, setHospedes] = useState('2');
  const [origem, setOrigem] = useState<string>('Airbnb');

  // Aluguel
  const [nome, setNome] = useState('');
  const [celularA, setCelularA] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [imobiliaria, setImobiliaria] = useState('');
  const [moradores, setMoradores] = useState('1');

  const temporada = tipo === 'temporada';

  async function enviar() {
    const v = temporada
      ? locacaoTemporadaSchema.safeParse({ tipo, responsavel, celular: celularT, checkin, checkout, hospedes: Number(hospedes), origem })
      : locacaoAluguelSchema.safeParse({ tipo, nome, celular: celularA, inicio, fim, imobiliaria: imobiliaria || undefined, moradores: Number(moradores) });
    if (!v.success) {
      setErros(Object.fromEntries(v.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      const r = await enviarLocacao(v.data as Parameters<typeof enviarLocacao>[0]);
      if (temporada && r.links[0]) {
        // O link é pessoal e de uso único: o morador compartilha direto com o hóspede.
        await Share.share({ message: `Cadastre seu acesso facial ao condomínio: ${r.links[0]}` }).catch(() => {});
      }
      Alert.alert('Enviado ao síndico', temporada ? 'Os hóspedes recebem o link para cadastrar a facial.' : 'Você será avisado quando o síndico aprovar.');
      router.back();
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Cabecalho titulo="Cadastrar locatário" />
        <ScrollView contentContainerClassName="gap-4 px-[18px] pb-[18px] pt-2" keyboardShouldPersistTaps="handled">
          <View accessibilityRole="tablist" accessibilityLabel="Tipo de locação" className="flex-row gap-1 rounded-xl bg-segment p-1">
            {(['temporada', 'aluguel'] as const).map((t) => {
              const on = tipo === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setTipo(t)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-[10px] ${on ? 'bg-surface' : ''}`}
                  style={on ? { shadowColor: colors.text, shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : undefined}
                >
                  <Text className={`font-inter-semibold text-[14px] ${on ? 'text-ink' : 'text-muted'}`}>{t === 'temporada' ? 'Temporada' : 'Aluguel'}</Text>
                </Pressable>
              );
            })}
          </View>

          {temporada ? (
            <>
              <Campo rotulo="Responsável pela reserva" value={responsavel} onChangeText={setResponsavel} erro={erros.responsavel} />
              <Campo rotulo="Celular (para o link facial)" value={celularT} onChangeText={setCelularT} keyboardType="phone-pad" erro={erros.celular} />
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Campo rotulo="Check-in" value={formatCheck(checkin)} editable={false} />
                </View>
                <View className="flex-1">
                  <Campo rotulo="Check-out" value={formatCheck(checkout)} editable={false} erro={erros.checkout} />
                </View>
              </View>
              <View className="flex-row gap-2.5">
                <Seletor rotulo="Hóspedes" valor={hospedes} onChange={setHospedes} opcoes={['1', '2', '3', '4'].map((n) => ({ valor: n, rotulo: n }))} />
                <Seletor rotulo="Origem" valor={origem} onChange={setOrigem} opcoes={ORIGENS_TEMPORADA.map((o) => ({ valor: o, rotulo: o }))} />
              </View>
              <View className="flex-row gap-3 rounded-xl border border-primary-soft-border bg-primary-tint p-3">
                <Moldura cor={colors.primary} />
                <T className="flex-1 text-[13px]">
                  Cada hóspede recebe um link para cadastrar a facial. O acesso vale só entre check-in e check-out, e a foto é apagada depois.
                </T>
              </View>
            </>
          ) : (
            <>
              <Campo rotulo="Nome do locatário" value={nome} onChangeText={setNome} placeholder="Nome completo" erro={erros.nome} />
              <Campo rotulo="Celular" value={celularA} onChangeText={setCelularA} placeholder="(00) 9 0000-0000" keyboardType="phone-pad" erro={erros.celular} />
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Campo rotulo="Início do contrato" value={inicio} onChangeText={setInicio} placeholder="dd/mm/aaaa" erro={erros.inicio} />
                </View>
                <View className="flex-1">
                  <Campo rotulo="Fim do contrato" value={fim} onChangeText={setFim} placeholder="dd/mm/aaaa" erro={erros.fim} />
                </View>
              </View>
              <Campo rotulo="Imobiliária (opcional)" value={imobiliaria} onChangeText={setImobiliaria} placeholder="Nome da imobiliária" />
              <Seletor
                rotulo="Moradores da unidade"
                valor={moradores}
                onChange={setMoradores}
                opcoes={[
                  { valor: '1', rotulo: '1 pessoa' },
                  { valor: '2', rotulo: '2 pessoas' },
                  { valor: '3', rotulo: '3 pessoas' },
                  { valor: '4', rotulo: '4 ou mais' },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => Alert.alert('Contrato', 'O PDF é enviado ao bucket privado e só o síndico e sua unidade podem abrir.')}
                className="min-h-12 flex-row items-center gap-3 rounded-xl border-[1.5px] border-dashed border-line-dashed bg-surface px-3.5 py-3"
              >
                <View className="h-9 w-9 items-center justify-center rounded-[9px] bg-danger-bg">
                  <Text className="font-inter-bold text-[11px] text-danger">PDF</Text>
                </View>
                <T className="font-inter-semibold">Anexar contrato de locação</T>
              </Pressable>
            </>
          )}
        </ScrollView>
        <Rodape>
          <Botao
            titulo={enviando ? 'Enviando…' : temporada ? 'Enviar para aprovação e links faciais' : 'Enviar para aprovação'}
            onPress={enviar}
            desabilitado={enviando}
          />
        </Rodape>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
