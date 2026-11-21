import { isoLocalBrasilia, type AdaptadorAcesso, type ClienteHttp, type ConfigEquipamento, type UsuarioAcesso } from './tipos';

/**
 * Hikvision (DS-K1T / MinMoe) — ISAPI com autenticação digest (feita pelo ClienteHttp).
 * Status: implementado contra a especificação ISAPI; validar em equipamento real antes de produção.
 */
export class HikvisionAdapter implements AdaptadorAcesso {
  readonly fabricante = 'hikvision' as const;

  constructor(
    private readonly http: ClienteHttp,
    private readonly cfg: ConfigEquipamento,
  ) {}

  async cadastrarUsuario(u: UsuarioAcesso) {
    const valido = u.inicio || u.fim;
    const r = await this.http.request({
      method: 'PUT',
      path: '/ISAPI/AccessControl/UserInfo/SetUp',
      query: { format: 'json' },
      json: {
        UserInfo: {
          employeeNo: u.id,
          name: u.rotulo,
          userType: u.tipo === 'hospede' || u.tipo === 'prestador' ? 'visitor' : 'normal',
          Valid: {
            enable: Boolean(valido),
            beginTime: isoLocalBrasilia(u.inicio ?? new Date('2000-01-01T00:00:00-03:00')),
            endTime: isoLocalBrasilia(u.fim ?? new Date('2037-12-31T23:59:59-03:00')),
          },
          doorRight: String(this.cfg.porta ?? 1),
          RightPlan: [{ doorNo: this.cfg.porta ?? 1, planTemplateNo: '1' }],
        },
      },
    });
    return { ok: r.status === 200 };
  }

  async enviarFace(usuarioId: string, imagemJpeg: Uint8Array) {
    // A ISAPI aceita multipart com FaceDataRecord (JSON) + imagem; o ClienteHttp monta o multipart.
    const r = await this.http.request({
      method: 'PUT',
      path: '/ISAPI/Intelligent/FDLib/FDSetUp',
      query: { format: 'json' },
      json: { faceLibType: 'blackFD', FDID: '1', FPID: usuarioId },
      body: imagemJpeg,
      contentType: 'multipart/form-data',
    });
    return { ok: r.status === 200 };
  }

  async removerUsuario(usuarioId: string) {
    const r = await this.http.request({
      method: 'PUT',
      path: '/ISAPI/AccessControl/UserInfo/Delete',
      query: { format: 'json' },
      json: { UserInfoDelCond: { EmployeeNoList: [{ employeeNo: usuarioId }] } },
    });
    return { ok: r.status === 200 };
  }

  async liberarPorta(porta = this.cfg.porta ?? 1) {
    const r = await this.http.request({
      method: 'PUT',
      path: `/ISAPI/AccessControl/RemoteControl/door/${porta}`,
      contentType: 'application/xml',
      body: new TextEncoder().encode('<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>'),
    });
    return { ok: r.status === 200 };
  }
}
