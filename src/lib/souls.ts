import type { Attendance, Settings, Soul } from "./types";
import { lastSundays } from "./dates";

export const stepCount = (s: Soul, settings: Settings) => settings.steps.filter(st => s.steps?.[st.id]).length;
export const nextStep = (s: Soul, settings: Settings) => settings.steps.find(st => !s.steps?.[st.id]) ?? null;

/** Index des présences confirmées (P ou A) : soulId -> date -> présence. Les « en attente » sont à part. */
export function indexAttendance(list: Attendance[]): Map<string, Map<string, Attendance>> {
  const m = new Map<string, Map<string, Attendance>>();
  for (const a of list) {
    if (a.pending) continue;
    if (!m.has(a.soulId)) m.set(a.soulId, new Map());
    m.get(a.soulId)!.set(a.date, a);
  }
  return m;
}

/** Nombre de dimanches d'absence consécutifs, en remontant depuis `upTo` (les dimanches non pointés arrêtent le compte). */
export function absenceStreak(byDate: Map<string, Attendance> | undefined, upTo: string): number {
  if (!byDate) return 0;
  let n = 0;
  for (const d of lastSundays(26, upTo).reverse()) {
    const a = byDate.get(d);
    if (!a) { if (n === 0) continue; break; }
    if (a.present) break;
    n++;
  }
  return n;
}

/** soulId -> dimanches « en attente » (pas encore de retour). */
export function indexPending(list: Attendance[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const a of list) if (a.pending) { if (!m.has(a.soulId)) m.set(a.soulId, new Set()); m.get(a.soulId)!.add(a.date); }
  return m;
}

export const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

export function normalizePhone(p: string) { return p.replace(/[^\d+]/g, ""); }
export function telHref(p: string) { const n = normalizePhone(p); return `tel:${n.startsWith("+") || n.length > 9 ? n : "+237" + n}`; }
export function waHref(p: string) { let n = normalizePhone(p).replace(/^\+/, ""); if (n.length <= 9) n = "237" + n; return `https://wa.me/${n}`; }

export const STATUS_LABEL = { NC: "Nouveau converti", NA: "Nouvel arrivant" } as const;
