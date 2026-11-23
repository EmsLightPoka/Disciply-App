import { Link, Navigate, useParams } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { Loading, Top } from "../../components/ui";
import { FamilyMakers, StatTiles, useFamilyStats } from "../../components/FamilyView";

/** Pasteur ou super admin : le détail d'une famille, ses faiseurs et les âmes de chacun. */
export default function FamilyDetail() {
  const { id } = useParams();
  const { families } = useSession();
  const { workers, workerName, loading } = useScope();
  const stats = useFamilyStats();
  if (loading) return <Loading />;
  const f = families.find(x => x.id === id);
  if (!f) return <Navigate to="/eglise" replace />;
  const s = stats(f.id);
  const assistants = workers.filter(w => w.role === "assistant" && w.familyId === f.id && w.active);
  return (
    <div className="page wide">
      <Top back title={`Famille ${f.name}`} sub={`Berger : ${f.shepherdId ? workerName(f.shepherdId) : "à définir"}${assistants.length ? ` · Assistant${assistants.length > 1 ? "s" : ""} : ${assistants.map(a => a.name).join(", ")}` : ""}`}
        right={<Link to={`/familles?modifier=${f.id}`} className="btn ghost sm">Modifier</Link>} />
      <StatTiles s={s} />
      <div className="eyebrow">Faiseurs et âmes suivies ({s.makers} faiseur{s.makers > 1 ? "s" : ""})</div>
      <FamilyMakers familyId={f.id} />
      <div className="btnrow"><Link className="btn ghost" to={`/ames?famille=${f.id}`}>Toutes les âmes de la famille</Link></div>
    </div>
  );
}
