import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { createAccountNow, createFamily, createInvitation, updateFamily } from "./api";
import { addDays, currentSunday, lastSundays } from "./dates";
import type { Invitation, Role, Settings, UserProfile } from "./types";

/**
 * Données de démonstration entièrement fictives (aucune personne réelle) :
 * des familles, un berger et des faiseurs par famille (vrais comptes, mot de passe commun),
 * des âmes avec étapes, formations, difficultés et 8 dimanches de présences.
 */
export const DEMO_PASSWORD = "Jesus237";
export const DEMO_DOMAIN = "demo.disciply.test";

const FAMILIES = ["Amour", "Foi", "Espérance", "Grâce", "Paix", "Victoire"];
const F_FIRST = ["Grâce", "Esther", "Ruth", "Nadège", "Mireille", "Laure", "Sandrine", "Carine", "Brigitte", "Rachel", "Sylvie", "Christelle", "Josiane", "Pélagie", "Odile", "Viviane", "Patricia", "Annie", "Murielle", "Estelle", "Danielle", "Flore", "Gisèle", "Linda"];
const H_FIRST = ["Paul", "Marc", "Hervé", "Boris", "Christian", "Junior", "Serge", "Alain", "Didier", "Joël", "Franck", "Patrick", "Thierry", "Arnaud", "Cyrille", "Landry", "Yannick", "Steve", "Rodrigue", "Martial", "Olivier", "Brice", "Fabrice", "Ulrich"];
const LAST = ["Mbarga", "Owona", "Ekani", "Tchana", "Fouda", "Abena", "Kamga", "Nana", "Mballa", "Essomba", "Ateba", "Ndongo", "Mvondo", "Onana", "Eyenga", "Mbida", "Ndzié", "Bilong", "Tchoupo", "Atangana", "Manga", "Ngono", "Zang", "Biyong", "Messi", "Ewondo", "Ayissi", "Belinga"];
const QUARTIERS = ["Bastos", "Essos", "Mvog-Mbi", "Ngousso", "Biyem-Assi", "Mendong", "Nkolbisson", "Emana", "Omnisport", "Mimboman", "Etoudi", "Odza"];

// Générateur déterministe : la même démo à chaque fois.
let seed = 237;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const phone = () => `6${pick(["7", "9", "5"])}${String(Math.floor(rnd() * 1e7)).padStart(7, "0")}`;

export const isDemoCampus = (name?: string | null) => !!name && /d[ée]mo/i.test(name);

export async function seedDemo(me: UserProfile, campusId: string, campusName: string, settings: Settings, log: (m: string) => void) {
  seed = 237;
  const makers: { id: string; familyId: string; gender: "F" | "H" }[] = [];
  const accounts: string[] = [];

  async function account(name: string, gender: "F" | "H", role: Role, familyId: string, familyName: string, email: string) {
    const id = await createInvitation(me, { name, email, role, gender, campusId, campusName, familyId, familyName });
    const inv: Invitation = { id, name, email, role, gender, campusId, familyId, createdBy: me.id, createdByName: me.name, usedBy: null };
    try { const uid = await createAccountNow(inv, phone(), DEMO_PASSWORD); accounts.push(email); return uid; }
    catch (e) { if ((e as { code?: string }).code === "auth/email-already-in-use") { log(`${email} existe déjà, ignoré`); return null; } throw e; }
  }

  for (const fam of FAMILIES) {
    log(`Famille ${fam} : berger et faiseurs…`);
    const ref = await createFamily(campusId, fam, null);
    const fs = slug(fam);
    const shepherdF = rnd() < 0.5;
    const shepherdId = await account(`${pick(shepherdF ? F_FIRST : H_FIRST)} ${pick(LAST)}`, shepherdF ? "F" : "H", "shepherd", ref.id, fam, `berger.${fs}@${DEMO_DOMAIN}`);
    if (shepherdId) await updateFamily(ref.id, { shepherdId });
    for (let i = 1; i <= 3; i++) {
      const g: "F" | "H" = i === 3 ? "H" : "F";
      const uid = await account(`${pick(g === "F" ? F_FIRST : H_FIRST)} ${pick(LAST)}`, g, "maker", ref.id, fam, `faiseur${i}.${fs}@${DEMO_DOMAIN}`);
      if (uid) makers.push({ id: uid, familyId: ref.id, gender: g });
    }
  }
  const souls = await seedSouls(me, campusId, settings, makers, log);
  return { accounts, souls };
}

/** 2. Âmes et présences, écrites par le responsable une fois les comptes créés (il faut leurs identifiants). */
export async function seedSouls(me: UserProfile, campusId: string, settings: Settings, makers: { id: string; familyId: string; gender?: "F" | "H" | null }[], log: (m: string) => void) {
  seed = 4242;
  const sundays = lastSundays(8, currentSunday());
  const steps = settings.steps.map(s => s.id);
  let batch = writeBatch(db); let n = 0; let souls = 0;
  const flush = async () => { if (n) { await batch.commit(); batch = writeBatch(db); n = 0; } };
  const put = async (path: string, id: string | null, data: Record<string, unknown>) => {
    const ref = id ? doc(db, path, id) : doc(collection(db, path));
    batch.set(ref, data); n++; if (n >= 400) await flush(); return ref.id;
  };
  const byFamily = new Map<string, typeof makers>();
  for (const m of makers) byFamily.set(m.familyId, [...(byFamily.get(m.familyId) ?? []), m]);

  for (const [familyId, list] of byFamily) {
    const count = 30 + Math.floor(rnd() * 10);
    log(`Âmes de la famille (${count})…`);
    for (let i = 0; i < count; i++) {
      const gender: "F" | "H" = rnd() < 0.62 ? "F" : "H";
      const sameSex = list.filter(m => m.gender === gender);
      const maker = rnd() < 0.08 ? null : pick(sameSex.length ? sameSex : list);
      const weeksAgo = Math.floor(rnd() * 12);
      const arrival = addDays(currentSunday(), -7 * weeksAgo);
      const level = weeksAgo < 2 ? 0 : Math.floor(rnd() * Math.min(steps.length + 1, 1 + weeksAgo / 2));
      const stepRec: Record<string, unknown> = {};
      steps.slice(0, level).forEach((s, k) => { stepRec[s] = { date: addDays(arrival, 14 + 7 * k), by: maker?.id ?? me.id }; });
      const formations: Record<string, unknown> = {};
      settings.formations.forEach((f, k) => {
        const r = rnd();
        if (k === 0 && weeksAgo > 3 && r < 0.7) formations[f] = { status: r < 0.35 ? "done" : "started", date: addDays(arrival, 21) };
        else if (k === 1 && weeksAgo > 8 && r < 0.3) formations[f] = { status: "started", date: addDays(arrival, 56) };
      });
      const exited = rnd() < 0.06;
      const established = !exited && level === steps.length;
      const name = `${pick(gender === "F" ? F_FIRST : H_FIRST)} ${pick(LAST)}`;
      const difficulty = rnd() < 0.1 ? { kind: pick(settings.difficulties.length ? settings.difficulties : ["Autre"]), text: "Exemple de difficulté (donnée de démonstration).", at: addDays(currentSunday(), -7 * Math.floor(rnd() * 3)) } : null;
      const soulId = await put("souls", null, {
        name, phone: phone(), gender, neighborhood: pick(QUARTIERS), status: rnd() < 0.65 ? "NC" : "NA",
        service: pick(settings.services.length ? settings.services : ["1er culte"]), arrivalDate: arrival,
        familyId, makerId: maker?.id ?? null, campusId, steps: stepRec, formations, difficulty,
        state: exited ? "exited" : established ? "established" : "active",
        ...(exited ? { exitReason: pick(settings.exitReasons.length ? settings.exitReasons : ["Autre"]), exitDate: addDays(currentSunday(), -7) } : {}),
        history: [{ at: new Date().toISOString(), by: me.id, text: "Donnée de démonstration" }],
        createdAt: serverTimestamp(), createdBy: me.id, updatedAt: serverTimestamp(), updatedBy: me.id
      });
      souls++;
      // Présences : les dimanches depuis l'arrivée, avec quelques âmes en décrochage.
      const fragile = rnd() < 0.15;
      for (const [k, d] of sundays.entries()) {
        if (d < arrival || exited) continue;
        const present = fragile ? k < sundays.length - 3 && rnd() < 0.6 : rnd() < 0.82;
        await put("attendances", `${d}_${soulId}`, {
          campusId, soulId, familyId, makerId: maker?.id ?? null, date: d, present,
          reason: present ? null : pick(settings.absenceReasons.length ? settings.absenceReasons : ["Malade"]), by: maker?.id ?? me.id, at: serverTimestamp()
        });
      }
    }
  }
  await flush();
  return souls;
}

