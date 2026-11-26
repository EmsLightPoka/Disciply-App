import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { DEFAULT_SETTINGS, type Campus, type Family, type Settings, type UserProfile } from "./types";

interface Session {
  ready: boolean;
  user: User | null;
  profile: UserProfile | null;
  campusId: string | null;
  campus: Campus | null;
  campuses: Campus[];
  settings: Settings;
  families: Family[];
  familyName: (id: string | null | undefined) => string;
  myFamily: Family | null;
  logout: () => Promise<void>;
  /** Faux pour un ancien compte « administrateur de l'application » qui n'est pas le tout premier compte. */
  superAdminOk: boolean;
  /** Le tout premier compte : lui seul crée d'autres super admins. */
  isFirst: boolean;
  superIds: string[];
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [families, setFamilies] = useState<Family[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); if (!u) { setProfile(null); setProfileReady(true); } }), []);

  useEffect(() => {
    if (!user) return;
    setProfileReady(false);
    // Seulement la version confirmée par le serveur : les autres écoutes dépendent du rôle et du campus,
    // et le serveur refuse tant qu'il ne connaît pas encore le changement.
    return onSnapshot(doc(db, "users", user.uid), { includeMetadataChanges: true },
      s => { if (s.metadata.hasPendingWrites) return; setProfile(s.exists() ? ({ id: s.id, ...s.data() } as UserProfile) : null); setProfileReady(true); },
      () => { setProfile(null); setProfileReady(true); });
  }, [user]);

  // Le super admin est uniquement le tout premier compte (celui de l'installation).
  const [masterId, setMasterId] = useState<string | null | undefined>(undefined);
  const [superIds, setSuperIds] = useState<string[]>([]);
  const isMasterRole = profile?.role === "master";
  useEffect(() => {
    if (!isMasterRole) return;
    Promise.all([
      getDoc(doc(db, "meta", "superAdmins")).then(s => setSuperIds((s.data()?.ids as string[]) ?? []), () => setSuperIds([])),
      getDoc(doc(db, "meta", "bootstrap")).then(s => s.data()?.masterId ?? null, () => null)
    ]).then(([, id]) => setMasterId(id));
  }, [isMasterRole]);
  const isFirst = isMasterRole && masterId === profile?.id;
  const superAdminOk = !isMasterRole || isFirst || superIds.includes(profile?.id ?? "");

  const activeId = profile?.active && superAdminOk ? profile.id : null;
  const campusId = activeId ? profile?.campusId ?? null : null;

  useEffect(() => {
    if (!activeId) return;
    return onSnapshot(collection(db, "campuses"), s => setCampuses(s.docs.map(d => ({ id: d.id, ...d.data() }) as Campus).sort((a, b) => a.name.localeCompare(b.name, "fr"))), () => {});
  }, [activeId]);

  useEffect(() => {
    if (!activeId || !campusId) { setFamilies([]); setSettings(DEFAULT_SETTINGS); return; }
    const u1 = onSnapshot(doc(db, "settings", campusId), s => setSettings(s.exists() ? { ...DEFAULT_SETTINGS, ...(s.data() as Settings) } : DEFAULT_SETTINGS), () => {});
    const u2 = onSnapshot(query(collection(db, "families"), where("campusId", "==", campusId)),
      s => setFamilies(s.docs.map(d => ({ id: d.id, ...d.data() }) as Family).sort((a, b) => a.name.localeCompare(b.name, "fr"))), () => {});
    return () => { u1(); u2(); };
  }, [activeId, campusId]);

  useEffect(() => { if (profile?.theme) applyTheme(profile.theme); }, [profile?.theme]);

  const value = useMemo<Session>(() => ({
    ready: authReady && profileReady && (!isMasterRole || masterId !== undefined),
    superAdminOk, isFirst, superIds,
    user, profile, campusId, campuses, settings, families,
    campus: campuses.find(c => c.id === campusId) ?? null,
    familyName: id => families.find(f => f.id === id)?.name ?? (id ? "Famille inconnue" : "Sans famille"),
    myFamily: families.find(f => f.id === profile?.familyId) ?? null,
    logout: () => signOut(auth)
  }), [authReady, profileReady, user, profile, campusId, campuses, settings, families, isMasterRole, masterId, superAdminOk, isFirst, superIds]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("SessionProvider manquant");
  return s;
}

export function applyTheme(t: "light" | "dark" | "system") {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try { localStorage.setItem("disciply-theme", t); } catch { /* stockage indisponible */ }
}
