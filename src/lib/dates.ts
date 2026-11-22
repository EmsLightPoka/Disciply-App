// Les dates de culte sont stockées en texte AAAA-MM-JJ (heure locale), pour éviter les décalages de fuseau.
export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function today(): string { return iso(new Date()); }
export function fromIso(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }

/** Le dimanche de la semaine en cours (aujourd'hui si on est dimanche, sinon le dernier dimanche passé). */
export function currentSunday(ref = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}
export function nextSunday(ref = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return iso(d);
}
/** Les n derniers dimanches, du plus ancien au plus récent, en terminant par `last`. */
export function lastSundays(n: number, last = currentSunday()): string[] {
  const out: string[] = [];
  const d = fromIso(last);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - 7 * i); out.push(iso(x)); }
  return out;
}
export function addDays(s: string, n: number): string { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); }

const fmtLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const fmtFull = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
export const longDate = (s: string) => fmtLong.format(fromIso(s));
export const shortDate = (s: string) => fmtShort.format(fromIso(s));
export const fullDate = (s: string) => fmtFull.format(fromIso(s));
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
