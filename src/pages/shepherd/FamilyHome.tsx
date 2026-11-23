import { Link } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { currentSunday } from "../../lib/dates";
import { Avatar, Loading, Top } from "../../components/ui";
import { FamilyMakers, usePublishFamilyStats } from "../../components/FamilyView";
import { IAlert, ICheck, IInbox, IPlus, IUsers } from "../../components/Icons";

export default function FamilyHome() {
  const { profile, myFamily, settings } = useSession();
  const { active, attendance, streak, workers, workerName, loading } = useScope();
  usePublishFamilyStats(myFamily ? [myFamily.id] : []);
  if (loading) return <Loading />;
  const sunday = currentSunday();
  const pointed = active.filter(s => attendance.get(s.id)?.get(sunday));
  const present = pointed.filter(s => attendance.get(s.id)!.get(sunday)!.present).length;
  const unassigned = active.filter(s => !s.makerId);
  const alerts = active.filter(s => streak(s.id) >= settings.absenceThreshold);
  const makers = workers.filter(w => w.role === "maker" && w.active);
  const notPointed = makers.filter(m => active.some(s => s.makerId === m.id && !attendance.get(s.id)?.get(sunday)));

  return (
    <div className="page">
      <Top title={myFamily ? `Famille ${myFamily.name}` : "Ma famille"} sub={`Bonjour ${profile!.name.split(" ")[0]}`} />
      <div className="grid2 grid4">
        <Link to="/ames" className="stat" style={{ textDecoration: "none", color: "inherit" }}><div className="ic"><IUsers /></div><div className="v">{active.length}</div><div className="l">âmes en suivi</div></Link>
        <div className="stat"><div className="ic"><ICheck /></div><div className="v">{pointed.length ? `${Math.round((present / pointed.length) * 100)} %` : "—"}</div><div className="l">présence ce dimanche</div></div>
        <Link to="/a-attribuer" className="stat" style={{ textDecoration: "none", color: "inherit" }}><div className="ic"><IInbox /></div><div className="v">{unassigned.length}</div><div className="l">à attribuer</div></Link>
        <div className="stat"><div className="ic bad"><IAlert /></div><div className="v">{alerts.length}</div><div className="l">en alerte</div></div>
      </div>

      {unassigned.length > 0 && <div className="hero" style={{ marginTop: 16 }}>
        <span className="big">{unassigned.length} âme{unassigned.length > 1 ? "s" : ""} sans faiseur</span>
        <Link to="/a-attribuer" className="btn grad" style={{ alignSelf: "flex-start" }}>Attribuer maintenant</Link>
      </div>}

      <div className="eyebrow">Faiseurs et âmes suivies <Link to="/equipe">Inviter</Link></div>
      {notPointed.length > 0 && <p className="small" style={{ margin: "0 2px 8px" }}>Pointage pas terminé : {notPointed.map(m => m.name).join(", ")}</p>}
      {myFamily ? <FamilyMakers familyId={myFamily.id} /> : <div className="empty">Aucune famille.</div>}
      {makers.length === 0 && <p className="small">Invite les faiseurs de ta famille depuis Équipe.</p>}

      {alerts.length > 0 && <>
        <div className="eyebrow">En alerte</div>
        <div className="list">{alerts.map(s => (
          <Link key={s.id} className="row" to={`/ames/${s.id}`}><Avatar name={s.name} />
            <span className="main-col"><div className="name">{s.name}</div><div className="meta"><span className="chip warn">{streak(s.id)} absences</span> suivie par {workerName(s.makerId)}</div></span></Link>))}</div>
      </>}
      <Link to="/ames/nouvelle" className="fab" aria-label="Enregistrer une nouvelle âme"><IPlus /></Link>
    </div>
  );
}
