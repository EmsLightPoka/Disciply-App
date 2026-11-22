import { useState } from "react";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { assignSoul } from "../../lib/api";
import { shortDate } from "../../lib/dates";
import { STATUS_LABEL } from "../../lib/souls";
import type { Soul } from "../../lib/types";
import { Avatar, Sheet, Top, frError, useToast } from "../../components/ui";

export default function ToAssign() {
  const { profile, familyName } = useSession();
  const { active, workers } = useScope();
  const toast = useToast();
  const [pick, setPick] = useState<Soul | null>(null);
  const list = active.filter(s => !s.makerId);
  const loadOf = (id: string) => active.filter(s => s.makerId === id).length;

  async function assign(s: Soul, id: string, name: string) {
    setPick(null);
    try { await assignSoul(profile!.id, s.id, id, name); toast(`${s.name} confiée à ${name}`); } catch (e) { toast(frError(e)); }
  }
  return (
    <div className="page">
      <Top title="À affecter" sub="Âmes reçues sans faiseur. Choisis qui les suivra." />
      {list.length ? <div className="list">{list.map(s => (
        <div className="row" key={s.id}><Avatar name={s.name} />
          <span className="main-col"><div className="name">{s.name}</div><div className="meta">{STATUS_LABEL[s.status]} · {s.neighborhood || "quartier inconnu"} · {shortDate(s.arrivalDate)}{profile!.role === "admin" ? ` · ${familyName(s.familyId)}` : ""}</div></span>
          <button className="btn primary sm" style={{ flex: "none" }} onClick={() => setPick(s)}>Affecter</button></div>))}</div>
        : <div className="card empty">Toutes les âmes ont un faiseur.</div>}
      {pick && (
        <Sheet title={`Qui suivra ${pick.name.split(" ")[0]} ?`} onClose={() => setPick(null)}>
          <p className="small" style={{ marginTop: 0 }}>Faiseurs de la famille {familyName(pick.familyId)}, avec le nombre d'âmes qu'ils suivent déjà.</p>
          <div className="opts">{workers.filter(w => w.role === "maker" && w.active && w.familyId === pick.familyId).sort((a, b) => loadOf(a.id) - loadOf(b.id)).map(w => (
            <button key={w.id} onClick={() => assign(pick, w.id, w.name)}>{w.name}<span className="small">{loadOf(w.id)} âmes</span></button>))}</div>
        </Sheet>)}
    </div>
  );
}
