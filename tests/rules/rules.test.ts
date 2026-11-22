import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, writeBatch, collection, getDocs, query, where, deleteDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-disciply",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 }
  });
});
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "meta/bootstrap"), { adminId: "admin" });
    await setDoc(doc(db, "families/amour"), { name: "Amour", shepherdId: "berger" });
    await setDoc(doc(db, "families/foi"), { name: "Foi", shepherdId: null });
    await setDoc(doc(db, "users/admin"), { name: "Admin", email: "a@x.cm", role: "admin", familyId: null, active: true });
    await setDoc(doc(db, "users/berger"), { name: "Berger", email: "b@x.cm", role: "shepherd", familyId: "amour", active: true });
    await setDoc(doc(db, "users/grace"), { name: "Grâce", email: "g@x.cm", role: "maker", familyId: "amour", active: true });
    await setDoc(doc(db, "users/paul"), { name: "Paul", email: "p@x.cm", role: "maker", familyId: "amour", active: true });
    await setDoc(doc(db, "users/eric"), { name: "Éric", email: "e@x.cm", role: "maker", familyId: "foi", active: true });
    await setDoc(doc(db, "users/off"), { name: "Off", email: "o@x.cm", role: "maker", familyId: "amour", active: false });
    await setDoc(doc(db, "souls/s1"), { name: "Brigitte", familyId: "amour", makerId: "grace", state: "active", steps: {} });
    await setDoc(doc(db, "souls/s2"), { name: "Junior", familyId: "amour", makerId: "paul", state: "active", steps: {} });
    await setDoc(doc(db, "souls/s3"), { name: "Hervé", familyId: "foi", makerId: "eric", state: "active", steps: {} });
    await setDoc(doc(db, "invitations/tok1"), { name: "Nouveau", email: "new@x.cm", role: "maker", familyId: "amour", usedBy: null });
  });
});

const as = (uid: string, email?: string) => env.authenticatedContext(uid, { email: email ?? `${uid}@x.cm` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe("visiteur non connecté", () => {
  it("ne lit ni les âmes ni les profils", async () => {
    await assertFails(getDoc(doc(anon(), "souls/s1")));
    await assertFails(getDocs(collection(anon(), "users")));
    await assertFails(getDocs(collection(anon(), "souls")));
  });
  it("peut lire une invitation par son lien, mais pas la liste", async () => {
    await assertSucceeds(getDoc(doc(anon(), "invitations/tok1")));
    await assertFails(getDocs(collection(anon(), "invitations")));
  });
});

describe("faiseur", () => {
  it("lit ses âmes, pas celles des autres", async () => {
    const db = as("grace");
    await assertSucceeds(getDoc(doc(db, "souls/s1")));
    await assertFails(getDoc(doc(db, "souls/s2")));
    await assertFails(getDoc(doc(db, "souls/s3")));
    await assertSucceeds(getDocs(query(collection(db, "souls"), where("makerId", "==", "grace"))));
    await assertFails(getDocs(query(collection(db, "souls"), where("familyId", "==", "amour"))));
  });
  it("crée une âme pour lui-même dans sa famille seulement", async () => {
    const db = as("grace");
    await assertSucceeds(setDoc(doc(db, "souls/n1"), { name: "X", familyId: "amour", makerId: "grace", state: "active", steps: {} }));
    await assertFails(setDoc(doc(db, "souls/n2"), { name: "X", familyId: "foi", makerId: "grace", state: "active", steps: {} }));
    await assertFails(setDoc(doc(db, "souls/n3"), { name: "X", familyId: "amour", makerId: "paul", state: "active", steps: {} }));
  });
  it("ne peut pas se réattribuer l'âme d'un autre ni changer la famille", async () => {
    const db = as("grace");
    await assertFails(updateDoc(doc(db, "souls/s2"), { makerId: "grace" }));
    await assertFails(updateDoc(doc(db, "souls/s1"), { familyId: "foi" }));
    await assertSucceeds(updateDoc(doc(db, "souls/s1"), { "steps.regularite": { date: "2026-11-22", by: "grace" } }));
  });
  it("pointe ses âmes uniquement", async () => {
    const db = as("grace");
    await assertSucceeds(setDoc(doc(db, "attendances/2026-11-22_s1"), { soulId: "s1", familyId: "amour", makerId: "grace", date: "2026-11-22", present: true }));
    await assertFails(setDoc(doc(db, "attendances/2026-11-22_s2"), { soulId: "s2", familyId: "amour", makerId: "grace", date: "2026-11-22", present: true }));
  });
  it("ne supprime jamais une âme et ne change pas son rôle", async () => {
    const db = as("grace");
    await assertFails(deleteDoc(doc(db, "souls/s1")));
    await assertFails(updateDoc(doc(db, "users/grace"), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(db, "users/grace"), { phone: "699" }));
  });
  it("écrit des notes sur ses âmes seulement", async () => {
    const db = as("grace");
    await assertSucceeds(setDoc(doc(db, "souls/s1/notes/n1"), { text: "ok", authorId: "grace", authorName: "Grâce" }));
    await assertFails(setDoc(doc(db, "souls/s2/notes/n1"), { text: "ok", authorId: "grace", authorName: "Grâce" }));
    await assertFails(setDoc(doc(db, "souls/s1/notes/n2"), { text: "ok", authorId: "paul", authorName: "Paul" }));
  });
});

describe("compte désactivé", () => {
  it("ne lit plus rien", async () => {
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "souls/s9"), { name: "Z", familyId: "amour", makerId: "off", state: "active" }); });
    await assertFails(getDoc(doc(as("off"), "souls/s9")));
    await assertFails(getDoc(doc(as("off"), "families/amour")));
  });
});

describe("berger", () => {
  it("voit et gère toute sa famille, pas les autres", async () => {
    const db = as("berger");
    await assertSucceeds(getDoc(doc(db, "souls/s2")));
    await assertFails(getDoc(doc(db, "souls/s3")));
    await assertSucceeds(getDocs(query(collection(db, "souls"), where("familyId", "==", "amour"))));
    await assertSucceeds(updateDoc(doc(db, "souls/s1"), { makerId: "paul" }));
    await assertFails(updateDoc(doc(db, "souls/s3"), { makerId: "paul" }));
  });
  it("peut transférer une âme vers une autre famille", async () => {
    await assertSucceeds(updateDoc(doc(as("berger"), "souls/s1"), { familyId: "foi", makerId: null }));
  });
  it("invite des faiseurs dans sa famille seulement", async () => {
    const db = as("berger");
    await assertSucceeds(setDoc(doc(db, "invitations/t2"), { name: "A", email: "a2@x.cm", role: "maker", familyId: "amour", usedBy: null }));
    await assertFails(setDoc(doc(db, "invitations/t3"), { name: "A", email: "a3@x.cm", role: "shepherd", familyId: "amour", usedBy: null }));
    await assertFails(setDoc(doc(db, "invitations/t4"), { name: "A", email: "a4@x.cm", role: "maker", familyId: "foi", usedBy: null }));
  });
  it("ne modifie pas les réglages ni les familles", async () => {
    const db = as("berger");
    await assertFails(setDoc(doc(db, "settings/global"), { churchName: "X" }));
    await assertFails(updateDoc(doc(db, "families/amour"), { name: "Y" }));
  });
});

describe("responsable", () => {
  it("lit et modifie tout", async () => {
    const db = as("admin");
    await assertSucceeds(getDocs(collection(db, "souls")));
    await assertSucceeds(getDocs(collection(db, "users")));
    await assertSucceeds(setDoc(doc(db, "settings/global"), { churchName: "ICC" }));
    await assertSucceeds(updateDoc(doc(db, "users/grace"), { role: "shepherd" }));
    await assertSucceeds(deleteDoc(doc(db, "souls/s3")));
  });
});

describe("inscription", () => {
  it("accepte une invitation valide avec le bon e-mail", async () => {
    const db = as("newuid", "new@x.cm");
    const b = writeBatch(db);
    b.set(doc(db, "users/newuid"), { name: "Nouveau", email: "new@x.cm", role: "maker", familyId: "amour", active: true, inviteId: "tok1" });
    b.update(doc(db, "invitations/tok1"), { usedBy: "newuid" });
    await assertSucceeds(b.commit());
  });
  it("refuse un autre e-mail, un autre rôle ou une invitation déjà utilisée", async () => {
    const wrong = as("u2", "autre@x.cm");
    const b1 = writeBatch(wrong);
    b1.set(doc(wrong, "users/u2"), { name: "X", email: "autre@x.cm", role: "maker", familyId: "amour", active: true, inviteId: "tok1" });
    b1.update(doc(wrong, "invitations/tok1"), { usedBy: "u2" });
    await assertFails(b1.commit());

    const db = as("u3", "new@x.cm");
    const b2 = writeBatch(db);
    b2.set(doc(db, "users/u3"), { name: "X", email: "new@x.cm", role: "admin", familyId: "amour", active: true, inviteId: "tok1" });
    b2.update(doc(db, "invitations/tok1"), { usedBy: "u3" });
    await assertFails(b2.commit());

    await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), "invitations/tok1"), { usedBy: "someone" }); });
    const b3 = writeBatch(db);
    b3.set(doc(db, "users/u3"), { name: "X", email: "new@x.cm", role: "maker", familyId: "amour", active: true, inviteId: "tok1" });
    b3.update(doc(db, "invitations/tok1"), { usedBy: "u3" });
    await assertFails(b3.commit());
  });
  it("refuse de se créer un profil sans invitation", async () => {
    await assertFails(setDoc(doc(as("hacker"), "users/hacker"), { name: "H", email: "hacker@x.cm", role: "admin", familyId: null, active: true }));
  });
  it("installation : le premier responsable seulement, une seule fois", async () => {
    await env.withSecurityRulesDisabled(async ctx => { await deleteDoc(doc(ctx.firestore(), "meta/bootstrap")); });
    const db = as("first", "first@x.cm");
    const b = writeBatch(db);
    b.set(doc(db, "users/first"), { name: "F", email: "first@x.cm", role: "admin", familyId: null, active: true });
    b.set(doc(db, "meta/bootstrap"), { adminId: "first" });
    await assertSucceeds(b.commit());

    const db2 = as("second", "second@x.cm");
    const b2 = writeBatch(db2);
    b2.set(doc(db2, "users/second"), { name: "S", email: "second@x.cm", role: "admin", familyId: null, active: true });
    b2.set(doc(db2, "meta/bootstrap"), { adminId: "second" });
    await assertFails(b2.commit());
  });
});
