import { Link } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { currentSunday } from "../../lib/dates";
import { stepCount } from "../../lib/souls";
import { Loading, Top } from "../../components/ui";
import { IChart, ICheck, ISpark, IUsers } from "../../components/Icons";

export default function Church() {
  const { settings, families, campus } = useSession();
  const { souls, active, attendance, streak, loading } = useScope();
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
      <Top title="Vue du campus" sub={campus?.name ? `Campus ${campus.name}` : settings.churchName} />
      {families.length === 0 && <div className="hero" style={{ marginBottom: 16 }}>
        <span className="big">Pour commencer, crée les familles de disciples</span>
        <span className="small">Ensuite, invite un berger pour chaque famille. Les bergers inviteront leurs faiseurs.</span>
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
