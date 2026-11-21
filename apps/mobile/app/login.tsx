import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Botao, Campo, T, Titulo } from '@/components/ui';
import { entrar } from '@/lib/api';
import { registrarDispositivo } from '@/lib/push';

export default function TelaLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      registrarDispositivo().catch(() => {});
      router.replace('/');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center gap-6 px-5">
        <View className="flex-row items-center gap-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-[11px] bg-primary-dark">
            <T className="font-heading-bold text-white">GC</T>
          </View>
          <View>
            <Titulo className="text-[18px]">GestaCondomínio</Titulo>
            <T className="text-[12px] text-muted">App do morador</T>
          </View>
        </View>
        <View className="gap-4 rounded-2xl border border-line bg-surface p-5">
          <Titulo className="text-[24px]">Entrar</Titulo>
          <Campo rotulo="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password" onSubmitEditing={enviar} />
          {erro ? (
            <T accessibilityRole="alert" className="font-inter-semibold text-[13px] text-danger">
              {erro}
            </T>
          ) : null}
          <Botao titulo={enviando ? 'Entrando…' : 'Entrar'} onPress={enviar} desabilitado={enviando || !email || !senha} />
        </View>
        <T className="text-center text-[12px] text-muted">Acesso criado pelo convite do seu condomínio. Seus dados são tratados conforme a LGPD.</T>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
