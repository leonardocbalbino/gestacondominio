import { useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRAZO_RESPOSTA_TITULAR_DIAS } from '@gc/core';
import { Badge, Botao, Card, T, Titulo } from '@/components/ui';
import { MODO_DEMO, supabase } from '@/lib/supabase';

/** Perfil · privacidade: direitos do titular (LGPD art. 18) direto no app. */
export default function TelaPerfil() {
  const [ocupado, setOcupado] = useState(false);

  async function exportar() {
    setOcupado(true);
    try {
      const dados = MODO_DEMO || !supabase ? { aviso: 'Modo demonstração' } : (await supabase.rpc('exportar_meus_dados')).data;
      await Share.share({ message: JSON.stringify(dados, null, 2), title: 'Meus dados' });
    } finally {
      setOcupado(false);
    }
  }

  function revogarBiometria() {
    Alert.alert('Revogar consentimento da facial?', 'Sua foto será apagada e o leitor deixa de liberar sua entrada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revogar',
        style: 'destructive',
        onPress: async () => {
          if (!MODO_DEMO && supabase) {
            const { data } = await supabase.from('consentimentos').select('id').eq('finalidade', 'biometria_acesso').is('revogado_em', null).limit(1).maybeSingle();
            if (data) await supabase.rpc('revogar_consentimento', { p_consentimento: data.id });
          }
          Alert.alert('Feito', 'A exclusão da sua foto foi agendada para os próximos minutos.');
        },
      },
    ]);
  }

  async function pedir(tipo: 'correcao' | 'exclusao') {
    if (!MODO_DEMO && supabase) {
      const { data: u } = await supabase.auth.getUser();
      const { data: p } = await supabase.from('pessoas').select('id, condominio_id').eq('user_id', u.user!.id).limit(1).single();
      await supabase.from('pedidos_titular').insert({ condominio_id: p!.condominio_id, pessoa_id: p!.id, user_id: u.user!.id, tipo });
    }
    Alert.alert('Pedido registrado', `O condomínio tem até ${PRAZO_RESPOSTA_TITULAR_DIAS} dias para responder.`);
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="gap-3.5 px-[18px] py-5">
        <Titulo className="text-[24px]">Perfil</Titulo>
        <Card className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <Titulo className="text-[16px]">Acesso facial</Titulo>
            <Badge tom="ok">Ativo</Badge>
          </View>
          <T className="text-[13px] text-muted">
            Usado só para liberar sua entrada. A foto fica criptografada e nunca é mostrada à portaria nem ao suporte.
          </T>
          <Botao variante="contorno" titulo="Revogar e apagar minha facial" onPress={revogarBiometria} />
        </Card>
        <Card className="gap-2.5 p-4">
          <Titulo className="text-[16px]">Meus dados (LGPD)</Titulo>
          <T className="text-[13px] text-muted">O condomínio é o controlador dos seus dados; a plataforma é operadora.</T>
          <Botao variante="contorno" titulo={ocupado ? 'Gerando…' : 'Exportar meus dados'} onPress={exportar} desabilitado={ocupado} />
          <Botao variante="contorno" titulo="Corrigir meus dados" onPress={() => pedir('correcao')} />
          <Botao variante="contorno" titulo="Pedir exclusão da conta" onPress={() => pedir('exclusao')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
