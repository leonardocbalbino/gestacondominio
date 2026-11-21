/** Ícones de traço extraídos das telas de referência (docs/design). */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@gc/ui';

interface P {
  tamanho?: number;
  cor?: string;
  traco?: number;
}

const base = (p: P, padraoTraco = 1.8) => ({
  width: p.tamanho ?? 20,
  height: p.tamanho ?? 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: p.cor ?? colors.text,
  strokeWidth: p.traco ?? padraoTraco,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const Sino = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
  </Svg>
);
export const AddPessoa = (p: P) => (
  <Svg {...base(p)}>
    <Circle cx="9" cy="8" r="4" />
    <Path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" />
  </Svg>
);
export const Vaga = (p: P) => (
  <Svg {...base(p)}>
    <Rect x="3" y="3" width="18" height="18" rx="3" />
    <Path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
  </Svg>
);
export const Facial = (p: P) => (
  <Svg {...base(p)}>
    <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 10v1M15 10v1M9.5 15a3.5 3.5 0 0 0 5 0" />
  </Svg>
);
export const Moldura = (p: P) => (
  <Svg {...base(p, 1.9)}>
    <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
  </Svg>
);
export const Calendario = (p: P) => (
  <Svg {...base(p)}>
    <Rect x="3" y="5" width="18" height="16" rx="2" />
    <Path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);
export const Casa = (p: P) => (
  <Svg {...base(p, 1.9)}>
    <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const Documento = (p: P) => (
  <Svg {...base(p, 1.9)}>
    <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4" />
  </Svg>
);
export const Servicos = (p: P) => (
  <Svg {...base(p, 1.9)}>
    <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </Svg>
);
export const Pessoa = (p: P) => (
  <Svg {...base(p, 1.9)}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
export const Voltar = (p: P) => (
  <Svg {...base({ tamanho: 22, ...p }, 2)}>
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);
export const Cadeado = (p: P) => (
  <Svg {...base({ tamanho: 14, ...p }, 2)}>
    <Rect x="5" y="11" width="14" height="10" rx="2" />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
export const Balao = (p: P) => (
  <Svg {...base({ tamanho: 18, ...p }, 1.9)}>
    <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </Svg>
);
