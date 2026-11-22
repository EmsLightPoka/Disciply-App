import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSession } from "../lib/session";
import { useScope } from "../lib/scope";
import { ROLE_LABEL, type Role } from "../lib/types";
import { Avatar, Logo } from "./ui";
import { IArchive, IBell, ICal, IChart, IChurch, IGear, IGlobe, IHome, IInbox, IReport, ISchedule, IUser, IUsers, IWorker } from "./Icons";

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
  const { notifications } = useScope();
  if (!profile) return null;
  const items = NAV[profile.role];
  const unread = notifications.filter(n => !n.read).length;
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
        <div className="page wide" style={{ paddingTop: 10, paddingBottom: 0, maxWidth: "none" }}>
          <div className="context">
            <img src="/mark.png" alt="" />
            <span className="fam">{where}</span>
            <span>{ROLE_LABEL[profile.role]}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <Link to="/notifications" className="iconbtn bell" aria-label={`Notifications${unread ? `, ${unread} non lues` : ""}`}>
                <IBell />{unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <Link to="/profil" style={{ textDecoration: "none" }} aria-label="Mon profil"><Avatar name={profile.name} /></Link>
            </span>
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
