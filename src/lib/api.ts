import {
  addDoc, arrayUnion, collection, deleteField, doc, serverTimestamp, setDoc, updateDoc, writeBatch
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "./firebase";
import type { Invitation, Role, Settings, Soul, UserProfile } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { today } from "./dates";

const stamp = (uid: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid });
const hist = (by: string, text: string) => arrayUnion({ at: new Date().toISOString(), by, text });

// ---------- Comptes ----------
export async function bootstrapAdmin(name: string, email: string, password: string, churchName: string) {
  // Si une première tentative a créé le compte sans finir l'installation, on reprend avec ce compte.
  const user = auth.currentUser && auth.currentUser.email?.toLowerCase() === email.toLowerCase()
    ? auth.currentUser : (await createUserWithEmailAndPassword(auth, email, password)).user;
  await updateProfile(user, { displayName: name });
  const cred = { user };
  const b = writeBatch(db);
  b.set(doc(db, "users", cred.user.uid), { name, email, role: "admin", familyId: null, active: true, createdAt: serverTimestamp() });
  b.set(doc(db, "meta", "bootstrap"), { adminId: cred.user.uid, at: serverTimestamp() });
  await b.commit();
  await setDoc(doc(db, "settings", "global"), { ...DEFAULT_SETTINGS, churchName });
}

export async function acceptInvitation(inv: Invitation, name: string, phone: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, inv.email, password);
  await updateProfile(cred.user, { displayName: name });
  const b = writeBatch(db);
  b.set(doc(db, "users", cred.user.uid), {
    name, email: inv.email, phone, role: inv.role, familyId: inv.familyId, active: true, inviteId: inv.id, createdAt: serverTimestamp()
  });
  b.update(doc(db, "invitations", inv.id), { usedBy: cred.user.uid, usedAt: serverTimestamp() });
  await b.commit();
}

function randomId(len = 24) {
  const a = new Uint8Array(len); crypto.getRandomValues(a);
  return Array.from(a, x => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 56]).join("");
}

export async function createInvitation(me: UserProfile, data: { name: string; email: string; role: Role; familyId: string | null; familyName?: string }) {
  const id = randomId();
  await setDoc(doc(db, "invitations", id), {
    ...data, email: data.email.trim().toLowerCase(), createdBy: me.id, createdByName: me.name, createdAt: serverTimestamp(), usedBy: null
  });
  return id;
}
export const inviteLink = (id: string) => `${location.origin}/invitation/${id}`;

export const updateUser = (id: string, data: Partial<UserProfile>) => updateDoc(doc(db, "users", id), data);

// ---------- Réglages et familles ----------
export const saveSettings = (s: Settings) => setDoc(doc(db, "settings", "global"), s);
export const createFamily = (name: string, shepherdId: string | null) => addDoc(collection(db, "families"), { name, shepherdId });
export const updateFamily = (id: string, data: { name?: string; shepherdId?: string | null }) => updateDoc(doc(db, "families", id), data);

// ---------- Âmes ----------
export async function createSoul(uid: string, data: Omit<Soul, "id" | "steps" | "state" | "history">) {
  return addDoc(collection(db, "souls"), {
    ...data, steps: {}, state: "active", history: [{ at: new Date().toISOString(), by: uid, text: "Âme enregistrée" }],
    createdAt: serverTimestamp(), createdBy: uid, ...stamp(uid)
  });
}
export const updateSoul = (uid: string, id: string, data: Partial<Soul>) => updateDoc(doc(db, "souls", id), { ...data, ...stamp(uid) });

export const validateStep = (uid: string, soulId: string, stepId: string, label: string, date: string, detail?: string) =>
  updateDoc(doc(db, "souls", soulId), {
    [`steps.${stepId}`]: { date, by: uid, ...(detail ? { detail } : {}) }, history: hist(uid, `Étape validée : ${label}`), ...stamp(uid)
  });
export const cancelStep = (uid: string, soulId: string, stepId: string, label: string) =>
  updateDoc(doc(db, "souls", soulId), { [`steps.${stepId}`]: deleteField(), history: hist(uid, `Étape annulée : ${label}`), ...stamp(uid) });

export const assignSoul = (uid: string, soulId: string, makerId: string | null, makerName: string) =>
  updateDoc(doc(db, "souls", soulId), { makerId, history: hist(uid, makerId ? `Confiée à ${makerName}` : "Retirée de son faiseur"), ...stamp(uid) });

export const transferSoul = (uid: string, soulId: string, familyId: string, familyName: string) =>
  updateDoc(doc(db, "souls", soulId), { familyId, makerId: null, history: hist(uid, `Transférée vers la famille ${familyName}`), ...stamp(uid) });

export const exitSoul = (uid: string, soulId: string, reason: string) =>
  updateDoc(doc(db, "souls", soulId), { state: "exited", exitReason: reason, exitDate: today(), history: hist(uid, `Sortie du suivi : ${reason}`), ...stamp(uid) });

export const establishSoul = (uid: string, soulId: string) =>
  updateDoc(doc(db, "souls", soulId), { state: "established", exitDate: today(), history: hist(uid, "Disciple affermi"), ...stamp(uid) });

export const reinstateSoul = (uid: string, soulId: string, makerId: string | null) =>
  updateDoc(doc(db, "souls", soulId), { state: "active", makerId, exitReason: deleteField(), exitDate: deleteField(), history: hist(uid, "Réintégrée dans le suivi"), ...stamp(uid) });

export const addNote = (soulId: string, authorId: string, authorName: string, text: string) =>
  addDoc(collection(db, "souls", soulId, "notes"), { text, authorId, authorName, createdAt: serverTimestamp() });

// ---------- Présences ----------
// Écriture sans attendre le serveur : la promesse se résout quand le serveur confirme, mais le cache local est à jour tout de suite.
export function markAttendance(uid: string, soul: Soul, date: string, present: boolean, reason?: string) {
  return setDoc(doc(db, "attendances", `${date}_${soul.id}`), {
    soulId: soul.id, familyId: soul.familyId, makerId: soul.makerId, date, present, reason: present ? null : reason ?? null, by: uid, at: serverTimestamp()
  });
}
