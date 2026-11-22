import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { STATUS_LABEL, stepCount } from "../../lib/souls";
import { Avatar, Dots, Loading, Top } from "../../components/ui";
import { IPlus, ISearch } from "../../components/Icons";

type F = "all" | "alert" | "nomaker" | "nc" | "na" | "done";

export default function SoulsList() {
  const { profile, settings, families, familyName } = useSession();
  const { active, streak, workerName, workers, loading } = useScope();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");
  const [fam, setFam] = useState("");
  const [params] = useSearchParams();
  const [maker, setMaker] = useState(params.get("faiseur") ?? "");
  if (loading) return <Loading />;
  const role = profile!.role;

  let list = active.filter(s => (s.name + " " + s.phone + " " + s.neighborhood).toLowerCase().includes(q.toLowerCase()));
  if (f === "alert") list = list.filter(s => streak(s.id) >= settings.absenceThreshold);
  if (f === "nomaker") list = list.filter(s => !s.makerId);
  if (f === "nc") list = list.filter(s => s.status === "NC");
  if (f === "na") list = list.filter(s => s.status === "NA");
  if (f === "done") list = list.filter(s => stepCount(s, settings) === settings.steps.length);
  if (fam) list = list.filter(s => s.familyId === fam);
  if (maker) list = list.filter(s => s.makerId === maker);

  const FL: [F, string][] = [["all", "Toutes"], ["alert", "En alerte"], ...(role !== "maker" ? [["nomaker", "Sans faiseur"]] as [F, string][] : []), ["nc", "Nouveaux convertis"], ["na", "Nouveaux arrivants"], ["done", "Toutes les étapes"]];
  const makers = workers.filter(w => w.role === "maker" && (!fam || w.familyId === fam));

  return (
    <div className="page">
      <Top title={role === "maker" ? "Mes âmes" : role === "shepherd" ? "Âmes de la famille" : "Toutes les âmes"} sub={`${active.length} en suivi`} />
      <label className="search"><ISearch /><input placeholder="Chercher un nom, un téléphone, un quartier" value={q} onChange={e => setQ(e.target.value)} aria-label="Chercher" /></label>
      <div className="filters">{FL.map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}</div>
      {role !== "maker" && (
        <div className="grid2" style={{ marginBottom: 6 }}>
          {role === "admin" && <div className="field" style={{ margin: 0 }}><select aria-label="Famille" value={fam} onChange={e => { setFam(e.target.value); setMaker(""); }}><option value="">Toutes les familles</option>{families.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>}
          <div className="field" style={{ margin: 0 }}><select aria-label="Faiseur" value={maker} onChange={e => setMaker(e.target.value)}><option value="">Tous les faiseurs</option>{makers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
        </div>
      )}
      <p className="small" style={{ margin: "6px 2px" }}>{list.length} âme{list.length > 1 ? "s" : ""}</p>
      {list.length ? (
        <div className="list">{list.map(s => {
          const k = streak(s.id);
          return (
            <Link key={s.id} className="row" to={`/ames/${s.id}`}>
              <Avatar name={s.name} />
              <span className="main-col">
                <div className="name">{s.name}</div>
                <div className="meta">
                  <span className={"chip " + s.status.toLowerCase()} title={STATUS_LABEL[s.status]}>{STATUS_LABEL[s.status]}</span>
                  {k >= settings.absenceThreshold && <span className="chip warn">{k} absences</span>}
                  {role !== "maker" && <span>{workerName(s.makerId)}</span>}
                  {role === "admin" && <span>· {familyName(s.familyId)}</span>}
                </div>
              </span>
              <Dots n={stepCount(s, settings)} total={settings.steps.length} />
            </Link>);
        })}</div>
      ) : <div className="card empty">Aucune âme ne correspond.</div>}
      <Link to="/ames/nouvelle" className="fab" aria-label="Enregistrer une nouvelle âme"><IPlus /></Link>
    </div>
  );
}
