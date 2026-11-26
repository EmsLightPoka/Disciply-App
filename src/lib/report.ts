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

/** Appels et messages de la semaine (du lundi au samedi suivant le dimanche, complément du jeudi compris). */
export function contactsOf(list: Soul[], week: string) {
  const from = addDays(week, -6), to = addDays(week, 6);
  const c = list.filter(s => s.lastContact && s.lastContact.at.slice(0, 10) >= from && s.lastContact.at.slice(0, 10) <= to);
  return { answered: c.filter(s => s.lastContact!.answered), waiting: c.filter(s => !s.lastContact!.answered) };
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
  const ct = contactsOf(active, week);
  const withFi = active.filter(s => s.impactFamilyId).length;
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
    `Rattachées à une famille d'impact : ${withFi} sur ${total.souls}`,
    `Appels et messages : ${ct.answered.length} ont répondu · ${ct.waiting.length} pas encore`,
    `Rapports reçus : ${o.reports.length} sur ${o.makers.length} faiseurs`, "",
    "*2. Par faiseur*",
    ...o.makers.map(m => { const c = countWeek(active.filter(s => s.makerId === m.id), week, attendance, pending); const k = contactsOf(active.filter(s => s.makerId === m.id), week); return `• ${m.name} : ${c.souls} âmes, ${line(c)} · contacts ${k.answered.length} répondu, ${k.waiting.length} pas encore${got.has(m.id) ? "" : " · rapport pas encore envoyé"}`; }), "",
    "*3. Suivi des appels*", ...(ct.answered.length + ct.waiting.length ? [...ct.answered.map(s => `• ${s.name} : a répondu${s.lastContact!.text ? " · " + s.lastContact!.text : ""}`), ...ct.waiting.map(s => `• ${s.name} : pas encore répondu${s.lastContact!.text ? " · " + s.lastContact!.text : ""}`)] : ["Aucun suivi noté cette semaine"]), "",
    "*4. Difficultés*", ...(diffs.length ? diffs : ["Aucune difficulté signalée"]), "",
    "*5. Formations*", ...(forms.length ? forms : ["Aucune formation en cours"]),
    ...(o.comment ? ["", "*6. Mot du berger*", o.comment] : [])
  ].join("\n");
  return { text, totals: { ...total, newSouls, reports: o.reports.length, makers: o.makers.length, withFi, answered: ct.answered.length, contacted: ct.answered.length + ct.waiting.length } };
}
