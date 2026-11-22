import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSession } from "../lib/session";
import { ROLE_LABEL } from "../lib/types";
import { Avatar, Logo } from "./ui";
import { IArchive, ICal, IChart, IChurch, IGear, IHome, IInbox, IReport, IUser, IUsers, IWorker } from "./Icons";

type Item = [to: string, label: string, icon: ReactNode, mobile: boolean];

const NAV: Record<string, Item[]> = {
  maker: [
    ["/aujourdhui", "Aujourd'hui", <IHome />, true],
    ["/ames", "Mes âmes", <IUsers />, true],
    ["/dimanche", "Dimanche", <ICal />, true],
    ["/rapport", "Rapport", <IReport />, false],
    ["/profil", "Profil", <IUser />, true]
  ],
  shepherd: [
    ["/famille", "Famille", <IHome />, true],
    ["/ames", "Âmes", <IUsers />, true],
    ["/dimanche", "Dimanche", <ICal />, true],
    ["/a-affecter", "À affecter", <IInbox />, false],
    ["/equipe", "Équipe", <IWorker />, true],
    ["/rapport", "Rapport", <IReport />, false],
    ["/archives", "Archives", <IArchive />, false]
  ],
  admin: [
    ["/eglise", "Église", <IChurch />, true],
    ["/familles", "Familles", <IChart />, true],
    ["/ames", "Âmes", <IUsers />, false],
    ["/equipe", "Ouvriers", <IWorker />, true],
    ["/a-affecter", "À affecter", <IInbox />, false],
    ["/rapport", "Rapports", <IReport />, false],
    ["/archives", "Archives", <IArchive />, false],
    ["/reglages", "Réglages", <IGear />, true]
  ]
};

export default function Shell({ children }: { children: ReactNode }) {
  const { profile, myFamily, settings } = useSession();
  if (!profile) return null;
  const items = NAV[profile.role];
  const where = profile.role === "admin" ? settings.churchName : myFamily ? `Famille ${myFamily.name}` : "Famille non définie";

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Menu">
        <div className="brand"><Logo width={150} /></div>
        {items.map(([to, label, icon]) => <NavLink key={to} to={to}>{icon}{label}</NavLink>)}
        {profile.role !== "maker" && <NavLink to="/profil"><IUser />Profil</NavLink>}
        <div className="who"><b>{profile.name}</b>{ROLE_LABEL[profile.role]}<br />{where}</div>
      </aside>
      <div className="main">
        <div className="page wide" style={{ paddingTop: 10, paddingBottom: 0, maxWidth: "none" }}>
          <div className="context">
            <img src="/mark.png" alt="" />
            <span className="fam">{where}</span>
            <span>{ROLE_LABEL[profile.role]}</span>
            <Link to="/profil" style={{ marginLeft: "auto", textDecoration: "none" }} aria-label="Mon profil"><Avatar name={profile.name} /></Link>
          </div>
        </div>
        {children}
      </div>
      <nav className="tabbar" aria-label="Navigation">
        {items.filter(i => i[3]).map(([to, label, icon]) => <NavLink key={to} to={to}>{icon}<span>{label}</span></NavLink>)}
      </nav>
    </div>
  );
}
