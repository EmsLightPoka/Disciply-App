import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;
const H = 3600_000;
const ts = (offsetMs: number) => Timestamp.fromMillis(Date.now() + offsetMs);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-disciply",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 }
  });
});
afterAll(async () => { await env.cleanup(); });

const u = (role: string, campusId: string | null, familyId: string | null, active = true, gender = "F") =>
  ({ name: role, email: "", role, campusId, familyId, active, gender });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const put = (p: string, d: object) => setDoc(doc(db, p), d);
    await put("meta/bootstrap", { masterId: "master" });
    await put("campuses/yde", { name: "Yaoundé" });
    await put("campuses/dla", { name: "Douala" });
    await put("families/amour", { campusId: "yde", name: "Amour", shepherdId: "berger" });
    await put("families/foi", { campusId: "yde", name: "Foi", shepherdId: null });
    await put("families/paix", { campusId: "dla", name: "Paix", shepherdId: null });
    await put("users/master", { ...u("master", "yde", null), email: "master@x.cm" });
    await put("users/pasteur", { ...u("admin", "yde", null), email: "pasteur@x.cm" });
    await put("users/pp", { ...u("pastor", "dla", null), email: "pp@x.cm" });
    await put("users/faux", { ...u("master", "yde", null), email: "faux@x.cm" });
    await put("users/pasteurdla", { ...u("admin", "dla", null), email: "pasteurdla@x.cm" });
    await put("users/berger", { ...u("shepherd", "yde", "amour"), email: "berger@x.cm" });
    await put("users/assist", { ...u("assistant", "yde", "amour"), email: "assist@x.cm" });
    await put("users/grace", { ...u("maker", "yde", "amour"), email: "grace@x.cm" });
    await put("users/paul", { ...u("maker", "yde", "amour", true, "H"), email: "paul@x.cm" });
    await put("users/eric", { ...u("maker", "yde", "foi", true, "H"), email: "eric@x.cm" });
    await put("users/off", { ...u("maker", "yde", "amour", false), email: "off@x.cm" });
    // Amour sert aujourd'hui (fenêtre ouverte) ; Foi a servi la semaine dernière (fermée).
    await put("services/today_amour", { campusId: "yde", familyId: "amour", date: "", slot: "1er culte", opensAt: ts(-2 * H), makersUntil: ts(6 * H), leadersUntil: ts(18 * H) });
    await put("services/past_foi", { campusId: "yde", familyId: "foi", date: "", slot: "1er culte", opensAt: ts(-170 * H), makersUntil: ts(-160 * H), leadersUntil: ts(-148 * H) });
    await put("services/yesterday_amour", { campusId: "yde", familyId: "amour", date: "", slot: "2e culte", opensAt: ts(-30 * H), makersUntil: ts(-6 * H), leadersUntil: ts(6 * H) });
    await put("souls/s1", { campusId: "yde", name: "Brigitte", familyId: "amour", makerId: "grace", createdBy: "berger", makersUntil: ts(-100 * H), state: "active", steps: {} });
    await put("souls/s2", { campusId: "yde", name: "Junior", familyId: "amour", makerId: "paul", createdBy: "berger", makersUntil: ts(-100 * H), state: "active", steps: {} });
    await put("souls/s3", { campusId: "yde", name: "Hervé", familyId: "foi", makerId: "eric", createdBy: "eric", makersUntil: ts(-100 * H), state: "active", steps: {} });
    await put("souls/pool", { campusId: "yde", name: "Nadège", familyId: "amour", makerId: null, createdBy: "grace", makersUntil: ts(6 * H), state: "active", steps: {} });
    await put("souls/d1", { campusId: "dla", name: "Douala", familyId: "paix", makerId: null, createdBy: "pasteurdla", makersUntil: ts(-100 * H), state: "active", steps: {} });
    await put("invitations/tok1", { campusId: "yde", name: "Nouveau", email: "new@x.cm", role: "maker", familyId: "amour", usedBy: null });
    await put("notifications/n1", { campusId: "yde", userId: "grace", by: "berger", read: false, title: "x" });
  });
});

const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@x.cm` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const newSoul = (by: string, extra: object = {}) => ({
  campusId: "yde", name: "X", familyId: "amour", makerId: null, createdBy: by, serviceId: "today_amour",
  makersUntil: (extra as { makersUntil?: Timestamp }).makersUntil ?? null, state: "active", steps: {}, ...extra
});

describe("visiteur non connecté", () => {
  it("ne lit ni les âmes ni les profils", async () => {
    await assertFails(getDoc(doc(anon(), "souls/s1")));
    await assertFails(getDocs(collection(anon(), "users")));
  });
  it("lit une invitation par son lien, jamais la liste", async () => {
    await assertSucceeds(getDoc(doc(anon(), "invitations/tok1")));
    await assertFails(getDocs(collection(anon(), "invitations")));
  });
});

describe("séparation des campus", () => {
  it("le pasteur ne voit rien d'un autre campus", async () => {
    await assertFails(getDoc(doc(as("pasteur"), "souls/d1")));
    await assertFails(getDocs(query(collection(as("pasteur"), "souls"), where("campusId", "==", "dla"))));
    await assertSucceeds(getDocs(query(collection(as("pasteur"), "souls"), where("campusId", "==", "yde"))));
    await assertFails(getDoc(doc(as("pasteur"), "families/paix")));
  });
  it("l'administrateur de l'application voit tous les campus et en crée", async () => {
    await assertSucceeds(getDoc(doc(as("master"), "souls/d1")));
    await assertSucceeds(setDoc(doc(as("master"), "campuses/bfs"), { name: "Bafoussam" }));
    await assertFails(setDoc(doc(as("pasteur"), "campuses/bfs2"), { name: "Bafoussam" }));
  });
  it("seul le premier compte est super admin", async () => {
    await assertFails(getDoc(doc(as("faux"), "families/paix")));
    await assertFails(getDoc(doc(as("faux"), "souls/d1")));
    await assertFails(setDoc(doc(as("faux"), "campuses/bfs3"), { name: "X" }));
    await assertFails(updateDoc(doc(as("faux"), "users/faux"), { campusId: "dla" }));
    await assertFails(updateDoc(doc(as("master"), "users/grace"), { role: "master" }));
    await assertFails(setDoc(doc(as("master"), "invitations/m1"), { name: "M", email: "m@x.cm", role: "master", campusId: null, familyId: null, usedBy: null }));
    // Le super admin rattache le compte à un campus comme pasteur.
    await assertSucceeds(updateDoc(doc(as("master"), "users/faux"), { role: "admin", campusId: "dla" }));
  });
  it("chiffres de famille : le berger publie, le faiseur lit les siens seulement", async () => {
    const st = { campusId: "yde", familyId: "amour", souls: 3 };
    await assertSucceeds(setDoc(doc(as("berger"), "familyStats/amour"), st));
    await assertFails(setDoc(doc(as("grace"), "familyStats/amour"), st));
    await assertSucceeds(getDoc(doc(as("grace"), "familyStats/amour")));
    await assertFails(getDoc(doc(as("eric"), "familyStats/amour")));
    await assertFails(setDoc(doc(as("berger"), "familyStats/foi"), { ...st, familyId: "foi" }));
  });
  it("le pasteur principal voit tous les campus ; seul le super admin le nomme", async () => {
    await assertSucceeds(getDoc(doc(as("pp"), "souls/d1")));
    await assertSucceeds(getDoc(doc(as("pp"), "families/amour")));
    await assertSucceeds(setDoc(doc(as("pp"), "campuses/bfs4"), { name: "Bafoussam" }));
    await assertSucceeds(updateDoc(doc(as("pp"), "users/pp"), { campusId: "yde" }));
    await assertFails(updateDoc(doc(as("pp"), "users/grace"), { role: "pastor" }));
    await assertFails(updateDoc(doc(as("pasteurdla"), "users/pp"), { role: "maker", familyId: "paix" }));
    await assertSucceeds(updateDoc(doc(as("master"), "users/grace"), { role: "pastor", familyId: null }));
  });
  it("familles d'impact : le leader gère, le campus lit, un autre campus non", async () => {
    const fi = { campusId: "yde", name: "FI Bastos", kind: "FI", quartiers: ["Bastos"], pilotName: "P", pilotPhone: "1", hostName: "H", hostPhone: "2" };
    await assertSucceeds(setDoc(doc(as("pasteur"), "impactFamilies/f1"), fi));
    await assertFails(setDoc(doc(as("grace"), "impactFamilies/f2"), fi));
    await assertSucceeds(getDoc(doc(as("grace"), "impactFamilies/f1")));
    await assertFails(getDoc(doc(as("pasteurdla"), "impactFamilies/f1")));
  });
  it("un pasteur ne nomme pas d'administrateur de l'application", async () => {
    await assertFails(updateDoc(doc(as("pasteur"), "users/grace"), { role: "master" }));
    await assertSucceeds(updateDoc(doc(as("pasteur"), "users/grace"), { role: "shepherd" }));
  });
});

describe("programme de service", () => {
  it("seul le pasteur choisit la famille de service", async () => {
    const s = { campusId: "yde", familyId: "foi", date: "", slot: "1er culte", opensAt: ts(0), makersUntil: ts(H), leadersUntil: ts(2 * H) };
    await assertSucceeds(setDoc(doc(as("pasteur"), "services/new"), s));
    await assertFails(setDoc(doc(as("berger"), "services/new2"), s));
    await assertFails(setDoc(doc(as("pasteurdla"), "services/new3"), s));
  });
});

describe("enregistrement des nouvelles âmes", () => {
  it("le faiseur d'une famille de service enregistre dans le pool, le jour même", async () => {
    const until = ts(6 * H);
    await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), "services/today_amour"), { makersUntil: until }); });
    await assertSucceeds(setDoc(doc(as("grace"), "souls/n1"), newSoul("grace", { makersUntil: until })));
    // Pas pour lui-même : l'âme va dans « À attribuer ».
    await assertFails(setDoc(doc(as("grace"), "souls/n2"), newSoul("grace", { makersUntil: until, makerId: "grace" })));
  });
  it("une famille qui ne sert pas, ou après la fenêtre, ne peut pas enregistrer", async () => {
    await assertFails(setDoc(doc(as("eric"), "souls/n3"), newSoul("eric", { familyId: "foi", serviceId: "past_foi" })));
    await assertFails(setDoc(doc(as("eric"), "souls/n4"), newSoul("eric", { familyId: "foi", serviceId: "today_amour" })));
    await assertFails(setDoc(doc(as("grace"), "souls/n5"), newSoul("grace", { serviceId: "yesterday_amour" })));
  });
  it("berger et assistant ont jusqu'au lundi midi", async () => {
    await assertSucceeds(setDoc(doc(as("berger"), "souls/n6"), newSoul("berger", { serviceId: "yesterday_amour" })));
    await assertSucceeds(setDoc(doc(as("assist"), "souls/n7"), newSoul("assist", { serviceId: "yesterday_amour" })));
  });
  it("le pasteur enregistre à tout moment", async () => {
    await assertSucceeds(setDoc(doc(as("pasteur"), "souls/n8"), newSoul("pasteur", { serviceId: "past_foi", familyId: "foi" })));
  });
});

describe("faiseur", () => {
  it("voit ses âmes et celles qu'il a enregistrées aujourd'hui, rien d'autre", async () => {
    const db = as("grace");
    await assertSucceeds(getDoc(doc(db, "souls/s1")));
    await assertSucceeds(getDoc(doc(db, "souls/pool")));
    await assertFails(getDoc(doc(db, "souls/s2")));
    await assertFails(getDoc(doc(db, "souls/s3")));
    await assertSucceeds(getDocs(query(collection(db, "souls"), where("campusId", "==", "yde"), where("makerId", "==", "grace"))));
    await assertSucceeds(getDocs(query(collection(db, "souls"), where("campusId", "==", "yde"), where("createdBy", "==", "grace"), where("makersUntil", ">", ts(10 * 60_000)))));
    await assertFails(getDocs(query(collection(db, "souls"), where("campusId", "==", "yde"), where("createdBy", "==", "grace"))));
    await assertFails(getDocs(query(collection(db, "souls"), where("campusId", "==", "yde"), where("familyId", "==", "amour"))));
  });
  it("ne s'attribue pas une âme et ne change pas de rôle", async () => {
    await assertFails(updateDoc(doc(as("grace"), "souls/pool"), { makerId: "grace" }));
    await assertFails(updateDoc(doc(as("grace"), "souls/s2"), { makerId: "grace" }));
    await assertFails(updateDoc(doc(as("grace"), "users/grace"), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(as("grace"), "souls/s1"), { "steps.regularite": { date: "2026-11-22", by: "grace" } }));
  });
  it("pointe ses âmes uniquement", async () => {
    const a = (soulId: string) => ({ campusId: "yde", soulId, familyId: "amour", makerId: "grace", date: "2026-11-22", present: true });
    await assertSucceeds(setDoc(doc(as("grace"), "attendances/a1"), a("s1")));
    await assertFails(setDoc(doc(as("grace"), "attendances/a2"), a("s2")));
  });
  it("un compte désactivé ne lit plus rien", async () => {
    await assertFails(getDocs(query(collection(as("off"), "souls"), where("campusId", "==", "yde"), where("makerId", "==", "off"))));
  });
});

describe("berger et assistant", () => {
  it("attribuent les âmes de leur famille et notifient le faiseur", async () => {
    await assertSucceeds(updateDoc(doc(as("assist"), "souls/pool"), { makerId: "paul" }));
    await assertSucceeds(setDoc(doc(as("assist"), "notifications/n2"), { campusId: "yde", userId: "paul", by: "assist", read: false, title: "Nouvelle âme" }));
    await assertFails(updateDoc(doc(as("berger"), "souls/s3"), { makerId: "grace" }));
  });
  it("le faiseur ne peut pas envoyer de notification", async () => {
    await assertFails(setDoc(doc(as("grace"), "notifications/n3"), { campusId: "yde", userId: "paul", by: "grace", read: false, title: "x" }));
  });
  it("le berger nomme un assistant, l'assistant ne peut pas", async () => {
    await assertSucceeds(updateDoc(doc(as("berger"), "users/paul"), { role: "assistant" }));
    await assertFails(updateDoc(doc(as("assist"), "users/grace"), { role: "assistant" }));
    await assertFails(updateDoc(doc(as("berger"), "users/eric"), { role: "assistant" }));
    await assertFails(updateDoc(doc(as("berger"), "users/paul"), { role: "shepherd" }));
  });
  it("le berger invite des faiseurs dans sa famille seulement", async () => {
    const inv = (familyId: string, role = "maker") => ({ campusId: "yde", name: "N", email: "n@x.cm", role, familyId, usedBy: null });
    await assertSucceeds(setDoc(doc(as("berger"), "invitations/i1"), inv("amour")));
    await assertFails(setDoc(doc(as("berger"), "invitations/i2"), inv("foi")));
    await assertFails(setDoc(doc(as("berger"), "invitations/i3"), inv("amour", "shepherd")));
  });
});

describe("notifications", () => {
  it("chacun lit et marque comme lues seulement les siennes", async () => {
    await assertSucceeds(getDoc(doc(as("grace"), "notifications/n1")));
    await assertFails(getDoc(doc(as("paul"), "notifications/n1")));
    await assertSucceeds(updateDoc(doc(as("grace"), "notifications/n1"), { read: true }));
    await assertFails(updateDoc(doc(as("grace"), "notifications/n1"), { title: "changé" }));
  });
});

describe("rapports du lundi", () => {
  const rep = (makerId: string, familyId = "amour") => ({ campusId: "yde", familyId, makerId, week: "2026-11-22", comment: "" });
  it("le faiseur envoie son rapport, le berger le lit, un autre faiseur non", async () => {
    await assertSucceeds(setDoc(doc(as("grace"), "reports/r1"), rep("grace")));
    await assertFails(setDoc(doc(as("grace"), "reports/r2"), rep("paul")));
    await assertSucceeds(getDoc(doc(as("berger"), "reports/r1")));
    await assertFails(getDoc(doc(as("paul"), "reports/r1")));
    await assertFails(getDoc(doc(as("eric"), "reports/r1")));
  });
  it("le berger envoie le rapport compilé au pasteur", async () => {
    const fr = { campusId: "yde", familyId: "amour", sentBy: "berger", week: "2026-11-22", text: "" };
    await assertSucceeds(setDoc(doc(as("berger"), "familyReports/f1"), fr));
    await assertSucceeds(getDoc(doc(as("pasteur"), "familyReports/f1")));
    await assertFails(getDoc(doc(as("pasteurdla"), "familyReports/f1")));
    await assertFails(setDoc(doc(as("grace"), "familyReports/f2"), { ...fr, sentBy: "grace" }));
  });
});

describe("invitation et création de compte", () => {
  it("le nouveau compte reçoit exactement le rôle et le campus de l'invitation", async () => {
    const db = env.authenticatedContext("newbie", { email: "new@x.cm" }).firestore();
    const { writeBatch } = await import("firebase/firestore");
    const bad = writeBatch(db);
    bad.set(doc(db, "users/newbie"), { name: "N", email: "new@x.cm", role: "admin", campusId: "yde", familyId: "amour", active: true, inviteId: "tok1" });
    bad.update(doc(db, "invitations/tok1"), { usedBy: "newbie", usedAt: Timestamp.now() });
    await assertFails(bad.commit());
    const ok = writeBatch(db);
    ok.set(doc(db, "users/newbie"), { name: "N", email: "new@x.cm", role: "maker", campusId: "yde", familyId: "amour", active: true, inviteId: "tok1" });
    ok.update(doc(db, "invitations/tok1"), { usedBy: "newbie", usedAt: Timestamp.now() });
    await assertSucceeds(ok.commit());
  });
  it("seul l'administrateur de l'application supprime une âme", async () => {
    await assertFails(deleteDoc(doc(as("berger"), "souls/s1")));
    await assertSucceeds(deleteDoc(doc(as("pasteur"), "souls/s1")));
  });
});
