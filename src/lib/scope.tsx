import { createContext, useContext, useMemo, type ReactNode } from "react";
import { collection, query, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useQuery } from "./hooks";
import { useSession } from "./session";
import { isCampusAdmin, isLeader, type Attendance, type Notification, type ServiceSlot, type Soul, type UserProfile } from "./types";
import { absenceStreak, indexAttendance } from "./souls";
import { addDays, currentSunday } from "./dates";

/** Les données visibles par la personne connectée, selon son rôle et son campus. */
interface Scope {
  loading: boolean;
  souls: Soul[];
  active: Soul[];
  attendance: Map<string, Map<string, Attendance>>;
  streak: (soulId: string) => number;
  workers: UserProfile[];
  workerName: (id: string | null | undefined) => string;
  services: ServiceSlot[];
  /** Les cultes où ma famille sert et où je peux encore enregistrer des âmes. */
  openServices: ServiceSlot[];
  notifications: Notification[];
}
const Ctx = createContext<Scope | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { profile, campusId } = useSession();
  const uid = profile?.id ?? "";
  const role = profile?.role;
  const fam = profile?.familyId ?? "";
  const camp = campusId ?? "";
  const since = addDays(currentSunday(), -7 * 26);
  // Borne un peu dans le futur : la règle exige makersUntil > heure du serveur, la requête doit le garantir.
  // Arrondie à 10 minutes pour ne pas relancer la requête en boucle.
  const bound = Math.ceil(Date.now() / 600_000) * 600_000 + 300_000;

  const admin = isCampusAdmin(role), leader = isLeader(role), maker = role === "maker";
  const souls = useQuery<Soul>(!camp ? null
    : admin ? query(collection(db, "souls"), where("campusId", "==", camp))
    : leader ? query(collection(db, "souls"), where("campusId", "==", camp), where("familyId", "==", fam))
    : query(collection(db, "souls"), where("campusId", "==", camp), where("makerId", "==", uid)), [role, uid, fam, camp]);
  // Faiseur : les âmes qu'il a enregistrées aujourd'hui (visibles jusqu'à la fin du jour du culte).
  const created = useQuery<Soul>(maker && camp ? query(collection(db, "souls"), where("campusId", "==", camp), where("createdBy", "==", uid), where("makersUntil", ">", Timestamp.fromMillis(bound))) : null, [role, uid, camp, bound]);
  const att = useQuery<Attendance>(!camp ? null
    : admin ? query(collection(db, "attendances"), where("campusId", "==", camp), where("date", ">=", since))
    : leader ? query(collection(db, "attendances"), where("campusId", "==", camp), where("familyId", "==", fam), where("date", ">=", since))
    : query(collection(db, "attendances"), where("campusId", "==", camp), where("makerId", "==", uid), where("date", ">=", since)), [role, uid, fam, camp, since]);
  const workers = useQuery<UserProfile>(!camp ? null
    : admin ? query(collection(db, "users"), where("campusId", "==", camp))
    : query(collection(db, "users"), where("campusId", "==", camp), where("familyId", "==", fam)), [role, fam, camp]);
  const services = useQuery<ServiceSlot>(camp ? query(collection(db, "services"), where("campusId", "==", camp), where("date", ">=", addDays(currentSunday(), -35))) : null, [camp]);
  const notifs = useQuery<Notification>(uid ? query(collection(db, "notifications"), where("userId", "==", uid)) : null, [uid]);

  const value = useMemo<Scope>(() => {
    const idx = indexAttendance(att.data);
    const sunday = currentSunday();
    const byId = new Map<string, Soul>();
    for (const s of [...souls.data, ...created.data]) byId.set(s.id, s);
    const list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const ws = [...workers.data].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const now = Date.now();
    const untilField = maker ? "makersUntil" : "leadersUntil";
    const open = services.data.filter(s => s.familyId === fam && s.opensAt.toMillis() <= now && s[untilField].toMillis() > now);
    return {
      loading: souls.loading,
      souls: list,
      active: list.filter(s => s.state === "active"),
      attendance: idx,
      streak: id => absenceStreak(idx.get(id), sunday),
      workers: ws,
      workerName: id => (id ? ws.find(w => w.id === id)?.name ?? (id === uid ? profile?.name ?? "Moi" : "Ouvrier") : "Pas encore attribuée"),
      services: [...services.data].sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot)),
      openServices: open,
      notifications: [...notifs.data].sort((a, b) => (b.createdAt?.toMillis() ?? now) - (a.createdAt?.toMillis() ?? now))
    };
  }, [souls.data, souls.loading, created.data, att.data, workers.data, services.data, notifs.data, uid, fam, maker, profile?.name]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useScope(): Scope {
  const s = useContext(Ctx);
  if (!s) throw new Error("ScopeProvider manquant");
  return s;
}
