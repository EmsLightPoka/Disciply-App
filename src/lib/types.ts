import type { Timestamp } from "firebase/firestore";

export type Role = "admin" | "shepherd" | "maker";
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Responsable général",
  shepherd: "Berger de famille",
  maker: "Faiseur de disciples"
};

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  familyId: string | null;
  active: boolean;
  theme?: "light" | "dark" | "system";
  inviteId?: string;
  createdAt?: Timestamp;
}

export interface Family {
  id: string;
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
  exitReason?: string;
  exitDate?: string;
  inviter?: string;
  history?: HistoryEntry[];
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface Attendance {
  id: string;
  soulId: string;
  familyId: string;
  makerId: string | null;
  date: string;
  present: boolean;
  reason?: string;
  by: string;
}

export interface Note {
  id: string;
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
  services: ["1er culte", "2e culte", "3e culte", "Culte EJP"]
};
