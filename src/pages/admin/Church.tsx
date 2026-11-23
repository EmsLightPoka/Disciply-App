import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_DOMAIN, DEMO_PASSWORD, isDemoCampus, seedDemo } from "../../lib/demo";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { currentSunday } from "../../lib/dates";
import { stepCount } from "../../lib/souls";
import { Loading, Top, frError } from "../../components/ui";
import { IChart, ICheck, IPlus, ISpark, IUsers } from "../../components/Icons";

export default function Church() {
  const { settings, families, campus, profile } = useSession();
  const { souls, active, attendance, streak, loading } = useScope();
  const seedable = !loading && profile?.role === "master" && isDemoCampus(campus?.name) && souls.length < 5 && !families.some(f => f.name === "Amour");
  // Une fois affichée, la carte reste là pendant le remplissage (les familles créées ne la font pas disparaître).
  const [sticky, setSticky] = useState(false);
  useEffect(() => { if (seedable) setSticky(true); }, [seedable]);
  const canSeed = seedable || sticky;
  if (loading) return <Loading />;
  const sunday = currentSunday();
  const total = souls.length || 1;
  const est = souls.filter(s => s.state === "established").length;
  const full = active.filter(s => stepCount(s, settings) === settings.steps.length).length;
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = souls.filter(s => s.arrivalDate.startsWith(month)).length;
  const fam = families.map(f => {
    const a = active.filter(s => s.familyId === f.id);
    const pointed = a.filter(s => attendance.get(s.id)?.get(sunday));
    const p = pointed.filter(s => attendance.get(s.id)!.get(sunday)!.present).length;
    return { ...f, n: a.length, pct: pointed.length ? Math.round((p / pointed.length) * 100) : null, alerts: a.filter(s => streak(s.id) >= settings.absenceThreshold).length, noMaker: a.filter(s => !s.makerId).length };
  });

  return (
    <div className="page wide">
      <Top title="Vue du campus" sub={campus?.name ? (/^campus/i.test(campus.name) ? campus.name : `Campus ${campus.name}`) : settings.churchName} right={families.length > 0 ? <Link to="/equipe?inviter=1" className="btn primary sm"><IPlus />Ouvrier</Link> : undefined} />
      {canSeed && <DemoSeed />}
      {families.length === 0 && !canSeed && <div className="hero" style={{ marginBottom: 16 }}>
        <span className="big">Pour commencer, crée les familles de disciples</span>
        <span className="small">Ensuite, ajoute les ouvriers : un berger pour chaque famille, puis les faiseurs de disciples (bouton « + Ouvrier »).</span>
        <Link to="/familles" className="btn grad" style={{ alignSelf: "flex-start" }}>Créer les familles</Link>
      </div>}
      <div className="grid2 grid4">
        <div className="stat"><div className="ic"><IUsers /></div><div className="v">{active.length}</div><div className="l">âmes en suivi</div></div>
        <div className="stat"><div className="ic"><ICheck /></div><div className="v">{Math.round(((active.length + est) / total) * 100)} %</div><div className="l">taux de maintien</div></div>
        <div className="stat"><div className="ic"><IChart /></div><div className="v">{Math.round(((est + full) / total) * 100)} %</div><div className="l">taux de réussite</div></div>
        <div className="stat"><div className="ic"><ISpark /></div><div className="v">{thisMonth}</div><div className="l">reçues ce mois-ci</div></div>
      </div>
      <p className="small">Maintien : âmes suivies ou affermies sur toutes les âmes reçues. Réussite : affermies ou ayant validé toutes les étapes.</p>

      <div className="eyebrow">Présence de ce dimanche par famille</div>
      <div className="list">{fam.map(f => (
        <div className="bar" key={f.id}><span className="lbl">{f.name}</span><span className="track"><b style={{ width: `${f.pct ?? 0}%` }} /></span><span className="pct">{f.pct === null ? "—" : `${f.pct} %`}</span></div>))}
        {fam.length === 0 && <div className="empty">Aucune famille.</div>}</div>

      <div className="eyebrow">Familles</div>
      <div className="tablewrap"><table className="t">
        <thead><tr><th>Famille</th><th>Âmes</th><th>Sans faiseur</th><th>En alerte</th></tr></thead>
        <tbody>{fam.map(f => <tr key={f.id}><td>{f.name}</td><td>{f.n}</td><td>{f.noMaker}</td><td>{f.alerts}</td></tr>)}</tbody>
      </table></div>
      <div className="btnrow"><Link className="btn ghost" to="/rapport-dimanche">Chiffres du dimanche</Link><Link className="btn ghost" to="/a-attribuer">Âmes à attribuer</Link></div>
    </div>
  );
}

/** Campus de démonstration vide : le super admin le remplit avec des données fictives, en un clic. */
function DemoSeed() {
  const { profile, campusId, campus, settings } = useSession();
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ accounts: string[]; souls: number } | null>(null);
  const [err, setErr] = useState("");
  const log = (m: string) => setLines(l => [...l.slice(-5), m]);
  async function run() {
    setBusy(true); setErr("");
    try { setDone(await seedDemo(profile!, campusId!, campus?.name ?? "Démo", settings, log)); }
    catch (e) { console.error(e); setErr(frError(e)); }
    finally { setBusy(false); }
  }
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="ico-g" style={{ marginBottom: 10 }}><ISpark /></div>
      <h2 style={{ fontSize: 18 }}>Remplir le campus de démonstration</h2>
      {!done ? <>
        <p className="small">Crée 6 familles, un berger et 3 faiseurs par famille (de vrais comptes de test), environ 200 âmes fictives avec leurs étapes, formations, difficultés et 8 dimanches de présences. Aucune personne réelle. Compter 1 à 2 minutes.</p>
        {err && <div className="error">{err}</div>}
        {busy && <div className="pre small" style={{ margin: "8px 0" }}>{lines.join("\n")}</div>}
        <button className="btn primary" disabled={busy} onClick={run}>{busy ? "Création en cours…" : "Remplir avec des données de démonstration"}</button>
      </> : <>
        <p className="small">C'est prêt : {done.souls} âmes et {done.accounts.length} comptes. Chaque compte se connecte avec le mot de passe <b>{DEMO_PASSWORD}</b>, par exemple :</p>
        <div className="pre small">{`berger.amour@${DEMO_DOMAIN}\nfaiseur1.amour@${DEMO_DOMAIN}\nfaiseur2.foi@${DEMO_DOMAIN}`}</div>
      </>}
    </div>
  );
}
