import { ControlIdAdapter } from './controlid';
import { HikvisionAdapter } from './hikvision';
import { IntelbrasAdapter } from './intelbras';
import type { AdaptadorAcesso, ClienteHttp, ConfigEquipamento, UsuarioAcesso } from './tipos';

export * from './tipos';
export { ControlIdAdapter, HikvisionAdapter, IntelbrasAdapter };

/** Adaptador em memória para desenvolvimento e testes (nenhum hardware necessário). */
export class MockAdapter implements AdaptadorAcesso {
  readonly fabricante = 'mock' as const;
  readonly usuarios = new Map<string, UsuarioAcesso & { temFace: boolean }>();
  readonly aberturas: number[] = [];

  async cadastrarUsuario(u: UsuarioAcesso) {
    this.usuarios.set(u.id, { ...u, temFace: false });
    return { ok: true };
  }
  async enviarFace(id: string) {
    const u = this.usuarios.get(id);
    if (!u) return { ok: false, detalhe: 'usuário não cadastrado' };
    u.temFace = true;
    return { ok: true };
  }
  async removerUsuario(id: string) {
    this.usuarios.delete(id);
    return { ok: true };
  }
  async liberarPorta(porta = 1) {
    this.aberturas.push(porta);
    return { ok: true };
  }
}

export type Fabricante = AdaptadorAcesso['fabricante'];

export function criarAdaptador(fabricante: Fabricante, http: ClienteHttp, cfg: ConfigEquipamento): AdaptadorAcesso {
  switch (fabricante) {
    case 'controlid':
      return new ControlIdAdapter(http, cfg);
    case 'hikvision':
      return new HikvisionAdapter(http, cfg);
    case 'intelbras':
      return new IntelbrasAdapter(http, cfg);
    case 'mock':
      return new MockAdapter();
  }
}
