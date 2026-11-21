import { describe, expect, it } from 'vitest';
import { criarAdaptador, MockAdapter, type ClienteHttp } from '../src/acesso';

function clienteGravador() {
  const chamadas: Parameters<ClienteHttp['request']>[0][] = [];
  const http: ClienteHttp = {
    async request(req) {
      chamadas.push(req);
      if (req.path === '/login.fcgi') return { status: 200, json: { session: 'abc' } };
      return { status: 200, json: {} };
    },
  };
  return { http, chamadas };
}

const cfg = { baseUrl: 'http://10.0.0.5', usuario: 'admin', senha: 'segredo', porta: 1 };
const hospede = {
  id: 'p-123',
  rotulo: 'Marina 304-A',
  tipo: 'hospede' as const,
  inicio: new Date('2026-11-22T17:00:00Z'),
  fim: new Date('2026-11-25T14:00:00Z'),
};

describe('adaptadores de controle de acesso', () => {
  it('Control iD: faz login e cadastra com janela de validade', async () => {
    const { http, chamadas } = clienteGravador();
    const a = criarAdaptador('controlid', http, cfg);
    await a.cadastrarUsuario(hospede);
    expect(chamadas[0]!.path).toBe('/login.fcgi');
    expect(chamadas[1]!.query).toEqual({ session: 'abc' });
    const v = (chamadas[1]!.json as { values: { begin_time: number; end_time: number }[] }).values[0]!;
    expect(v.begin_time).toBe(Math.floor(hospede.inicio.getTime() / 1000));
    expect(v.end_time).toBe(Math.floor(hospede.fim.getTime() / 1000));
  });

  it('Hikvision: hóspede vira visitor com validade em horário de Brasília', async () => {
    const { http, chamadas } = clienteGravador();
    await criarAdaptador('hikvision', http, cfg).cadastrarUsuario(hospede);
    const u = (chamadas[0]!.json as { UserInfo: { userType: string; Valid: { beginTime: string; endTime: string } } }).UserInfo;
    expect(u.userType).toBe('visitor');
    expect(u.Valid.beginTime).toBe('2026-11-22T14:00:00');
    expect(u.Valid.endTime).toBe('2026-11-25T11:00:00');
  });

  it('Intelbras: remoção apaga face e usuário', async () => {
    const { http, chamadas } = clienteGravador();
    await criarAdaptador('intelbras', http, cfg).removerUsuario('p-123');
    expect(chamadas.map((c) => c.path)).toEqual(['/cgi-bin/AccessFace.cgi', '/cgi-bin/AccessUser.cgi']);
  });

  it('Mock: exige cadastro antes da face', async () => {
    const m = new MockAdapter();
    expect((await m.enviarFace('x')).ok).toBe(false);
    await m.cadastrarUsuario(hospede);
    expect((await m.enviarFace('p-123')).ok).toBe(true);
    await m.removerUsuario('p-123');
    expect(m.usuarios.size).toBe(0);
  });
});
