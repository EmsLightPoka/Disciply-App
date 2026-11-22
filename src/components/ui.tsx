import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { IBack } from "./Icons";
import { initials } from "../lib/souls";

// ---------- Toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((m: string) => { setMsg(m); clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 2800); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

// ---------- Feuille du bas ----------
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Top({ title, sub, back, right }: { title: string; sub?: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="top">
      {back && <button className="iconbtn" onClick={() => (history.length > 1 ? nav(-1) : nav("/"))} aria-label="Retour"><IBack /></button>}
      <div style={{ flex: 1, minWidth: 0 }}><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      {right}
    </div>
  );
}

export const Avatar = ({ name, lg }: { name: string; lg?: boolean }) => <span className={"av" + (lg ? " lg" : "")} aria-hidden="true">{initials(name)}</span>;
export const Dots = ({ n, total }: { n: number; total: number }) => (
  <span className="dots" aria-label={`${n} étapes sur ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}</span>
);
export const Loading = ({ label = "Chargement…" }: { label?: string }) => <div className="loading">{label}</div>;
export const Logo = ({ width }: { width?: number }) => (
  <>
    <img className="light-only" src="/logo-color.png" alt="Disciply" style={{ width }} />
    <img className="dark-only" src="/logo-white.png" alt="Disciply" style={{ width }} />
  </>
);

/** Petite aide : affiche l'erreur Firebase en français. */
export function frError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
    "auth/wrong-password": "E-mail ou mot de passe incorrect.",
    "auth/user-not-found": "Aucun compte avec cet e-mail.",
    "auth/invalid-email": "Cette adresse e-mail n'est pas valide.",
    "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail. Connecte-toi à la place.",
    "auth/weak-password": "Le mot de passe doit faire au moins 8 caractères.",
    "auth/too-many-requests": "Trop d'essais. Réessaie dans quelques minutes.",
    "auth/network-request-failed": "Pas de connexion internet. Vérifie ton réseau.",
    "permission-denied": "Tu n'as pas le droit de faire cette action."
  };
  return map[code] ?? "Une erreur est survenue. Réessaie.";
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
export async function shareText(text: string, toast: (m: string) => void) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch { return; } }
  toast((await copyText(text)) ? "Texte copié. Colle-le dans WhatsApp." : "Impossible de copier le texte.");
}
