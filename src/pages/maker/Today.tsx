import { Link } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { cap, currentSunday, longDate, nextSunday, today } from "../../lib/dates";
import { nextStep, stepCount, telHref } from "../../lib/souls";
import { Avatar, Dots, Loading, Top } from "../../components/ui";
import { ICal, IPhone, IPlus } from "../../components/Icons";
import { StatTiles, useMyFamilyStats } from "../../components/FamilyView";

export default function Today() {
  const { profile, settings, myFamily } = useSession();
  const famStats = useMyFamilyStats(profile?.familyId);
  const { active, attendance, streak, loading, openServices } = useScope();
  if (loading) return <Loading />;

  const isSunday = new Date().getDay() === 0;
  const sunday = isSunday ? today() : nextSunday();
  const lastSunday = currentSunday();
  const toPoint = isSunday ? active.filter(s => !attendance.get(s.id)?.get(sunday)).length : active.length;
  const alerts = active.filter(s => streak(s.id) >= settings.absenceThreshold).sort((a, b) => streak(b.id) - streak(a.id));
  const fresh = active.filter(s => !s.history || s.history.length <= 1).filter(s => !attendance.get(s.id)?.size).slice(0, 5);
  const absentLast = active.filter(s => attendance.get(s.id)?.get(lastSunday)?.present === false && streak(s.id) < settings.absenceThreshold);
  const toValidate = active.filter(s => { const n = stepCount(s, settings); return n > 0 && n < settings.steps.length; }).slice(0, 4);
  const first = profile?.name.split(" ")[0] ?? "";

  return (
    <div className="page">
      <Top kicker={cap(longDate(today()))} title={`Bonjour ${first}`} sub={<p className="verse">«&nbsp;Allez, faites de toutes les nations des disciples.&nbsp;»<cite>Matthieu 28.19</cite></p>} />

      <div className="card today">
        <div className="ico-g"><ICal /></div>
        <span className="small">{isSunday ? "Aujourd'hui, " : "Prochain culte : "}{longDate(sunday)}</span>
        <span className="big">{active.length === 0 ? "Aucune âme confiée pour l'instant" : toPoint ? `${toPoint} âme${toPoint > 1 ? "s" : ""} à pointer` : "Pointage terminé"}</span>
        {active.length > 0 && <Link to="/dimanche" className="btn grad" style={{ alignSelf: "flex-start" }}>{isSunday && toPoint ? "Commencer le pointage" : "Ouvrir le pointage"}</Link>}
      </div>

      {famStats && <>
        <div className="eyebrow">Ma famille{myFamily ? ` · ${myFamily.name}` : ""}</div>
        <StatTiles s={famStats} />
      </>}

      {openServices.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginTop: 0 }}>Ta famille est de service</div>
          <p style={{ margin: "0 0 10px" }}>{openServices.map(o => o.slot).join(", ")} : enregistre les nouveaux convertis et nouveaux arrivants d'aujourd'hui.</p>
          <Link to="/ames/nouvelle" className="btn primary">Enregistrer une âme</Link>
        </div>)}

      {alerts.length > 0 && <>
        <div className="eyebrow">À appeler en priorité</div>
        <div className="list">{alerts.map(s => (
          <div className="row" key={s.id}>
            <Avatar name={s.name} />
            <Link to={`/ames/${s.id}`} className="main-col" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="name">{s.name}</div>
              <div className="meta"><span className={"chip " + (streak(s.id) >= settings.absenceThreshold + 2 ? "bad" : "warn")}>{streak(s.id)} absences de suite</span></div>
            </Link>
            {s.phone && <a className="iconbtn call" href={telHref(s.phone)} aria-label={`Appeler ${s.name}`}><IPhone /></a>}
          </div>))}
        </div>
      </>}

      {absentLast.length > 0 && <>
        <div className="eyebrow">{lastSunday === today() ? "Absents aujourd'hui" : "Absents dimanche dernier"}</div>
        <div className="list">{absentLast.map(s => (
          <Link className="row" key={s.id} to={`/ames/${s.id}`}><Avatar name={s.name} />
            <span className="main-col"><div className="name">{s.name}</div><div className="meta">{attendance.get(s.id)?.get(lastSunday)?.reason ?? "Motif non indiqué"}</div></span></Link>))}
        </div>
      </>}

      {fresh.length > 0 && <>
        <div className="eyebrow">Nouvelles âmes à contacter</div>
        <div className="list">{fresh.map(s => (
          <Link className="row" key={s.id} to={`/ames/${s.id}`}><Avatar name={s.name} />
            <span className="main-col"><div className="name">{s.name}</div><div className="meta">Reçue le {s.arrivalDate.split("-").reverse().join("/")} · {s.neighborhood || "quartier à compléter"}</div></span></Link>))}
        </div>
      </>}

      {toValidate.length > 0 && <>
        <div className="eyebrow">Prochaine étape <Link to="/ames">Toutes mes âmes</Link></div>
        <div className="list">{toValidate.map(s => (
          <Link className="row" key={s.id} to={`/ames/${s.id}`}><Avatar name={s.name} />
            <span className="main-col"><div className="name">{s.name}</div><div className="meta">Étape suivante : {nextStep(s, settings)?.label}</div></span>
            <Dots n={stepCount(s, settings)} total={settings.steps.length} /></Link>))}
        </div>
      </>}

      {active.length === 0 && <div className="card empty" style={{ marginTop: 16 }}>Ton berger ou son assistant t'attribuera des âmes. Quand ta famille est de service, tu peux enregistrer les nouvelles âmes du jour jusqu'à minuit.</div>}
      {openServices.length > 0 && <Link to="/ames/nouvelle" className="fab" aria-label="Enregistrer une nouvelle âme"><IPlus /></Link>}
    </div>
  );
}
