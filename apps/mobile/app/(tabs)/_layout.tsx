import { router, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@gc/ui';
import { Casa, Documento, Pessoa, Servicos } from '@/components/icones';

const ABAS = [
  { nome: 'index', href: '/', rotulo: 'Início', Icone: Casa },
  { nome: 'transparencia', href: '/transparencia', rotulo: 'Transparência', Icone: Documento },
  { nome: 'servicos', href: '/servicos', rotulo: 'Serviços', Icone: Servicos },
  { nome: 'perfil', href: '/perfil', rotulo: 'Perfil', Icone: Pessoa },
] as const;

/** Barra inferior de 4 abas, como no design: branca, borda superior, ícone 22 + rótulo 11. */
export default function LayoutAbas() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={({ state }) => (
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Navegação"
          className="flex-row border-t border-line bg-surface px-2 pt-1"
          style={{ paddingBottom: Math.max(insets.bottom, 18) }}
        >
          {state.routes.map((r, i) => {
            const aba = ABAS.find((a) => a.nome === r.name);
            if (!aba) return null;
            const ativa = state.index === i;
            const cor = ativa ? colors.primary : colors.muted;
            return (
              <Pressable
                key={r.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                accessibilityLabel={aba.rotulo}
                onPress={() => router.navigate(aba.href)}
                className="min-h-11 flex-1 items-center justify-center gap-[3px] py-2"
              >
                <aba.Icone tamanho={22} cor={cor} />
                <Text style={{ color: cor }} className="font-inter-semibold text-[11px]">
                  {aba.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {ABAS.map((a) => (
        <Tabs.Screen key={a.nome} name={a.nome} options={{ title: a.rotulo }} />
      ))}
    </Tabs>
  );
}
