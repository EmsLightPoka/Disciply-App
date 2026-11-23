import {
  addDoc, arrayUnion, collection, deleteDoc, deleteField, doc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "./firebase";
import type { FamilyReport, Invitation, MakerReport, Role, ServiceSlot, Settings, Soul, UserProfile } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { addDays, fromIso, today } from "./dates";

const stamp = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });
const hist = (by: string, text: string) => arrayUnion({ at: new Date().toISOString(), by, text });

// ---------- Installation et comptes ----------
/** Le tout premier compte : administrateur de l'application, avec le premier campus. */
export async function bootstrapMaster(name: string, email: string, password: string, campusName: string, city: string) {
  let user = auth.currentUser && auth.currentUser.email?.toLowerCase() === email.toLowerCase() ? auth.currentUser : null;
  if (!user) {
    try { user = (await createUserWithEmailAndPassword(auth, email, password)).user; }
    catch (e) {
      // Un essai précédent a pu créer le compte sans finir l'installation : on reprend avec le même mot de passe.
      if ((e as { code?: string }).code !== "auth/email-already-in-use") throw e;
      user = (await signInWithEmailAndPassword(auth, email, password)).user;
    }
  }
  await updateProfile(user, { displayName: name });
  const b = writeBatch(db);
  b.set(doc(db, "users", user.uid), { name, email, role: "master", campusId: null, familyId: null, active: true, createdAt: serverTimestamp() });
  b.set(doc(db, "meta", "bootstrap"), { masterId: user.uid, at: serverTimestamp() });
  await b.commit();
  const campusId = await createCampus(campusName, city);
  await updateDoc(doc(db, "users", user.uid), { campusId });
}

export async function createCampus(name: string, city: string) {
  const ref = await addDoc(collection(db, "campuses"), { name, city });
  await setDoc(doc(db, "settings", ref.id), { ...DEFAULT_SETTINGS, churchName: name });
  return ref.id;
}
export const switchCampus = (uid: string, campusId: string) => updateDoc(doc(db, "users", uid), { campusId });

export async function acceptInvitation(inv: Invitation, name: string, phone: string, gender: "F" | "H", password: string) {
  const cred = await createUserWithEmailAndPassword(auth, inv.email, password);
  await updateProfile(cred.user, { displayName: name });
  const b = writeBatch(db);
  b.set(doc(db, "users", cred.user.uid), {
    name, email: inv.email, phone, gender, role: inv.role, campusId: inv.campusId, familyId: inv.familyId,
    active: true, inviteId: inv.id, createdAt: serverTimestamp()
  });
  b.update(doc(db, "invitations", inv.id), { usedBy: cred.user.uid, usedAt: serverTimestamp() });
  await b.commit();
}

function randomId(len = 24) {
  const a = new Uint8Array(len); crypto.getRandomValues(a);
  return Array.from(a, x => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 56]).join("");
}

export async function createInvitation(me: UserProfile, data: {
  name: string; email: string; role: Role; campusId: string | null; campusName?: string; familyId: string | null; familyName?: string; gender?: "F" | "H";
}) {
  const id = randomId();
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  await setDoc(doc(db, "invitations", id), {
    ...clean, email: data.email.trim().toLowerCase(), createdBy: me.id, createdByName: me.name, createdAt: serverTimestamp(), usedBy: null
  });
  return id;
}
export const inviteLink = (id: string) => `${location.origin}/invitation/${id}`;
export const updateUser = (id: string, data: Partial<UserProfile>) => updateDoc(doc(db, "users", id), data);

// ---------- Réglages et familles ----------
export const saveSettings = (campusId: string, s: Settings) => setDoc(doc(db, "settings", campusId), s);
export const createFamily = (campusId: string, name: string, shepherdId: string | null) => addDoc(collection(db, "families"), { campusId, name, shepherdId });
export const updateFamily = (id: string, data: { name?: string; shepherdId?: string | null }) => updateDoc(doc(db, "families", id), data);

// ---------- Programme de service ----------
/** Fenêtres d'enregistrement : faiseurs jusqu'à la fin du jour du culte, berger et assistant jusqu'au lendemain midi. */
export function serviceWindows(date: string) {
  const start = fromIso(date);
  const makersUntil = fromIso(addDays(date, 1));
  const leadersUntil = new Date(makersUntil); leadersUntil.setHours(12);
  return { opensAt: Timestamp.fromDate(start), makersUntil: Timestamp.fromDate(makersUntil), leadersUntil: Timestamp.fromDate(leadersUntil) };
}
export const serviceDocId = (campusId: string, date: string, slotIndex: number, familyId: string) => `${campusId}_${date}_${slotIndex}_${familyId}`;
export async function addService(campusId: string, date: string, slot: string, slotIndex: number, familyId: string) {
  await setDoc(doc(db, "services", serviceDocId(campusId, date, slotIndex, familyId)), { campusId, date, slot, familyId, ...serviceWindows(date) });
}
export const removeService = (s: ServiceSlot) => deleteDoc(doc(db, "services", s.id));

// ---------- Âmes ----------
export async function createSoul(me: UserProfile, campusId: string, data: Omit<Soul, "id" | "steps" | "state" | "history" | "campusId">, service?: ServiceSlot) {
  return addDoc(collection(db, "souls"), {
    ...data, campusId, steps: {}, state: "active",
    ...(service ? { serviceId: service.id, makersUntil: service.makersUntil } : {}),
    history: [{ at: new Date().toISOString(), by: me.id, text: service ? `Enregistrée au ${service.slot} du ${service.date.split("-").reverse().join("/")}` : "Âme enregistrée" }],
    createdAt: serverTimestamp(), createdBy: me.id, ...stamp(me.id)
  });
}
export const updateSoul = (uid: string, id: string, data: Partial<Soul>) => updateDoc(doc(db, "souls", id), { ...data, ...stamp(uid) });

export const validateStep = (uid: string, soulId: string, stepId: string, label: string, date: string, detail?: string) =>
  updateDoc(doc(db, "souls", soulId), {
    [`steps.${stepId}`]: { date, by: uid, ...(detail ? { detail } : {}) }, history: hist(uid, `Étape validée : ${label}`), ...stamp(uid)
  });
export const cancelStep = (uid: string, soulId: string, stepId: string, label: string) =>
  updateDoc(doc(db, "souls", soulId), { [`steps.${stepId}`]: deleteField(), history: hist(uid, `Étape annulée : ${label}`), ...stamp(uid) });

export const setFormation = (uid: string, soulId: string, name: string, status: "started" | "done" | null) =>
  updateDoc(doc(db, "souls", soulId), {
    [`formations.${name}`]: status ? { status, date: today() } : deleteField(),
    history: hist(uid, status === "started" ? `Formation commencée : ${name}` : status === "done" ? `Formation terminée : ${name}` : `Formation retirée : ${name}`),
    ...stamp(uid)
  });

export async function reportDifficulty(me: UserProfile, soulId: string, kind: string, text: string) {
  await updateDoc(doc(db, "souls", soulId), { difficulty: { kind, text, at: today() }, history: hist(me.id, `Difficulté signalée : ${kind}`), ...stamp(me.id) });
  await addNote(soulId, me.id, me.name, `${kind}${text ? " : " + text : ""}`, "difficulty");
}
export const resolveDifficulty = (uid: string, soulId: string) =>
  updateDoc(doc(db, "souls", soulId), { difficulty: null, history: hist(uid, "Difficulté résolue"), ...stamp(uid) });

/** Attribue l'âme et prévient le faiseur dans l'app, avec les coordonnées de l'âme. */
export async function assignSoul(me: UserProfile, soul: Soul, maker: UserProfile | null) {
  const b = writeBatch(db);
  b.update(doc(db, "souls", soul.id), {
    makerId: maker?.id ?? null, history: hist(me.id, maker ? `Attribuée à ${maker.name}` : "Retirée de son faiseur"), ...stamp(me.id)
  });
  if (maker) {
    b.set(doc(collection(db, "notifications")), {
      campusId: soul.campusId, userId: maker.id, kind: "assigned", read: false, by: me.id, createdAt: serverTimestamp(),
      title: `Nouvelle âme : ${soul.name}`,
      body: [soul.phone && `Téléphone : ${soul.phone}`, soul.neighborhood && `Quartier : ${soul.neighborhood}`, `${soul.status === "NC" ? "Nouveau converti" : "Nouvel arrivant"}, ${soul.service}`].filter(Boolean).join(" · "),
      link: `/ames/${soul.id}`
    });
  }
  await b.commit();
}

export const transferSoul = (uid: string, soulId: string, familyId: string, familyName: string) =>
  updateDoc(doc(db, "souls", soulId), { familyId, makerId: null, history: hist(uid, `Transférée vers la famille ${familyName}`), ...stamp(uid) });
export const exitSoul = (uid: string, soulId: string, reason: string) =>
  updateDoc(doc(db, "souls", soulId), { state: "exited", exitReason: reason, exitDate: today(), history: hist(uid, `Sortie du suivi : ${reason}`), ...stamp(uid) });
export const establishSoul = (uid: string, soulId: string) =>
  updateDoc(doc(db, "souls", soulId), { state: "established", exitDate: today(), history: hist(uid, "Disciple affermi"), ...stamp(uid) });
export const reinstateSoul = (uid: string, soulId: string) =>
  updateDoc(doc(db, "souls", soulId), { state: "active", makerId: null, exitReason: deleteField(), exitDate: deleteField(), history: hist(uid, "Réintégrée dans le suivi"), ...stamp(uid) });

export const addNote = (soulId: string, authorId: string, authorName: string, text: string, kind: "note" | "difficulty" | "formation" | "call" = "note") =>
  addDoc(collection(db, "souls", soulId, "notes"), { text, kind, authorId, authorName, createdAt: serverTimestamp() });

// ---------- Présences ----------
export function markAttendance(uid: string, soul: Soul, date: string, present: boolean, reason?: string) {
  return setDoc(doc(db, "attendances", `${date}_${soul.id}`), {
    campusId: soul.campusId, soulId: soul.id, familyId: soul.familyId, makerId: soul.makerId, date, present,
    reason: present ? null : reason ?? null, by: uid, at: serverTimestamp()
  });
}

// ---------- Notifications ----------
export const markRead = (id: string) => updateDoc(doc(db, "notifications", id), { read: true });

// ---------- Rapports ----------
export const makerReportId = (week: string, makerId: string) => `${week}_${makerId}`;
export const submitMakerReport = (r: Omit<MakerReport, "id" | "submittedAt">) =>
  setDoc(doc(db, "reports", makerReportId(r.week, r.makerId)), { ...r, submittedAt: serverTimestamp() });

export const familyReportId = (week: string, familyId: string) => `${week}_${familyId}`;
export async function sendFamilyReport(r: Omit<FamilyReport, "id" | "sentAt">, pastors: UserProfile[]) {
  const b = writeBatch(db);
  b.set(doc(db, "familyReports", familyReportId(r.week, r.familyId)), { ...r, sentAt: serverTimestamp() });
  for (const p of pastors) {
    b.set(doc(collection(db, "notifications")), {
      campusId: r.campusId, userId: p.id, kind: "report", read: false, by: r.sentBy, createdAt: serverTimestamp(),
      title: `Rapport de la famille ${r.familyName}`, body: `Semaine du ${r.week.split("-").reverse().join("/")}, envoyé par ${r.sentByName}`, link: "/rapports"
    });
  }
  await b.commit();
}

/**
 * Le responsable crée lui-même le compte d'un ouvrier, avec son mot de passe, sans lien à envoyer.
 * Le compte est créé dans une seconde instance Firebase : le responsable reste connecté.
 * Le nouvel ouvrier accepte ensuite sa propre invitation, avec exactement les mêmes règles de sécurité qu'un lien.
 */
export async function createAccountNow(inv: Invitation, phone: string, password: string) {
  const { initializeApp, deleteApp } = await import("firebase/app");
  const { getAuth, connectAuthEmulator, signOut } = await import("firebase/auth");
  const { getFirestore, connectFirestoreEmulator } = await import("firebase/firestore");
  const { firebaseConfig, usingEmulators } = await import("./firebase");
  const second = initializeApp(firebaseConfig, `creation-${Date.now()}`);
  const a2 = getAuth(second); const d2 = getFirestore(second);
  if (usingEmulators) { connectAuthEmulator(a2, `http://${location.hostname}:9099`, { disableWarnings: true }); connectFirestoreEmulator(d2, location.hostname, 8080); }
  try {
    const cred = await createUserWithEmailAndPassword(a2, inv.email, password);
    await updateProfile(cred.user, { displayName: inv.name });
    const b = writeBatch(d2);
    b.set(doc(d2, "users", cred.user.uid), {
      name: inv.name, email: inv.email, phone, gender: inv.gender ?? null, role: inv.role, campusId: inv.campusId, familyId: inv.familyId,
      active: true, inviteId: inv.id, createdAt: serverTimestamp()
    });
    b.update(doc(d2, "invitations", inv.id), { usedBy: cred.user.uid, usedAt: serverTimestamp() });
    await b.commit();
    await signOut(a2);
  } finally { await deleteApp(second); }
}
