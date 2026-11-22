import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { createSoul } from "../../lib/api";
import { Top, frError, useToast } from "../../components/ui";
import SoulForm, { type SoulFields } from "./SoulForm";

/** Saisie rapide en fin de culte : l'essentiel, puis la suivante. */
export default function NewSoul() {
  const { profile, families } = useSession();
  const { workers } = useScope();
  const toast = useToast();
  const nav = useNavigate();
  const me = profile!;
  const [famChoice, setFamilyId] = useState("");
  const familyId = famChoice || me.familyId || families[0]?.id || "";
  const [makerId, setMakerId] = useState<string>(me.role === "maker" ? me.id : "");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const makers = workers.filter(w => w.role === "maker" && w.active && w.familyId === familyId);

  async function save(d: SoulFields) {
    if (!familyId) return toast("Choisis d'abord une famille.");
    setBusy(true);
    try {
      await Promise.race([
        createSoul(me.id, { ...d, familyId, makerId: me.role === "maker" ? me.id : makerId || null }),
        new Promise(r => setTimeout(r, 1500)) // hors ligne : la fiche part plus tard, on n'attend pas
      ]);
      setCount(c => c + 1); setFormKey(k => k + 1);
      toast(`${d.name} enregistrée. Saisis la suivante.`);
    } catch (e) { toast(frError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="page">
      <Top title="Nouvelle âme" back sub={count ? `${count} enregistrée${count > 1 ? "s" : ""} pendant cette saisie` : "Juste l'essentiel. Le reste se complète plus tard."} />
      {me.role === "admin" && (
        <div className="field"><label htmlFor="fam">Famille de disciples</label>
          <select id="fam" value={familyId} onChange={e => { setFamilyId(e.target.value); setMakerId(""); }}>
            {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>)}
      {me.role !== "maker" && (
        <div className="field"><label htmlFor="mk">Faiseur de disciples</label>
          <select id="mk" value={makerId} onChange={e => setMakerId(e.target.value)}>
            <option value="">À affecter plus tard</option>{makers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>)}
      <SoulForm key={formKey} short submitLabel="Enregistrer et saisir la suivante" busy={busy} onSubmit={save} />
      <div className="btnrow"><button className="btn ghost" onClick={() => nav(-1)}>Terminer</button></div>
    </div>
  );
}
