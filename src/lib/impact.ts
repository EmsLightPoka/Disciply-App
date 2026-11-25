import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { ImpactFamily, Soul } from "./types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Les familles d'impact proposées pour une âme, la plus proche d'abord :
 * même quartier en premier, puis quartier approchant ; FI jeunes en tête pour les moins de 25 ans.
 */
export function suggestImpact(soul: Pick<Soul, "neighborhood" | "young">, list: ImpactFamily[]) {
  const q = norm(soul.neighborhood ?? "");
  const score = (f: ImpactFamily) => {
    let sc = 0;
    for (const x of f.quartiers.map(norm)) {
      if (!q || !x) continue;
      if (x === q) sc = Math.max(sc, 3);
      else if (x.includes(q) || q.includes(x)) sc = Math.max(sc, 2);
      else if (x.split(" ").some(w => w.length > 3 && q.split(" ").includes(w))) sc = Math.max(sc, 1);
    }
    return sc;
  };
  const wanted = soul.young ? "FIJ" : "FI";
  return list
    .map(f => ({ f, near: score(f) }))
    .sort((a, b) => (b.near - a.near) || (Number(b.f.kind === wanted) - Number(a.f.kind === wanted)) || a.f.name.localeCompare(b.f.name, "fr"));
}

export type ImpactData = Omit<ImpactFamily, "id">;
export const createImpact = (d: ImpactData) => addDoc(collection(db, "impactFamilies"), d);
export const updateImpact = (id: string, d: Partial<ImpactData>) => updateDoc(doc(db, "impactFamilies", id), d);
export const deleteImpact = (id: string) => deleteDoc(doc(db, "impactFamilies", id));

/** Exemples fictifs pour le campus de démonstration. */
export const DEMO_IMPACT: Omit<ImpactData, "campusId">[] = [
  { name: "FI Bastos", kind: "FI", quartiers: ["Bastos", "Etoudi"], pilotName: "Pilote Bastos", pilotPhone: "690000101", hostName: "Hôte Bastos", hostPhone: "690000102" },
  { name: "FI Essos", kind: "FI", quartiers: ["Essos", "Mimboman"], pilotName: "Pilote Essos", pilotPhone: "690000201", hostName: "Hôte Essos", hostPhone: "690000202" },
  { name: "FI Biyem-Assi", kind: "FI", quartiers: ["Biyem-Assi", "Mendong"], pilotName: "Pilote Biyem-Assi", pilotPhone: "690000301", hostName: "Hôte Biyem-Assi", hostPhone: "690000302" },
  { name: "FI Ngousso", kind: "FI", quartiers: ["Ngousso", "Emana", "Omnisport"], pilotName: "Pilote Ngousso", pilotPhone: "690000401", hostName: "Hôte Ngousso", hostPhone: "690000402" },
  { name: "FI Odza", kind: "FI", quartiers: ["Odza", "Mvog-Mbi", "Nkolbisson"], pilotName: "Pilote Odza", pilotPhone: "690000501", hostName: "Hôte Odza", hostPhone: "690000502" },
  { name: "FI Jeunes Centre", kind: "FIJ", quartiers: ["Bastos", "Essos", "Ngousso", "Emana", "Omnisport", "Etoudi", "Mimboman"], pilotName: "Pilote Jeunes Centre", pilotPhone: "690000601", hostName: "Hôte Jeunes Centre", hostPhone: "690000602" },
  { name: "FI Jeunes Sud", kind: "FIJ", quartiers: ["Biyem-Assi", "Mendong", "Odza", "Mvog-Mbi", "Nkolbisson"], pilotName: "Pilote Jeunes Sud", pilotPhone: "690000701", hostName: "Hôte Jeunes Sud", hostPhone: "690000702" }
];
