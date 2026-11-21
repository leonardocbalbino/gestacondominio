import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDiaMes, ocorrenciaSchema } from '@gc/core';
import { Badge, Botao, Cabecalho, Campo, Card, Carregando, T, Titulo } from '@/components/ui';
import { abrirOcorrencia, listarOcorrencias, type Ocorrencia } from '@/lib/dados';
import { tratarErro, useDados } from '@/lib/useDados';

const STATUS = {
  aberta: { texto: 'Aberta', tom: 'info' },
  em_andamento: { texto: 'Em andamento', tom: 'warn' },
  resolvida: { texto: 'Resolvida', tom: 'ok' },
} as const;

export default function TelaOcorrencias() {
  const { dados, erro, recarregar } = useDados<Ocorrencia[]>(listarOcorrencias);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erroTitulo, setErroTitulo] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  if (!dados) return <Carregando erro={erro} onTentar={recarregar} />;

  async function enviar() {
    const v = ocorrenciaSchema.safeParse({ titulo, descricao: descricao || undefined });
    if (!v.success) return setErroTitulo(v.error.issues[0]?.message);
    setErroTitulo(undefined);
    setEnviando(true);
    try {
      await abrirOcorrencia(v.data.titulo, v.data.descricao);
      setTitulo('');
      setDescricao('');
      await recarregar();
    } catch (e) {
      tratarErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Cabecalho titulo="Ocorrências" />
        <ScrollView contentContainerClassName="gap-3.5 px-[18px] pb-6 pt-2" keyboardShouldPersistTaps="handled">
          <Card className="gap-3 p-4">
            <Titulo className="text-[16px]">Registrar um problema</Titulo>
            <Campo rotulo="O que aconteceu" value={titulo} onChangeText={setTitulo} placeholder="Ex.: vazamento na garagem" erro={erroTitulo} />
            <Campo rotulo="Detalhes (opcional)" value={descricao} onChangeText={setDescricao} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />
            <Botao titulo={enviando ? 'Enviando…' : 'Enviar ao síndico'} onPress={enviar} desabilitado={enviando} />
          </Card>
          <Card className="overflow-hidden">
            {dados.length === 0 ? <T className="px-4 py-4 text-muted">Você ainda não registrou ocorrências.</T> : null}
            {dados.map((o, i) => (
              <View key={o.id} className={`flex-row items-center justify-between gap-2.5 px-4 py-3 ${i ? 'border-t border-surface-2' : ''}`}>
                <View className="flex-1">
                  <T className="font-inter-semibold">{o.titulo}</T>
                  <T className="text-[12px] text-muted">Aberta em {formatDiaMes(new Date(o.criadaEm))}</T>
                </View>
                <Badge tom={STATUS[o.status as keyof typeof STATUS]?.tom ?? 'neu'}>{STATUS[o.status as keyof typeof STATUS]?.texto ?? o.status}</Badge>
              </View>
            ))}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
