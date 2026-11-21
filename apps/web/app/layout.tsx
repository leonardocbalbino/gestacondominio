import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const space = Space_Grotesk({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-space-grotesk', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'GestaCondomínio', template: '%s · GestaCondomínio' },
  description: 'Gestão de condomínios com transparência e privacidade (LGPD).',
};

export const viewport: Viewport = { themeColor: '#0F766E', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${space.variable}`}>
      <body>{children}</body>
    </html>
  );
}
