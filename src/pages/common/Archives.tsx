import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { shortDate } from "../../lib/dates";
import { Avatar, Top } from "../../components/ui";

export default function Archives() {
  const { familyName, profile } = useSession();
  const { souls } = useScope();
  const [tab, setTab] = useState<"exited" | "established">("exited");
  const list = souls.filter(s => s.state === tab);
  const total = souls.length || 1;
  const est = souls.filter(s => s.state === "established").length;
  const exited = souls.filter(s => s.state === "exited").length;
  const act = souls.filter(s => s.state === "active").length;
  return (
    <div className="page">
      <Top title="Archives" sub="Âmes sorties du suivi et disciples affermis" />
      <div className="grid2">
        <div className="stat"><div className="v">{Math.round(((act + est) / total) * 100)} %</div><div className="l">taux de maintien</div></div>
        <div className="stat"><div className="v">{Math.round((exited / total) * 100)} %</div><div className="l">taux de sortie</div></div>
      </div>
      <div className="filters"><button aria-pressed={tab === "exited"} onClick={() => setTab("exited")}>Sorties ({exited})</button><button aria-pressed={tab === "established"} onClick={() => setTab("established")}>Affermis ({est})</button></div>
      <div className="list">{list.map(s => (
        <Link key={s.id} className="row" to={`/ames/${s.id}`}><Avatar name={s.name} />
          <span className="main-col"><div className="name">{s.name}</div><div className="meta">{s.exitReason ?? "Disciple affermi"}{s.exitDate ? ` · ${shortDate(s.exitDate)}` : ""}{profile!.role === "admin" ? ` · ${familyName(s.familyId)}` : ""}</div></span></Link>))}
        {list.length === 0 && <div className="empty">Rien pour l'instant.</div>}</div>
      <p className="small">Ouvre une fiche puis Actions pour réintégrer une âme. Taux de maintien : âmes encore suivies ou affermies, sur toutes les âmes reçues.</p>
    </div>
  );
}
