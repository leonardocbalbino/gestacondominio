import { epochSegundos, type AdaptadorAcesso, type ClienteHttp, type ConfigEquipamento, type UsuarioAcesso } from './tipos';

/**
 * Control iD (iDFace / iDAccess) — API REST ".fcgi" com sessão.
 * Referência: documentação pública da Control iD (login.fcgi, create_objects.fcgi, user_set_image.fcgi).
 * Status: implementado contra a especificação; validar em equipamento real antes de produção.
 */
export class ControlIdAdapter implements AdaptadorAcesso {
  readonly fabricante = 'controlid' as const;
  private sessao: string | null = null;

  constructor(
    private readonly http: ClienteHttp,
    private readonly cfg: ConfigEquipamento,
  ) {}

  private async sessaoAtiva(): Promise<string> {
    if (this.sessao) return this.sessao;
    const r = await this.http.request({
      method: 'POST',
      path: '/login.fcgi',
      json: { login: this.cfg.usuario, password: this.cfg.senha },
    });
    const s = (r.json as { session?: string } | undefined)?.session;
    if (r.status !== 200 || !s) throw new Error('Control iD: falha no login');
    this.sessao = s;
    return s;
  }

  async cadastrarUsuario(u: UsuarioAcesso) {
    const session = await this.sessaoAtiva();
    const r = await this.http.request({
      method: 'POST',
      path: '/create_objects.fcgi',
      query: { session },
      json: {
        object: 'users',
        values: [
          {
            registration: u.id,
            name: u.rotulo,
            begin_time: epochSegundos(u.inicio),
            end_time: epochSegundos(u.fim),
          },
        ],
      },
    });
    return { ok: r.status === 200 };
  }

  async enviarFace(usuarioId: string, imagemJpeg: Uint8Array) {
    const session = await this.sessaoAtiva();
    const r = await this.http.request({
      method: 'POST',
      path: '/user_set_image.fcgi',
      query: { session, user_id: usuarioId, match: '1', timestamp: String(Math.floor(Date.now() / 1000)) },
      body: imagemJpeg,
      contentType: 'application/octet-stream',
    });
    return { ok: r.status === 200 };
  }

  async removerUsuario(usuarioId: string) {
    const session = await this.sessaoAtiva();
    const r = await this.http.request({
      method: 'POST',
      path: '/destroy_objects.fcgi',
      query: { session },
      json: { object: 'users', where: { users: { registration: usuarioId } } },
    });
    return { ok: r.status === 200 };
  }

  async liberarPorta(porta = this.cfg.porta ?? 1) {
    const session = await this.sessaoAtiva();
    const r = await this.http.request({
      method: 'POST',
      path: '/execute_actions.fcgi',
      query: { session },
      json: { actions: [{ action: 'door', parameters: `door=${porta}` }] },
    });
    return { ok: r.status === 200 };
  }
}
