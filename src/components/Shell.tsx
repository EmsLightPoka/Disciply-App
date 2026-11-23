import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSession } from "../lib/session";
import { useScope } from "../lib/scope";
import { ROLE_LABEL, type Role } from "../lib/types";
import { Logo } from "./ui";
import { IArchive, IBell, ICal, IChart, IChurch, IGear, IGlobe, IHome, IInbox, IReport, ISchedule, IPlus, IUser, IUsers, IWorker } from "./Icons";

type Item = [to: string, label: string, icon: ReactNode, mobile: boolean];

const leaderNav: Item[] = [
  ["/famille", "Famille", <IHome />, true],
  ["/a-attribuer", "À attribuer", <IInbox />, true],
  ["/ames", "Âmes", <IUsers />, false],
  ["/dimanche", "Dimanche", <ICal />, true],
  ["/rapports", "Rapports", <IReport />, true],
  ["/equipe", "Équipe", <IWorker />, false],
  ["/programme", "Programme", <ISchedule />, false],
  ["/archives", "Archives", <IArchive />, false]
];
const adminNav: Item[] = [
  ["/eglise", "Campus", <IChurch />, true],
  ["/programme", "Programme", <ISchedule />, true],
  ["/familles", "Familles", <IChart />, false],
  ["/equipe", "Ouvriers", <IWorker />, true],
  ["/ames", "Âmes", <IUsers />, false],
  ["/a-attribuer", "À attribuer", <IInbox />, false],
  ["/rapports", "Rapports", <IReport />, true],
  ["/rapport-dimanche", "Chiffres du dimanche", <ICal />, false],
  ["/archives", "Archives", <IArchive />, false],
  ["/reglages", "Réglages", <IGear />, false]
];
const NAV: Record<Role, Item[]> = {
  maker: [
    ["/aujourdhui", "Aujourd'hui", <IHome />, true],
    ["/ames", "Mes âmes", <IUsers />, true],
    ["/dimanche", "Dimanche", <ICal />, true],
    ["/rapports", "Rapport", <IReport />, true]
  ],
  shepherd: leaderNav,
  assistant: leaderNav.filter(i => i[0] !== "/equipe"),
  admin: adminNav,
  master: [["/campus", "Tous les campus", <IGlobe />, false], ...adminNav]
};

export default function Shell({ children }: { children: ReactNode }) {
  const { profile, myFamily, campus } = useSession();
  const { notifications, openServices } = useScope();
  if (!profile) return null;
  const items = NAV[profile.role];
  const unread = notifications.filter(n => !n.read).length;
  // Le bouton central « + » : la famille sert aujourd'hui, ou le pasteur (qui peut enregistrer à tout moment).
  const canRegister = openServices.length > 0 || profile.role === "admin" || profile.role === "master";
  const tabs = items.filter(i => i[3]);
  const half = Math.ceil(tabs.length / 2);
  const where = profile.role === "admin" || profile.role === "master"
    ? campus?.name ?? "Aucun campus choisi"
    : `${myFamily ? `Famille ${myFamily.name}` : "Famille non définie"}${campus ? ` · ${campus.name}` : ""}`;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Menu">
        <div className="brand"><Logo width={150} /></div>
        {items.map(([to, label, icon]) => <NavLink key={to} to={to}>{icon}{label}</NavLink>)}
        <NavLink to="/notifications"><IBell />Notifications{unread > 0 && <span className="chip warn" style={{ marginLeft: "auto" }}>{unread}</span>}</NavLink>
        <NavLink to="/profil"><IUser />Profil</NavLink>
        <div className="who"><b>{profile.name}</b>{ROLE_LABEL[profile.role]}<br />{where}</div>
      </aside>
      <div className="main">
        {children}
      </div>
      <nav className="tabbar" aria-label="Navigation">
        {tabs.slice(0, half).map(([to, label, icon]) => <NavLink key={to} to={to}>{icon}<span>{label}</span></NavLink>)}
        {canRegister && <Link to="/ames/nouvelle" className="tab-fab" aria-label="Enregistrer une nouvelle âme"><IPlus /></Link>}
        {tabs.slice(half).map(([to, label, icon]) => <NavLink key={to} to={to}>{icon}<span>{label}</span></NavLink>)}
      </nav>
    </div>
  );
}
