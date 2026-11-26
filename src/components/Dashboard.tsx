import { shareText } from "./ui";

export interface DashData { souls: number; present: number; absent: number; pending: number; notPointed: number; withFi?: number; answered?: number; contacted?: number; reports?: number; makers?: number; newSouls?: number }

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Le rapport en tableau de bord : pourcentages et chiffres côte à côte. */
export default function Dashboard({ d }: { d: DashData }) {
  const pointed = d.present + d.absent + d.pending;
  const seg = [
    { k: "P", label: "Présentes", n: d.present, c: "var(--ok)" },
    { k: "A", label: "Absentes", n: d.absent, c: "var(--bad)" },
    { k: "E", label: "En attente", n: d.pending, c: "var(--warn)" },
    { k: "–", label: "Non pointées", n: d.notPointed, c: "var(--line)" }
  ];
  const gauges = [
    { l: "Présence du dimanche", v: pct(d.present, pointed), sub: `${d.present} sur ${pointed} pointées` },
    ...(d.withFi != null ? [{ l: "En famille d'impact", v: pct(d.withFi, d.souls), sub: `${d.withFi} sur ${d.souls} âmes` }] : []),
    ...(d.contacted != null ? [{ l: "Ont répondu aux appels", v: pct(d.answered ?? 0, d.contacted), sub: `${d.answered ?? 0} sur ${d.contacted} contactées` }] : []),
    ...(d.makers ? [{ l: "Rapports reçus", v: pct(d.reports ?? 0, d.makers), sub: `${d.reports ?? 0} sur ${d.makers} faiseurs` }] : [])
  ];
  return (
    <div className="dash">
      <div className="card">
        <div className="dash-h"><b>{d.souls}</b> âmes en suivi{d.newSouls ? ` · ${d.newSouls} nouvelles` : ""}</div>
        <div className="stack" role="img" aria-label={seg.map(s => `${s.label} ${s.n}`).join(", ")}>
          {seg.filter(s => s.n).map(s => <span key={s.k} style={{ flex: s.n, background: s.c }} title={`${s.label} : ${s.n}`} />)}
        </div>
        <div className="legend">{seg.map(s => <span key={s.k}><i style={{ background: s.c }} />{s.label} <b>{s.n}</b> · {pct(s.n, d.souls)} %</span>)}</div>
      </div>
      <div className="grid2">{gauges.map(g => (
        <div className="card gauge" key={g.l}>
          <div className="ring" style={{ background: `conic-gradient(var(--accent2, #FE9B02) ${g.v * 3.6}deg, var(--accent-soft) 0)` }}><span>{g.v} %</span></div>
          <div><div className="gl">{g.l}</div><div className="small" style={{ margin: 0 }}>{g.sub}</div></div>
        </div>))}</div>
    </div>
  );
}

/** Envoyer le rapport : WhatsApp (au pasteur ou dans le groupe de la famille) ou PDF. */
export function ReportShare({ title, text, toast }: { title: string; text: string; toast: (m: string) => void }) {
  return (
    <div className="btnrow">
      <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      <button className="btn ghost" onClick={() => printReport(title, text)}>PDF</button>
      <button className="btn ghost" onClick={() => shareText(text, toast)}>Partager</button>
    </div>
  );
}

/** Ouvre une page propre du rapport et lance l'impression : choisir « Enregistrer en PDF ». */
export function printReport(title: string, text: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const body = esc(text).replace(/\*(.+?)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>body{font-family:Inter,Arial,sans-serif;color:#2A0140;margin:32px;line-height:1.55;font-size:13px}
  header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #FE9B02;padding-bottom:12px;margin-bottom:18px}
  header img{height:42px}h1{font-size:18px;margin:0;color:#3F025D}b{color:#3F025D}footer{margin-top:24px;font-size:11px;color:#7a6a86}</style></head>
  <body><header><img src="${location.origin}/logo-color.png" alt=""><h1>${esc(title)}</h1></header><div>${body}</div>
  <footer>Généré par Disciply le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</footer>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
}
