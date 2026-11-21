import { join } from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Monorepo: rastreia dependências a partir da raiz (necessário para o build standalone).
  outputFileTracingRoot: join(__dirname, '../../'),
  transpilePackages: ['@gc/core', '@gc/ui', '@gc/db'],
  serverExternalPackages: ['pg', 'nodemailer'],
  // Build de produção em Docker (Linux); no Windows o standalone exige symlinks.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // A câmera só é liberada na página do link facial.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
      // Links faciais são pessoais: nunca indexar nem guardar em cache compartilhado.
      { source: '/f/:token*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
