import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type PressableProps, type TextInputProps, type TextProps } from 'react-native';
import { colors, type BadgeTone } from '@gc/ui';
import { Voltar } from './icones';

/** Texto base: Inter 14/1.45, cor do token. */
export function T({ className = '', ...p }: TextProps & { className?: string }) {
  return <Text className={`font-inter text-[14px] leading-[20px] text-ink ${className}`} {...p} />;
}

export function Titulo({ className = '', ...p }: TextProps & { className?: string }) {
  return <Text accessibilityRole="header" className={`font-heading tracking-[-0.2px] text-ink ${className}`} {...p} />;
}

const TONS: Record<BadgeTone, { bg: string; fg: string }> = {
  ok: { bg: 'bg-success-bg', fg: 'text-success' },
  warn: { bg: 'bg-warning-bg', fg: 'text-warning' },
  info: { bg: 'bg-info-bg', fg: 'text-info' },
  bad: { bg: 'bg-danger-bg', fg: 'text-danger' },
  neu: { bg: 'bg-neutral-bg', fg: 'text-ink-2' },
};

export function Badge({ tom, children, inicio }: { tom: BadgeTone; children: ReactNode; inicio?: boolean }) {
  const t = TONS[tom];
  return (
    <View className={`${inicio ? 'self-start' : ''} rounded-full px-2.5 py-[3px] ${t.bg}`}>
      <Text className={`font-inter-semibold text-[12px] ${t.fg}`} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <View className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</View>;
}

/** Cabeçalho das telas internas: voltar (44×44) + título. */
export function Cabecalho({ titulo, sobretitulo }: { titulo?: string; sobretitulo?: string }) {
  return (
    <View className="flex-row items-center gap-2 px-2.5 pb-1.5 pt-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        className="h-11 w-11 items-center justify-center"
      >
        <Voltar />
      </Pressable>
      {titulo ? <Titulo className="text-[20px]">{titulo}</Titulo> : null}
      {sobretitulo ? <T className="font-inter-semibold text-muted">{sobretitulo}</T> : null}
    </View>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <T className="font-inter-semibold text-[13px]">{children}</T>;
}

export function Campo({ rotulo, erro, dica, ...p }: TextInputProps & { rotulo: string; erro?: string; dica?: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Rotulo>{rotulo}</Rotulo>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={colors.mutedStrong}
        className={`min-h-12 rounded-xl border bg-surface px-3.5 font-inter text-[15px] text-ink ${erro ? 'border-danger' : 'border-line-input'}`}
        {...p}
      />
      {erro ? <T className="text-[12px] text-danger">{erro}</T> : dica}
    </View>
  );
}

/** Seletor simples (ciclo de opções) — substitui o <select> do design sem depender de libs nativas. */
export function Seletor({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: { valor: string; rotulo: string }[]; valor: string; onChange: (v: string) => void }) {
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0];
  return (
    <View className="flex-1 gap-1.5">
      <Rotulo>{rotulo}</Rotulo>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={`${rotulo}: ${atual?.rotulo}`}
        accessibilityHint="Toque para trocar a opção"
        onPress={() => {
          const i = opcoes.findIndex((o) => o.valor === valor);
          onChange(opcoes[(i + 1) % opcoes.length]!.valor);
        }}
        className="min-h-12 flex-row items-center justify-between rounded-xl border border-line-input bg-surface px-3.5"
      >
        <T className="text-[15px]">{atual?.rotulo}</T>
        <T className="text-muted">▾</T>
      </Pressable>
    </View>
  );
}

export function Botao({ titulo, variante = 'primario', icone, desabilitado, ...p }: PressableProps & { titulo: string; variante?: 'primario' | 'contorno'; icone?: ReactNode; desabilitado?: boolean }) {
  const pri = variante === 'primario';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desabilitado}
      className={`flex-row items-center justify-center gap-2 rounded-[14px] ${pri ? 'min-h-[52px] bg-primary active:bg-primary-hover' : 'min-h-12 border border-line-input bg-surface'} ${desabilitado ? 'opacity-50' : ''}`}
      {...p}
    >
      {icone}
      <Text className={`font-inter-semibold text-[15px] ${pri ? 'text-white' : 'text-ink'}`}>{titulo}</Text>
    </Pressable>
  );
}

/** Estado de carregamento/erro de uma tela inteira. */
export function Carregando({ erro, onTentar }: { erro?: string | null; onTentar?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-bg px-6">
      {erro ? (
        <>
          <T className="text-center text-muted">{erro}</T>
          {onTentar ? <Botao variante="contorno" titulo="Tentar de novo" onPress={onTentar} /> : null}
        </>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
}

/** Caixa de seleção 20×20 com área de toque ≥ 44px. */
export function Caixa({ marcada, onChange, children, rotulo }: { marcada: boolean; onChange: (v: boolean) => void; children: ReactNode; rotulo: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={rotulo}
      onPress={() => onChange(!marcada)}
      className="min-h-11 flex-row items-center gap-2.5"
    >
      <View className={`h-5 w-5 items-center justify-center rounded-[4px] border-2 ${marcada ? 'border-primary bg-primary' : 'border-line-input bg-surface'}`}>
        {marcada ? <Text className="font-inter-bold text-[12px] leading-[14px] text-white">✓</Text> : null}
      </View>
      {children}
    </Pressable>
  );
}

/** Rodapé fixo com a ação principal (padrão das telas de formulário). */
export function Rodape({ children }: { children: ReactNode }) {
  return <View className="gap-2 border-t border-line bg-surface px-[18px] pb-6 pt-3">{children}</View>;
}
