import { useState } from "react";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { isDemoCampus } from "../../lib/demo";
import { DEMO_IMPACT, createImpact, deleteImpact, updateImpact, type ImpactData } from "../../lib/impact";
import { IMPACT_LABEL, type ImpactFamily } from "../../lib/types";
import { telHref } from "../../lib/souls";
import { Avatar, Sheet, Top, frError, useToast } from "../../components/ui";
import { IPhone, IPlus } from "../../components/Icons";

/** Familles d'impact du campus : FI (jeudi) et FI jeunes (mardi), avec quartiers, pilote et hôte. */
export default function ImpactFamilies() {
  const { campusId, campus } = useSession();
  const { impact, active } = useScope();
  const toast = useToast();
  const [edit, setEdit] = useState<ImpactFamily | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const count = (id: string) => active.filter(s => s.impactFamilyId === id).length;

  async function demo() {
    setBusy(true);
    try { for (const d of DEMO_IMPACT) await createImpact({ ...d, campusId: campusId! }); toast("Exemples ajoutés"); }
    catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  const group = (k: "FI" | "FIJ") => impact.filter(f => f.kind === k);

  return (
    <div className="page">
      <Top title="Familles d'impact" sub={`${impact.length} familles · ${active.filter(s => s.impactFamilyId).length} âmes rattachées`} right={<button className="btn primary sm" style={{ flex: "none" }} onClick={() => setEdit("new")}><IPlus />Nouvelle</button>} />
      {impact.length === 0 && <div className="hero" style={{ marginBottom: 16 }}>
        <span className="big">Aucune famille d'impact pour l'instant</span>
        <span className="small">Ajoute chaque famille d'impact avec ses quartiers, son pilote et son hôte. L'app proposera ensuite à chaque âme la famille d'impact la plus proche de chez elle.</span>
        {isDemoCampus(campus?.name) && <button className="btn grad" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={demo}>Ajouter des exemples de démonstration</button>}
      </div>}
      {(["FI", "FIJ"] as const).map(k => group(k).length > 0 && <div key={k}>
        <div className="eyebrow">{k === "FI" ? "Familles d'impact · le jeudi" : "Familles d'impact jeunes (moins de 25 ans) · le mardi"}</div>
        <div className="list">{group(k).map(f => (
          <div className="row" key={f.id} style={{ alignItems: "flex-start" }}>
            <Avatar name={f.name} />
            <button className="main-col" style={{ textAlign: "left", background: "none", border: 0, padding: 0, color: "inherit" }} onClick={() => setEdit(f)}>
              <div className="name">{f.name}</div>
              <div className="meta">{f.quartiers.join(", ") || "Quartiers à préciser"} · {count(f.id)} âme{count(f.id) > 1 ? "s" : ""}</div>
              <div className="meta">Pilote : {f.pilotName || "—"}{f.pilotPhone ? ` · ${f.pilotPhone}` : ""}</div>
              <div className="meta">Hôte : {f.hostName || "—"}{f.hostPhone ? ` · ${f.hostPhone}` : ""}</div>
            </button>
            {f.pilotPhone && <a className="iconbtn call" href={telHref(f.pilotPhone)} aria-label={`Appeler le pilote de ${f.name}`}><IPhone /></a>}
          </div>))}</div>
      </div>)}
      <p className="small">Bientôt : importer la liste des familles d'impact depuis un fichier.</p>
      {edit && <ImpactSheet f={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ImpactSheet({ f, onClose }: { f: ImpactFamily | null; onClose: () => void }) {
  const { campusId } = useSession();
  const toast = useToast();
  const [d, setD] = useState({ name: f?.name ?? "", kind: f?.kind ?? "FI", quartiers: f?.quartiers.join(", ") ?? "", address: f?.address ?? "", pilotName: f?.pilotName ?? "", pilotPhone: f?.pilotPhone ?? "", hostName: f?.hostName ?? "", hostPhone: f?.hostPhone ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof d, v: string) => setD({ ...d, [k]: v });
  async function save() {
    setBusy(true);
    const data: ImpactData = { campusId: campusId!, name: d.name.trim(), kind: d.kind as "FI" | "FIJ", quartiers: d.quartiers.split(/[,;\n]/).map(x => x.trim()).filter(Boolean), address: d.address.trim(), pilotName: d.pilotName.trim(), pilotPhone: d.pilotPhone.trim(), hostName: d.hostName.trim(), hostPhone: d.hostPhone.trim() };
    try { if (f) await updateImpact(f.id, data); else await createImpact(data); toast("Famille d'impact enregistrée"); onClose(); }
    catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title={f ? f.name : "Nouvelle famille d'impact"} onClose={onClose}>
      <div className="field"><label htmlFor="fi-name">Nom</label><input id="fi-name" value={d.name} onChange={e => set("name", e.target.value)} placeholder="Ex. FI Bastos" /></div>
      <div className="field"><span className="label">Type</span><div className="toggle">
        <button type="button" aria-pressed={d.kind === "FI"} onClick={() => set("kind", "FI")}>FI · jeudi</button>
        <button type="button" aria-pressed={d.kind === "FIJ"} onClick={() => set("kind", "FIJ")}>FI jeunes · mardi</button></div></div>
      <div className="field"><label htmlFor="fi-q">Quartiers couverts</label><input id="fi-q" value={d.quartiers} onChange={e => set("quartiers", e.target.value)} placeholder="Ex. Bastos, Etoudi" /><span className="hint">Sépare par des virgules. Sert à proposer la FI la plus proche de chaque âme.</span></div>
      <div className="field"><label htmlFor="fi-a">Adresse ou repère (facultatif)</label><input id="fi-a" value={d.address} onChange={e => set("address", e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="fi-pn">Pilote</label><input id="fi-pn" value={d.pilotName} onChange={e => set("pilotName", e.target.value)} /></div>
        <div className="field"><label htmlFor="fi-pp">Téléphone du pilote</label><input id="fi-pp" type="tel" value={d.pilotPhone} onChange={e => set("pilotPhone", e.target.value)} /></div>
        <div className="field"><label htmlFor="fi-hn">Hôte (qui reçoit chez lui)</label><input id="fi-hn" value={d.hostName} onChange={e => set("hostName", e.target.value)} /></div>
        <div className="field"><label htmlFor="fi-hp">Téléphone de l'hôte</label><input id="fi-hp" type="tel" value={d.hostPhone} onChange={e => set("hostPhone", e.target.value)} /></div>
      </div>
      <button className="btn primary block" disabled={busy || !d.name.trim()} onClick={save}>Enregistrer</button>
      {f && <div className="btnrow"><button className="btn danger" disabled={busy} onClick={() => deleteImpact(f.id).then(() => { toast("Famille d'impact supprimée"); onClose(); }).catch(e => toast(frError(e)))}>Supprimer</button></div>}
      <p className="small">{IMPACT_LABEL[d.kind as "FI" | "FIJ"]}</p>
    </Sheet>);
}
