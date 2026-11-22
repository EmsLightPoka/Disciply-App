import { useState } from "react";
import { useSession } from "../lib/session";
import { useScope } from "../lib/scope";
import { assignSoul } from "../lib/api";
import type { Soul } from "../lib/types";
import { Sheet, frError, useToast } from "./ui";

/** Attribution d'une âme : par défaut, seuls les faiseurs du même sexe que l'âme sont proposés. */
export default function AssignSheet({ soul, onClose, onDone }: { soul: Soul; onClose: () => void; onDone?: () => void }) {
  const { profile, familyName } = useSession();
  const { workers, active } = useScope();
  const toast = useToast();
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadOf = (id: string) => active.filter(s => s.makerId === id).length;
  const pool = workers.filter(w => (w.role === "maker" || w.role === "assistant") && w.active && w.familyId === soul.familyId);
  const same = pool.filter(w => w.gender === soul.gender);
  const shown = (all ? pool : same).sort((a, b) => loadOf(a.id) - loadOf(b.id));
  const genderWord = soul.gender === "F" ? "faiseuses" : "faiseurs hommes";

  async function pick(id: string | null) {
    setBusy(true);
    try {
      const w = pool.find(x => x.id === id) ?? null;
      await assignSoul(profile!, soul, w);
      toast(w ? `${soul.name} attribuée à ${w.name}. ${w.name.split(" ")[0]} a été prévenu(e).` : "Attribution retirée");
      onDone?.(); onClose();
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }

  return (
    <Sheet title={`Qui suivra ${soul.name.split(" ")[0]} ?`} onClose={onClose}>
      <p className="small" style={{ marginTop: 0 }}>{soul.gender === "F" ? "Femme" : "Homme"} · famille {familyName(soul.familyId)}. {all ? "Tous les faiseurs de la famille." : `Seules les ${genderWord} sont proposé(e)s.`} Le chiffre indique combien d'âmes chacun suit déjà.</p>
      <div className="opts">
        {shown.map(w => <button key={w.id} disabled={busy} onClick={() => pick(w.id)}>{w.name}{w.gender !== soul.gender && <span className="chip warn">{w.gender === "F" ? "Femme" : w.gender === "H" ? "Homme" : "Sexe non indiqué"}</span>}<span className="small">{loadOf(w.id)} âmes{w.id === soul.makerId ? " · actuel" : ""}</span></button>)}
        {shown.length === 0 && <p className="small">Aucun{soul.gender === "F" ? "e faiseuse" : " faiseur homme"} dans cette famille. Invite-en un depuis Équipe, ou affiche tous les faiseurs.</p>}
        {!all && pool.length > same.length && <button onClick={() => setAll(true)} style={{ color: "var(--accent)" }}>Afficher tous les faiseurs</button>}
        {soul.makerId && <button disabled={busy} onClick={() => pick(null)}>Retirer l'attribution</button>}
      </div>
    </Sheet>
  );
}
