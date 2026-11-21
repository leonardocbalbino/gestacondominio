import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cessaoVagaSchema } from '@gc/core';
import { colors } from '@gc/ui';
import { Cadeado } from '@/components/icones';
import { Botao, Cabecalho, Caixa, Campo, Rodape, Rotulo, Seletor, T } from '@/components/ui';
import { enviarCessao, opcoesCessao } from '@/lib/dados';
import { tratarErro } from '@/lib/useDados';

type Opcoes = Awaited<ReturnType<typeof opcoesCessao>>;

/** Morador · Ceder vaga */
export default function TelaCederVaga() {
  const [op, setOp] = useState<Opcoes | null>(null);
  const [vagaId, setVagaId] = useState('');
  const [destino, setDestino] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [semTermino, setSemTermino] = useState(false);
  const [placa, setPlaca] = useState('');
  const [valor, setValor] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    opcoesCessao()
      .then((o) => {
        setOp(o);
        setVagaId(o.vagas[0]?.id ?? '');
        setDestino(o.unidadesDestino[0]?.id ?? '');
        setInicio(o.sugestao.inicio);
        setFim(o.sugestao.fim);
        setPlaca(o.sugestao.placa);
      })
      .catch(tratarErro);
  }, []);

  const destinoRotulo = op?.unidadesDestino.find((u) => u.id === destino)?.rotulo.split(' · ')[0] ?? 'unidade';

  async function enviar() {
    const valorNum = valor ? Number(valor.replace(/[^\d,]/g, '').replace(',', '.')) : undefined;
    const v = cessaoVagaSchema.safeParse({ vagaId, unidadeCessionariaId: destino, inicio, fim, semTermino, placa, valorMensal: valorNum });
    if (!v.success) {
      setErros(Object.fromEntries(v.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      await enviarCessao(v.data);
      Alert.alert('Pedido enviado', `A ${destinoRotulo} confirma no app e depois o síndico aprova.`);
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
        <Cabecalho titulo="Ceder minha vaga" />
        <ScrollView contentContainerClassName="gap-4 px-[18px] pb-[18px] pt-2" keyboardShouldPersistTaps="handled">
          <T className="text-muted">Empreste ou alugue sua vaga para outra unidade. O síndico aprova e a portaria é avisada.</T>

          <View className="gap-1.5">
            <Rotulo>Qual vaga</Rotulo>
            {op?.vagas.map((v) => {
              const sel = v.id === vagaId;
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  onPress={() => setVagaId(v.id)}
                  className={`flex-row items-center gap-3 rounded-[14px] px-3.5 py-3 ${sel ? 'border-2 border-primary bg-primary-tint' : 'border border-line-input bg-surface'}`}
                >
                  <View className={`h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${sel ? 'border-primary' : 'border-line-input'}`}>
                    {sel ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
                  </View>
                  <View className="flex-1">
                    <T className="font-inter-semibold text-[15px]">
                      Vaga {v.numero} · {v.local}
                    </T>
                    <T className="text-muted">{v.tipo}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Seletor
            rotulo="Unidade que vai usar"
            valor={destino}
            onChange={setDestino}
            opcoes={(op?.unidadesDestino ?? []).map((u) => ({ valor: u.id, rotulo: u.rotulo }))}
          />

          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Campo rotulo="Início" value={inicio} onChangeText={setInicio} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" erro={erros.inicio} />
            </View>
            <View className="flex-1">
              <Campo
                rotulo="Fim"
                value={semTermino ? '' : fim}
                onChangeText={setFim}
                placeholder={semTermino ? '—' : 'dd/mm/aaaa'}
                editable={!semTermino}
                keyboardType="numbers-and-punctuation"
                erro={erros.fim}
              />
            </View>
          </View>
          <Caixa marcada={semTermino} onChange={setSemTermino} rotulo="Sem data de término">
            <T>Sem data de término</T>
          </Caixa>

          <Campo
            rotulo="Placa do veículo"
            value={placa}
            onChangeText={(t) => setPlaca(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
            style={{ letterSpacing: 0.9 }}
            erro={erros.placa}
          />

          <Campo
            rotulo="Valor combinado (opcional)"
            value={valor}
            onChangeText={setValor}
            placeholder="R$ 0,00 por mês"
            keyboardType="decimal-pad"
            dica={
              <View className="flex-row items-center gap-1.5">
                <Cadeado cor={colors.muted} />
                <T className="text-[12px] text-muted">Visível só para você, a {destinoRotulo} e o síndico</T>
              </View>
            }
          />
        </ScrollView>
        <Rodape>
          <T className="text-center text-[12px] text-muted">A {destinoRotulo} confirma no app antes de ir ao síndico</T>
          <Botao titulo={enviando ? 'Enviando…' : 'Enviar pedido'} onPress={enviar} desabilitado={enviando || !op} />
        </Rodape>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
