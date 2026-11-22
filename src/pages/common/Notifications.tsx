import { Link } from "react-router-dom";
import { useScope } from "../../lib/scope";
import { markRead } from "../../lib/api";
import { Top } from "../../components/ui";

export default function Notifications() {
  const { notifications } = useScope();
  const unread = notifications.filter(n => !n.read);
  return (
    <div className="page">
      <Top title="Notifications" sub={unread.length ? `${unread.length} non lue${unread.length > 1 ? "s" : ""}` : "Tout est lu"}
        right={unread.length > 0 ? <button className="btn ghost sm" style={{ flex: "none" }} onClick={() => unread.forEach(n => markRead(n.id).catch(() => {}))}>Tout marquer lu</button> : undefined} />
      <div className="list">{notifications.map(n => (
        <Link key={n.id} to={n.link ?? "#"} className={"row notif" + (n.read ? "" : " unread")} onClick={() => !n.read && markRead(n.id).catch(() => {})}>
          <span className="main-col" style={{ whiteSpace: "normal" }}>
            <div className="name" style={{ whiteSpace: "normal" }}>{n.title}</div>
            <div className="meta">{n.body}</div>
            <div className="meta">{n.createdAt ? n.createdAt.toDate().toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "À l'instant"}</div>
          </span>
          {!n.read && <span className="chip warn">Nouveau</span>}
        </Link>))}
        {notifications.length === 0 && <div className="empty">Aucune notification. Tu seras prévenu ici quand une âme t'est attribuée.</div>}
      </div>
    </div>
  );
}
