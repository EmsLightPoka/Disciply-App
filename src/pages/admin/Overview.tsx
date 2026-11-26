import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { isGlobal, type Family, type Settings, type Soul } from "../../lib/types";
import { Loading, Top } from "../../components/ui";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Vue d'ensemble : toute l'église d'un coup d'œil, du campus à chaque famille. Uniquement des totaux, aucun nom. */
export default function Overview() {
  const { profile, settings, families, campus, campuses } = useSession();
  const { souls, loading } = useScope();
  const global = isGlobal(profile?.role);
  const [scope, setScope] = useState<"campus" | "all">("campus");
  const [all, setAll] = useState<{ souls: Soul[]; families: Family[] } | null>(null);
  useEffect(() => {
    if (scope !== "all" || all) return;
    Promise.all([getDocs(collection(db, "souls")), getDocs(collection(db, "families"))]).then(([s, f]) =>
      setAll({ souls: s.docs.map(d => ({ id: d.id, ...d.data() }) as Soul), families: f.docs.map(d => ({ id: d.id, ...d.data() }) as Family) }));
  }, [scope, all]);
  if (loading) return <Loading />;
  const list = scope === "all" ? all?.souls : souls;
  const fams = scope === "all" ? all?.families ?? [] : families;

  return (
    <div className="page wide">
      <Top title="Vue d'ensemble" sub="Totaux seulement : aucun nom n'apparaît ici." />
      {global && <div className="toggle" style={{ marginBottom: 12 }}>
        <button aria-pressed={scope === "campus"} onClick={() => setScope("campus")}>{campus?.name ?? "Ce campus"}</button>
        <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>Toute l'église</button></div>}
      {!list ? <Loading /> : <>
        <Funnel souls={list} settings={settings} />
        {scope === "all" && <>
          <div className="eyebrow">Par campus</div>
          <Table rows={campuses.map(c => ({ name: c.name, souls: list.filter(s => s.campusId === c.id) }))} />
        </>}
        <div className="eyebrow">Par famille{scope === "all" ? " (tous les campus)" : ""}</div>
        <Table rows={fams.map(f => ({ name: scope === "all" ? `${f.name} · ${campuses.find(c => c.id === f.campusId)?.name ?? ""}` : f.name, souls: list.filter(s => s.familyId === f.id) }))} />
        <Exits souls={list} />
      </>}
    </div>
  );
}

/** À quelle étape perd-on des âmes ? */
function Funnel({ souls, settings }: { souls: Soul[]; settings: Settings }) {
  const total = souls.length;
  const rows = [{ l: "Âmes reçues", n: total }, ...settings.steps.map(st => ({ l: st.label, n: souls.filter(s => s.steps?.[st.id]).length })),
    { l: "Disciples affermis", n: souls.filter(s => s.state === "established").length }, { l: "Devenues faiseurs", n: souls.filter(s => s.becameMaker).length }];
  let worst = 1, worstDrop = -1;
  for (let i = 1; i < rows.length - 2; i++) { const d = rows[i - 1].n - rows[i].n; if (d > worstDrop) { worstDrop = d; worst = i; } }
  return <>
    <div className="eyebrow">Parcours de croissance</div>
    <div className="card funnel">{rows.map((r, i) => (
      <div key={r.l} className={"fr" + (i === worst && worstDrop > 0 ? " worst" : "")}>
        <span className="fl">{r.l}</span>
        <span className="track"><b style={{ width: `${pct(r.n, total)}%` }} /></span>
        <span className="fn"><b>{r.n}</b> · {pct(r.n, total)} %</span>
        {i > 0 && i < rows.length - 2 && rows[i - 1].n > r.n && <span className="fd">−{rows[i - 1].n - r.n}</span>}
      </div>))}
      {worstDrop > 0 && <p className="small" style={{ margin: "10px 0 0" }}>C'est avant l'étape <b>« {rows[worst].l} »</b> qu'on perd le plus d'âmes ({worstDrop}). C'est là qu'il faut agir en priorité.</p>}
    </div>
  </>;
}

function Table({ rows }: { rows: { name: string; souls: Soul[] }[] }) {
  return <div className="tablewrap"><table className="t">
    <thead><tr><th></th><th>Reçues</th><th>En suivi</th><th>Affermies</th><th>Sorties</th><th>Maintien</th></tr></thead>
    <tbody>{rows.map(r => { const a = r.souls.filter(s => s.state === "active").length, e = r.souls.filter(s => s.state === "established").length, x = r.souls.filter(s => s.state === "exited").length;
      return <tr key={r.name}><td>{r.name}</td><td>{r.souls.length}</td><td>{a}</td><td>{e}</td><td>{x}</td><td>{pct(a + e, r.souls.length)} %</td></tr>; })}</tbody>
  </table></div>;
}

function Exits({ souls }: { souls: Soul[] }) {
  const out = souls.filter(s => s.state === "exited");
  if (!out.length) return null;
  const by = new Map<string, number>(); out.forEach(s => by.set(s.exitReason ?? "Autre", (by.get(s.exitReason ?? "Autre") ?? 0) + 1));
  return <>
    <div className="eyebrow">Pourquoi des âmes sortent du suivi</div>
    <div className="list">{[...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => <div className="bar" key={k}><span className="lbl">{k}</span><span className="track"><b style={{ width: `${pct(n, out.length)}%` }} /></span><span className="pct">{n}</span></div>)}</div>
  </>;
}
