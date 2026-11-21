import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRAZO_RESPOSTA_TITULAR_DIAS } from '@gc/core';
import { Badge, Botao, Card, T, Titulo } from '@/components/ui';
import { MODO_DEMO, sair } from '@/lib/api';
import { exportarMeusDados, pedidoTitular, revogarFacial } from '@/lib/dados';
import { tratarErro } from '@/lib/useDados';

/** Perfil · privacidade: direitos do titular (LGPD art. 18) direto no app. */
export default function TelaPerfil() {
  const [ocupado, setOcupado] = useState(false);

  async function exportar() {
    setOcupado(true);
    try {
      await Share.share({ message: JSON.stringify(await exportarMeusDados(), null, 2), title: 'Meus dados' });
    } catch (e) {
      tratarErro(e);
    } finally {
      setOcupado(false);
    }
  }

  function revogar() {
    Alert.alert('Revogar consentimento da facial?', 'Sua foto será apagada e o leitor deixa de liberar sua entrada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revogar',
        style: 'destructive',
        onPress: () =>
          revogarFacial()
            .then(() => Alert.alert('Feito', 'A exclusão da sua foto foi agendada para os próximos minutos.'))
            .catch(tratarErro),
      },
    ]);
  }

  function pedir(tipo: 'correcao' | 'exclusao') {
    pedidoTitular(tipo)
      .then(() => Alert.alert('Pedido registrado', `O condomínio tem até ${PRAZO_RESPOSTA_TITULAR_DIAS} dias para responder.`))
      .catch(tratarErro);
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
          <Botao variante="contorno" titulo="Revogar e apagar minha facial" onPress={revogar} />
        </Card>
        <Card className="gap-2.5 p-4">
          <Titulo className="text-[16px]">Meus dados (LGPD)</Titulo>
          <T className="text-[13px] text-muted">O condomínio é o controlador dos seus dados; a plataforma é operadora.</T>
          <Botao variante="contorno" titulo={ocupado ? 'Gerando…' : 'Exportar meus dados'} onPress={exportar} desabilitado={ocupado} />
          <Botao variante="contorno" titulo="Corrigir meus dados" onPress={() => pedir('correcao')} />
          <Botao variante="contorno" titulo="Pedir exclusão da conta" onPress={() => pedir('exclusao')} />
        </Card>
        {!MODO_DEMO ? (
          <Botao
            variante="contorno"
            titulo="Sair"
            onPress={async () => {
              await sair();
              router.replace('/login');
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
