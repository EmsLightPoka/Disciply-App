import { useState } from "react";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { createFamily, updateFamily } from "../../lib/api";
import type { Family } from "../../lib/types";
import { Avatar, Sheet, Top, frError, useToast } from "../../components/ui";
import { IPlus } from "../../components/Icons";

export default function Families() {
  const { families } = useSession();
  const { workers, active, workerName } = useScope();
  const toast = useToast();
  const [edit, setEdit] = useState<Family | "new" | null>(null);
  const [name, setName] = useState("");
  const [shepherdId, setShepherdId] = useState("");
  const [busy, setBusy] = useState(false);

  function open(f: Family | "new") { setEdit(f); setName(f === "new" ? "" : f.name); setShepherdId(f === "new" ? "" : f.shepherdId ?? ""); }
  async function save() {
    setBusy(true);
    try {
      if (edit === "new") await createFamily(name.trim(), shepherdId || null);
      else if (edit) await updateFamily(edit.id, { name: name.trim(), shepherdId: shepherdId || null });
      toast("Famille enregistrée"); setEdit(null);
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  const shepherds = workers.filter(w => w.role === "shepherd" && w.active && (edit === "new" || !edit || !w.familyId || w.familyId === edit.id));

  return (
    <div className="page">
      <Top title="Familles de disciples" sub={`${families.length} familles`} right={<button className="btn primary sm" style={{ flex: "none" }} onClick={() => open("new")}><IPlus />Nouvelle</button>} />
      <div className="list">{families.map(f => {
        const makers = workers.filter(w => w.role === "maker" && w.familyId === f.id).length;
        return (
          <button key={f.id} className="row" onClick={() => open(f)}><Avatar name={f.name} />
            <span className="main-col"><div className="name">{f.name}</div>
              <div className="meta">Berger : {f.shepherdId ? workerName(f.shepherdId) : "à définir"} · {makers} faiseur{makers > 1 ? "s" : ""} · {active.filter(s => s.familyId === f.id).length} âmes</div></span></button>);
      })}{families.length === 0 && <div className="empty">Crée la première famille, par exemple « Amour ».</div>}</div>
      <p className="small">Pour qu'un berger apparaisse ici, invite-le d'abord depuis Ouvriers avec le rôle Berger et sa famille.</p>
      {edit && (
        <Sheet title={edit === "new" ? "Nouvelle famille" : `Famille ${edit.name}`} onClose={() => setEdit(null)}>
          <div className="field"><label htmlFor="fn">Nom</label><input id="fn" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Amour" /></div>
          <div className="field"><label htmlFor="fs">Berger</label><select id="fs" value={shepherdId} onChange={e => setShepherdId(e.target.value)}>
            <option value="">À définir</option>{shepherds.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <button className="btn primary block" disabled={busy || !name.trim()} onClick={save}>Enregistrer</button>
        </Sheet>)}
    </div>
  );
}
