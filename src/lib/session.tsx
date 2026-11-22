import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { DEFAULT_SETTINGS, type Family, type Settings, type UserProfile } from "./types";

interface Session {
  ready: boolean;
  user: User | null;
  profile: UserProfile | null;
  settings: Settings;
  families: Family[];
  familyName: (id: string | null | undefined) => string;
  myFamily: Family | null;
  logout: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [families, setFamilies] = useState<Family[]>([]);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); if (!u) { setProfile(null); setProfileReady(true); } }), []);

  useEffect(() => {
    if (!user) return;
    setProfileReady(false);
    return onSnapshot(doc(db, "users", user.uid),
      s => { setProfile(s.exists() ? ({ id: s.id, ...s.data() } as UserProfile) : null); setProfileReady(true); },
      () => { setProfile(null); setProfileReady(true); });
  }, [user]);

  const activeProfile = profile?.active ? profile : null;

  useEffect(() => {
    if (!activeProfile) return;
    const u1 = onSnapshot(doc(db, "settings", "global"), s => setSettings(s.exists() ? { ...DEFAULT_SETTINGS, ...(s.data() as Settings) } : DEFAULT_SETTINGS), () => {});
    const u2 = onSnapshot(collection(db, "families"), s => setFamilies(s.docs.map(d => ({ id: d.id, ...d.data() }) as Family).sort((a, b) => a.name.localeCompare(b.name, "fr"))), () => {});
    return () => { u1(); u2(); };
  }, [activeProfile?.id]);

  // Thème choisi dans le profil
  useEffect(() => {
    const t = profile?.theme;
    if (!t) return;
    applyTheme(t);
  }, [profile?.theme]);

  const value = useMemo<Session>(() => ({
    ready: authReady && profileReady,
    user, profile, settings, families,
    familyName: id => families.find(f => f.id === id)?.name ?? (id ? "Famille inconnue" : "Sans famille"),
    myFamily: families.find(f => f.id === profile?.familyId) ?? null,
    logout: () => signOut(auth)
  }), [authReady, profileReady, user, profile, settings, families]);

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
