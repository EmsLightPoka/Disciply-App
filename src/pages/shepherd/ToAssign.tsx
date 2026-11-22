import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { shortDate } from "../../lib/dates";
import { STATUS_LABEL } from "../../lib/souls";
import { isCampusAdmin, type Soul } from "../../lib/types";
import { Avatar, Top } from "../../components/ui";
import AssignSheet from "../../components/AssignSheet";

export default function ToAssign() {
  const { profile, familyName } = useSession();
  const { active, openServices } = useScope();
  const [pick, setPick] = useState<Soul | null>(null);
  const list = active.filter(s => !s.makerId).sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  const admin = isCampusAdmin(profile!.role);

  return (
    <div className="page">
      <Top title="À attribuer" sub="Nouvelles âmes sans faiseur. Choisis qui les suivra : le faiseur est prévenu tout de suite." />
      {(openServices.length > 0 || admin) && <div className="btnrow" style={{ marginTop: 0, marginBottom: 12 }}><Link to="/ames/nouvelle" className="btn grad">Enregistrer une nouvelle âme</Link></div>}
      {list.length ? <div className="list">{list.map(s => (
        <div className="row" key={s.id}><Avatar name={s.name} />
          <Link to={`/ames/${s.id}`} className="main-col" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="name">{s.name}</div>
            <div className="meta"><span className={"chip " + s.status.toLowerCase()}>{STATUS_LABEL[s.status]}</span>{s.gender === "F" ? "Femme" : "Homme"} · {s.service} du {shortDate(s.arrivalDate)}{admin ? ` · ${familyName(s.familyId)}` : ""}</div>
          </Link>
          <button className="btn primary sm" style={{ flex: "none" }} onClick={() => setPick(s)}>Attribuer</button></div>))}</div>
        : <div className="card empty">Toutes les âmes ont un faiseur.</div>}
      {pick && <AssignSheet soul={pick} onClose={() => setPick(null)} />}
    </div>
  );
}
