import { useEffect, useState } from "react";
import { useSession } from "../../lib/session";
import { saveSettings } from "../../lib/api";
import type { Settings as S, Step } from "../../lib/types";
import { Top, frError, useToast } from "../../components/ui";

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "etape";

export default function Settings() {
  const { settings } = useSession();
  const toast = useToast();
  const [s, setS] = useState<S>(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(settings), [settings]);
  const lines = (k: "absenceReasons" | "exitReasons" | "services") => s[k].join("\n");
  const setLines = (k: "absenceReasons" | "exitReasons" | "services", v: string) => setS({ ...s, [k]: v.split("\n").map(x => x.trimStart()).filter((x, i, a) => x || i === a.length - 1) });
  const setStep = (i: number, p: Partial<Step>) => setS({ ...s, steps: s.steps.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const move = (i: number, d: number) => { const st = [...s.steps]; const [x] = st.splice(i, 1); st.splice(i + d, 0, x); setS({ ...s, steps: st }); };

  async function save() {
    setBusy(true);
    const clean = (a: string[]) => a.map(x => x.trim()).filter(Boolean);
    try {
      await saveSettings({ ...s, absenceReasons: clean(s.absenceReasons), exitReasons: clean(s.exitReasons), services: clean(s.services), steps: s.steps.filter(x => x.label.trim()) });
      toast("Réglages enregistrés");
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <Top title="Réglages" />
      <div className="card">
        <div className="field"><label htmlFor="cn">Nom de l'église</label><input id="cn" value={s.churchName} onChange={e => setS({ ...s, churchName: e.target.value })} /></div>
        <div className="field"><label htmlFor="th">Alerte après combien de dimanches d'absence de suite ?</label><input id="th" type="number" min={1} max={10} value={s.absenceThreshold} onChange={e => setS({ ...s, absenceThreshold: Math.max(1, Number(e.target.value) || 3) })} /></div>
      </div>

      <div className="eyebrow">Étapes de croissance, dans l'ordre</div>
      <div className="list">{s.steps.map((st, i) => (
        <div key={st.id} className="note" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="av" style={{ background: "var(--hero)", color: "var(--hero-fg)" }}>{i + 1}</span>
            <input aria-label="Nom de l'étape" style={{ flex: 1, minHeight: 44, border: "1px solid var(--line)", borderRadius: 10, padding: "0 12px", background: "var(--surface)" }} value={st.label} onChange={e => setStep(i, { label: e.target.value })} />
            <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
            <button className="btn ghost sm" disabled={i === s.steps.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
          </div>
          <input aria-label="Description" placeholder="Description" style={{ minHeight: 40, border: "1px solid var(--line)", borderRadius: 10, padding: "0 12px", background: "var(--surface)" }} value={st.description} onChange={e => setStep(i, { description: e.target.value })} />
          <input aria-label="Détail demandé" placeholder="Détail demandé à la validation (facultatif), ex. Département" style={{ minHeight: 40, border: "1px solid var(--line)", borderRadius: 10, padding: "0 12px", background: "var(--surface)" }} value={st.detailLabel ?? ""} onChange={e => setStep(i, { detailLabel: e.target.value || undefined })} />
        </div>))}</div>
      <div className="btnrow"><button className="btn ghost" onClick={() => { const label = "Nouvelle étape"; setS({ ...s, steps: [...s.steps, { id: `${slug(label)}-${Date.now().toString(36)}`, label, description: "" }] }); }}>Ajouter une étape</button></div>
      <p className="small">Renommer ou déplacer une étape garde les validations déjà faites. Vider le nom d'une étape la retire.</p>

      <div className="eyebrow">Listes</div>
      <div className="card">
        <div className="field"><label htmlFor="ar">Motifs d'absence (un par ligne)</label><textarea id="ar" value={lines("absenceReasons")} onChange={e => setLines("absenceReasons", e.target.value)} /></div>
        <div className="field"><label htmlFor="er">Motifs de sortie (un par ligne)</label><textarea id="er" value={lines("exitReasons")} onChange={e => setLines("exitReasons", e.target.value)} /></div>
        <div className="field"><label htmlFor="sv">Cultes (un par ligne)</label><textarea id="sv" value={lines("services")} onChange={e => setLines("services", e.target.value)} /></div>
      </div>
      <div className="btnrow"><button className="btn primary" disabled={busy} onClick={save}>Enregistrer les réglages</button></div>
    </div>
  );
}
