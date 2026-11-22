import { createContext, useContext, useMemo, type ReactNode } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useQuery } from "./hooks";
import { useSession } from "./session";
import type { Attendance, Soul, UserProfile } from "./types";
import { absenceStreak, indexAttendance } from "./souls";
import { addDays, currentSunday } from "./dates";

/** Les âmes, présences et ouvriers visibles par la personne connectée, selon son rôle. */
interface Scope {
  loading: boolean;
  souls: Soul[];
  active: Soul[];
  attendance: Map<string, Map<string, Attendance>>;
  streak: (soulId: string) => number;
  workers: UserProfile[];
  workerName: (id: string | null | undefined) => string;
}
const Ctx = createContext<Scope | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const uid = profile?.id ?? "";
  const role = profile?.role;
  const fam = profile?.familyId ?? "";
  const since = addDays(currentSunday(), -7 * 26);

  const soulsQ = role === "admin" ? collection(db, "souls")
    : role === "shepherd" ? query(collection(db, "souls"), where("familyId", "==", fam))
    : role === "maker" ? query(collection(db, "souls"), where("makerId", "==", uid)) : null;
  const attQ = role === "admin" ? query(collection(db, "attendances"), where("date", ">=", since))
    : role === "shepherd" ? query(collection(db, "attendances"), where("familyId", "==", fam), where("date", ">=", since))
    : role === "maker" ? query(collection(db, "attendances"), where("makerId", "==", uid), where("date", ">=", since)) : null;
  const workersQ = role === "admin" ? collection(db, "users")
    : role && fam ? query(collection(db, "users"), where("familyId", "==", fam)) : null;

  const souls = useQuery<Soul>(soulsQ, [role, uid, fam]);
  const att = useQuery<Attendance>(attQ, [role, uid, fam, since]);
  const workers = useQuery<UserProfile>(workersQ, [role, fam]);

  const value = useMemo<Scope>(() => {
    const idx = indexAttendance(att.data);
    const sunday = currentSunday();
    const list = [...souls.data].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const ws = [...workers.data].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return {
      loading: souls.loading,
      souls: list,
      active: list.filter(s => s.state === "active"),
      attendance: idx,
      streak: id => absenceStreak(idx.get(id), sunday),
      workers: ws,
      workerName: id => (id ? ws.find(w => w.id === id)?.name ?? (id === uid ? profile?.name ?? "Moi" : "Ouvrier") : "Sans faiseur")
    };
  }, [souls.data, souls.loading, att.data, workers.data, uid, profile?.name]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useScope(): Scope {
  const s = useContext(Ctx);
  if (!s) throw new Error("ScopeProvider manquant");
  return s;
}
