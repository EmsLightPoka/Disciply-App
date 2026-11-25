import type { Timestamp } from "firebase/firestore";

export type Role = "master" | "pastor" | "admin" | "shepherd" | "assistant" | "maker";
export const ROLE_LABEL: Record<Role, string> = {
  master: "Super admin",
  pastor: "Pasteur principal",
  admin: "Leader du campus",
  shepherd: "Berger de famille (BG)",
  assistant: "Assistant berger",
  maker: "Faiseur de disciples"
};
/** Berger ou assistant : gèrent la famille. */
export const isLeader = (r?: Role) => r === "shepherd" || r === "assistant";
/** Pasteur du campus ou administrateur de l'application. */
export const isCampusAdmin = (r?: Role) => r === "admin" || r === "master" || r === "pastor";
/** Super admin ou pasteur principal : voient tous les campus. */
export const isGlobal = (r?: Role) => r === "master" || r === "pastor";

export interface Campus { id: string; name: string; city?: string; }

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  campusId: string | null;
  familyId: string | null;
  gender?: "F" | "H";
  /** Âge du faiseur : on lui confie de préférence des âmes de sa tranche d'âge. */
  age?: number | null;
  active: boolean;
  theme?: "light" | "dark" | "system";
  inviteId?: string;
  createdAt?: Timestamp;
}

export interface Family {
  id: string;
  campusId: string;
  name: string;
  shepherdId?: string | null;
}

export interface Step {
  id: string;
  label: string;
  description: string;
  detailLabel?: string;
}

export interface Settings {
  churchName: string;
  absenceThreshold: number;
  steps: Step[];
  absenceReasons: string[];
  exitReasons: string[];
  services: string[];
  formations: string[];
  difficulties: string[];
}

/** Une famille qui sert à un culte donné. Les fenêtres d'enregistrement sont calculées à la saisie du programme. */
export interface ServiceSlot {
  id: string;
  campusId: string;
  date: string;          // AAAA-MM-JJ
  slot: string;          // ex. « 1er culte »
  familyId: string;
  opensAt: Timestamp;    // début du jour du culte
  makersUntil: Timestamp; // fin du jour du culte : limite pour les faiseurs
  leadersUntil: Timestamp; // lundi midi : limite pour le berger et l'assistant
}

export interface FormationRecord { status: "started" | "done"; date: string; }

export interface Notification {
  id: string;
  campusId: string;
  userId: string;
  kind: "assigned" | "report" | "info";
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt?: Timestamp;
  by: string;
}

export interface MakerReport {
  id: string;            // semaine_faiseur
  campusId: string;
  familyId: string;
  makerId: string;
  makerName: string;
  week: string;          // dimanche de la semaine
  souls: number;
  present: number;
  absent: number;
  notPointed: number;
  /** Âmes « E » : en attente, pas encore de retour. */
  pending?: number;
  newAssigned: number;
  difficulties: { soulName: string; text: string }[];
  formations: { soulName: string; text: string }[];
  comment: string;
  submittedAt?: Timestamp;
  /** Dernière mise à jour par le complément du jeudi. */
  complementAt?: Timestamp;
}

export interface FamilyReport {
  id: string;            // semaine_famille
  campusId: string;
  familyId: string;
  familyName: string;
  week: string;
  text: string;
  totals: { souls: number; present: number; absent: number; pending?: number; newSouls: number; reports: number; makers: number };
  comment: string;
  sentBy: string;
  sentByName: string;
  sentAt?: Timestamp;
}

export type SoulStatus = "NC" | "NA";
export type SoulState = "active" | "exited" | "established";

export interface StepRecord {
  date: string; // AAAA-MM-JJ
  by: string;
  detail?: string;
}

export interface HistoryEntry {
  at: string;
  by: string;
  text: string;
}

export interface Soul {
  id: string;
  name: string;
  phone: string;
  gender: "F" | "H";
  neighborhood: string;
  status: SoulStatus;
  service: string;
  arrivalDate: string;
  familyId: string;
  makerId: string | null;
  state: SoulState;
  steps: Record<string, StepRecord>;
  campusId: string;
  serviceId?: string;
  makersUntil?: Timestamp;
  formations?: Record<string, FormationRecord>;
  difficulty?: { kind: string; text: string; at: string } | null;
  exitReason?: string;
  exitDate?: string;
  inviter?: string;
  /** Moins de 25 ans : peut aller dans une famille d'impact jeunes (mardi). */
  young?: boolean;
  age?: number | null;
  impactFamilyId?: string | null;
  history?: HistoryEntry[];
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/** Famille d'impact (FI, le jeudi) ou famille d'impact jeunes (FIJ, moins de 25 ans, le mardi). */
export interface ImpactFamily {
  id: string;
  campusId: string;
  name: string;
  kind: "FI" | "FIJ";
  quartiers: string[];
  address?: string;
  pilotName: string;
  pilotPhone: string;
  hostName: string;
  hostPhone: string;
}
export const IMPACT_LABEL = { FI: "Famille d'impact · jeudi", FIJ: "Famille d'impact jeunes · mardi" } as const;

export interface Attendance {
  id: string;
  campusId: string;
  soulId: string;
  familyId: string;
  makerId: string | null;
  date: string;
  present: boolean;
  /** « E » : en attente, pas encore de retour (à confirmer au complément du jeudi). */
  pending?: boolean;
  reason?: string;
  by: string;
}

export interface Note {
  id: string;
  kind?: "note" | "difficulty" | "formation" | "call";
  text: string;
  authorId: string;
  authorName: string;
  createdAt?: Timestamp;
}

export interface Invitation {
  id: string;
  name: string;
  email: string;
  role: Role;
  campusId: string | null;
  campusName?: string;
  gender?: "F" | "H";
  familyId: string | null;
  familyName?: string;
  createdBy: string;
  createdByName: string;
  createdAt?: Timestamp;
  usedBy: string | null;
  usedAt?: Timestamp;
}

export const DEFAULT_SETTINGS: Settings = {
  churchName: "Impact Centre Chrétien Yaoundé",
  absenceThreshold: 3,
  // Ordre provisoire, à confirmer : modifiable dans Réglages.
  steps: [
    { id: "regularite", label: "Régularité", description: "Présente 4 dimanches de suite" },
    { id: "famille-impact", label: "Famille d'impact", description: "Intégrée à une famille d'impact", detailLabel: "Famille d'impact" },
    { id: "bapteme", label: "Baptême", description: "Baptisée par immersion" },
    { id: "service", label: "Service", description: "Sert dans un département", detailLabel: "Département" },
    { id: "pcnc", label: "PCNC", description: "Parcours de formation", detailLabel: "Niveau" }
  ],
  absenceReasons: ["Malade", "En voyage", "Travail", "Injoignable", "Autre culte", "Autre raison"],
  exitReasons: ["Déménagement", "Injoignable", "A rejoint une autre église", "Ne souhaite plus être suivie", "En intercession", "Autre raison"],
  services: ["1er culte", "2e culte", "3e culte", "Culte EJP"],
  formations: ["Académie 101", "Académie 201", "Académie 301", "PCNC"],
  difficulties: ["Problème de santé", "Difficulté financière", "Problème familial", "Doute spirituel", "Opposition de l'entourage", "Éloignement géographique", "Autre"]
};
