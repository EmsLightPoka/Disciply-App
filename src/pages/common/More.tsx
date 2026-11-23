import { Link } from "react-router-dom";
import { useSession } from "../../lib/session";
import { navItems } from "../../components/Shell";
import { Top } from "../../components/ui";
import { IBell, IUser } from "../../components/Icons";

/** Sur téléphone : tous les écrans du rôle, ceux qui ne tiennent pas dans la barre du bas compris. */
export default function More() {
  const { profile } = useSession();
  if (!profile) return null;
  const links = [...navItems(profile.role), ["/notifications", "Notifications", <IBell />, false] as const, ["/profil", "Profil", <IUser />, false] as const];
  return (
    <div className="page">
      <Top title="Plus" sub="Tous les écrans de l'application." />
      <div className="menu-grid">
        {links.map(([to, label, icon]) => <Link key={to} to={to} className="menu-tile"><span className="ico-g">{icon}</span><span>{label}</span></Link>)}
      </div>
    </div>
  );
}
