import type { Attendance, MakerReport, Soul, UserProfile } from "./types";
import { addDays, fullDate } from "./dates";

export interface Counts { souls: number; present: number; absent: number; pending: number; notPointed: number }

/** Présents (P), absents (A), en attente (E) et non pointés pour un dimanche, calculés en direct. */
export function countWeek(list: Soul[], week: string, attendance: Map<string, Map<string, Attendance>>, pending: Map<string, Set<string>>): Counts {
  let present = 0, absent = 0, pend = 0;
  for (const s of list) {
    const a = attendance.get(s.id)?.get(week);
    if (a) { if (a.present) present++; else absent++; }
    else if (pending.get(s.id)?.has(week)) pend++;
  }
  return { souls: list.length, present, absent, pending: pend, notPointed: list.length - present - absent - pend };
}

const line = (c: Counts) => `${c.present} P · ${c.absent} A · ${c.pending} E (en attente)${c.notPointed ? ` · ${c.notPointed} non pointées` : ""}`;

/**
 * Rapport compilé d'une famille, toujours recalculé à partir des pointages :
 * quand un faiseur confirme ses « E » au complément du jeudi, le rapport du berger et celui du pasteur changent tout seuls.
 */
export function buildFamilyReport(o: {
  familyName: string; shepherdName: string; week: string; souls: Soul[]; active: Soul[];
  attendance: Map<string, Map<string, Attendance>>; pending: Map<string, Set<string>>;
  makers: UserProfile[]; reports: MakerReport[]; comment?: string;
}) {
  const { week, active, attendance, pending } = o;
  const total = countWeek(active, week, attendance, pending);
  const newSouls = o.souls.filter(s => s.arrivalDate >= addDays(week, -6) && s.arrivalDate <= week).length;
  const got = new Map(o.reports.map(r => [r.makerId, r]));
  const complement = o.reports.some(r => r.complementAt);
  const diffs = active.filter(s => s.difficulty).map(s => `• ${s.name} : ${s.difficulty!.kind}${s.difficulty!.text ? " · " + s.difficulty!.text : ""}`);
  const forms = active.filter(s => s.formations && Object.keys(s.formations).length).map(s => `• ${s.name} : ${Object.entries(s.formations!).map(([k, v]) => `${k} (${v.status === "done" ? "terminée" : "commencée"})`).join(", ")}`);
  const text = [
    `*RAPPORT HEBDOMADAIRE · FAMILLE ${o.familyName.toUpperCase()}*`,
    `Semaine du dimanche ${fullDate(week)}${complement ? " · mis à jour avec le complément" : ""}`,
    `Berger : ${o.shepherdName}`, "",
    "*1. Chiffres*",
    `Âmes en suivi : ${total.souls}`,
    `Dimanche : ${line(total)}`,
    `Nouvelles âmes reçues : ${newSouls}`,
    `Rattachées à une famille d'impact : ${active.filter(s => s.impactFamilyId).length} sur ${total.souls}`,
    `Rapports reçus : ${o.reports.length} sur ${o.makers.length} faiseurs`, "",
    "*2. Par faiseur*",
    ...o.makers.map(m => { const c = countWeek(active.filter(s => s.makerId === m.id), week, attendance, pending); return `• ${m.name} : ${c.souls} âmes, ${line(c)}${got.has(m.id) ? "" : " · rapport pas encore envoyé"}`; }), "",
    "*3. Difficultés*", ...(diffs.length ? diffs : ["Aucune difficulté signalée"]), "",
    "*4. Formations*", ...(forms.length ? forms : ["Aucune formation en cours"]),
    ...(o.comment ? ["", "*5. Mot du berger*", o.comment] : [])
  ].join("\n");
  return { text, totals: { ...total, newSouls, reports: o.reports.length, makers: o.makers.length } };
}
