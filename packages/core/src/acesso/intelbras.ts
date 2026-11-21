import { paraBase64, type AdaptadorAcesso, type ClienteHttp, type ConfigEquipamento, type UsuarioAcesso } from './tipos';

/**
 * Intelbras (SS 3530/3540 MF Face) — API CGI (AccessUser.cgi / AccessFace.cgi) com digest.
 * Status: implementado contra a especificação CGI; validar em equipamento real antes de produção.
 */
export class IntelbrasAdapter implements AdaptadorAcesso {
  readonly fabricante = 'intelbras' as const;

  constructor(
    private readonly http: ClienteHttp,
    private readonly cfg: ConfigEquipamento,
  ) {}

  private fmt(d: Date | null, padrao: string): string {
    if (!d) return padrao;
    const l = new Date(d.getTime() - 3 * 3_600_000).toISOString();
    return `${l.slice(0, 10)} ${l.slice(11, 19)}`;
  }

  async cadastrarUsuario(u: UsuarioAcesso) {
    const r = await this.http.request({
      method: 'POST',
      path: '/cgi-bin/AccessUser.cgi',
      query: { action: 'insertMulti' },
      json: {
        UserList: [
          {
            UserID: u.id,
            UserName: u.rotulo,
            UserType: u.tipo === 'hospede' || u.tipo === 'prestador' ? 2 : 0,
            Authority: 2,
            Doors: [(this.cfg.porta ?? 1) - 1],
            TimeSections: [255],
            ValidFrom: this.fmt(u.inicio, '2000-01-01 00:00:00'),
            ValidTo: this.fmt(u.fim, '2037-12-31 23:59:59'),
          },
        ],
      },
    });
    return { ok: r.status === 200 };
  }

  async enviarFace(usuarioId: string, imagemJpeg: Uint8Array) {
    const r = await this.http.request({
      method: 'POST',
      path: '/cgi-bin/AccessFace.cgi',
      query: { action: 'insertMulti' },
      json: { FaceList: [{ UserID: usuarioId, PhotoData: [paraBase64(imagemJpeg)] }] },
    });
    return { ok: r.status === 200 };
  }

  async removerUsuario(usuarioId: string) {
    await this.http.request({
      method: 'GET',
      path: '/cgi-bin/AccessFace.cgi',
      query: { action: 'removeMulti', 'UserIDList[0]': usuarioId },
    });
    const r = await this.http.request({
      method: 'GET',
      path: '/cgi-bin/AccessUser.cgi',
      query: { action: 'removeMulti', 'UserIDList[0]': usuarioId },
    });
    return { ok: r.status === 200 };
  }

  async liberarPorta(porta = this.cfg.porta ?? 1) {
    const r = await this.http.request({
      method: 'GET',
      path: '/cgi-bin/accessControl.cgi',
      query: { action: 'openDoor', channel: String(porta), UserID: '0', Type: 'Remote' },
    });
    return { ok: r.status === 200 };
  }
}
