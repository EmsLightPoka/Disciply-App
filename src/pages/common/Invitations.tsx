import { useEffect, useState } from "react";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { markInvited } from "../../lib/api";
import { inviteImage, inviteText, shareImage, smsLink, sundayLabel, waLink } from "../../lib/invite";
import { today } from "../../lib/dates";
import { Avatar, Loading, Top, frError, useToast } from "../../components/ui";
import { IChat, IShare } from "../../components/Icons";

/** Invitations au culte : chaque samedi matin, le faiseur invite ses âmes par WhatsApp ou SMS, avec le billet en image. */
export default function Invitations() {
  const { profile, settings } = useSession();
  const { active, loading } = useScope();
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const me = profile!;
  useEffect(() => { let url = ""; inviteImage(settings).then(b => { url = URL.createObjectURL(b); setPreview(url); }); return () => { if (url) URL.revokeObjectURL(url); }; }, [settings]);
  if (loading) return <Loading />;
  const list = active.filter(s => (me.role === "maker" ? s.makerId === me.id : true) && s.phone);
  const blocked = active.filter(s => s.noContact).length;
  const toInvite = list.filter(s => !s.noContact);
  const thisWeek = (d?: string) => !!d && d >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const done = toInvite.filter(s => thisWeek(s.lastInvite)).length;
  const sent = (id: string) => markInvited(me.id, id).catch(e => toast(frError(e)));

  async function image(name?: string, id?: string) {
    const b = await inviteImage(settings, name?.split(" ")[0]);
    const r = await shareImage(b, name ? inviteText(settings, name, me.name) : "");
    if (r === "downloaded") toast("Image téléchargée : envoie-la sur WhatsApp.");
    if (id && r !== "cancelled") sent(id);
  }

  return (
    <div className="page">
      <Top title="Invitations au culte" sub={`Culte de ${sundayLabel()} · ${done} sur ${toInvite.length} invitées cette semaine`} />
      <div className="card" style={{ display: "grid", gap: 12, gridTemplateColumns: "120px 1fr", alignItems: "center" }}>
        {preview ? <img src={preview} alt="Billet d'invitation" style={{ width: 120, borderRadius: 12 }} /> : <div style={{ width: 120, height: 150 }} />}
        <div>
          <p style={{ margin: "0 0 8px" }}>Envoie l'invitation <b>le samedi matin</b>, pour que chacun puisse s'organiser.</p>
          <button className="btn ghost sm" onClick={() => image()}><IShare />Partager le billet</button>
        </div>
      </div>
      <div className="eyebrow">Mes âmes</div>
      <div className="list">{toInvite.map(s => (
        <div className="row" key={s.id} style={{ flexWrap: "wrap" }}>
          <Avatar name={s.name} />
          <span className="main-col"><div className="name">{s.name}</div><div className="meta">{thisWeek(s.lastInvite) ? <span className="chip ok">Invitée {s.lastInvite === today() ? "aujourd'hui" : "cette semaine"}</span> : "Pas encore invitée cette semaine"}</div></span>
          <div className="btnrow" style={{ margin: 0, flex: "1 1 100%", justifyContent: "flex-end" }}>
            <a className="btn ghost sm" href={waLink(s.phone, inviteText(settings, s.name, me.name))} target="_blank" rel="noreferrer" onClick={() => sent(s.id)}><IChat />WhatsApp</a>
            <a className="btn ghost sm" href={smsLink(s.phone, inviteText(settings, s.name, me.name))} onClick={() => sent(s.id)}>SMS</a>
            <button className="btn primary sm" onClick={() => image(s.name, s.id)}><IShare />Billet</button>
          </div>
        </div>))}
        {toInvite.length === 0 && <div className="empty">Aucune âme avec un numéro de téléphone.</div>}</div>
      {blocked > 0 && <p className="small">{blocked} âme{blocked > 1 ? "s ne souhaitent" : " ne souhaite"} plus être contactée{blocked > 1 ? "s" : ""} : elle{blocked > 1 ? "s" : ""} n'apparai{blocked > 1 ? "ssent" : "t"} pas ici.</p>}
      <p className="small">Le message et le billet se règlent dans Réglages, aux couleurs de l'église.</p>
    </div>
  );
}
