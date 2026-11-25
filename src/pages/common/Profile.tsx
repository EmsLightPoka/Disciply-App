import { isCampusAdmin } from "../../lib/types";
import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useSession, applyTheme } from "../../lib/session";
import { updateUser } from "../../lib/api";
import { ROLE_LABEL } from "../../lib/types";
import { Avatar, Sheet, Top, frError, useToast } from "../../components/ui";

export default function Profile() {
  const { profile, myFamily, settings, logout, campus } = useSession();
  const toast = useToast();
  const me = profile!;
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [gender, setGender] = useState<"F" | "H" | undefined>(me.gender);
  const [age, setAge] = useState<string>(me.age != null ? String(me.age) : "");
  const [busy, setBusy] = useState(false);
  const theme = me.theme ?? (document.documentElement.dataset.theme as "light" | "dark" | undefined) ?? "system";

  async function save() {
    setBusy(true);
    try { await updateUser(me.id, { name: name.trim(), phone: phone.trim(), age: age === "" ? null : Number(age), ...(gender ? { gender } : {}) }); toast("Profil enregistré"); }
    catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  async function setTheme(t: "light" | "dark" | "system") { applyTheme(t); updateUser(me.id, { theme: t }).catch(() => {}); }
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <div className="page">
      <Top title="Profil" />
      <div className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Avatar name={me.name} lg />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 17 }}>{me.name}</div>
          <div className="small">{ROLE_LABEL[me.role]}</div>
          <div className="small">{isCampusAdmin(me.role) ? (campus?.name ? `Campus ${campus.name}` : settings.churchName) : myFamily ? `Famille ${myFamily.name}` : "Famille non définie"}</div>
        </div>
      </div>

      <div className="eyebrow">Mes informations</div>
      <div className="card">
        <div className="field"><label htmlFor="p-name">Nom</label><input id="p-name" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="p-phone">Téléphone</label><input id="p-phone" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <div className="field"><label>Sexe</label><div className="toggle">
          <button type="button" aria-pressed={gender === "F"} onClick={() => setGender("F")}>Femme</button>
          <button type="button" aria-pressed={gender === "H"} onClick={() => setGender("H")}>Homme</button></div></div>
        <div className="field"><label htmlFor="p-age">Âge</label><input id="p-age" type="number" inputMode="numeric" min={12} max={110} value={age} onChange={e => setAge(e.target.value)} /><span className="hint">Les âmes de ta tranche d'âge te seront confiées de préférence.</span></div>
        <div className="field"><label>E-mail de connexion</label><input value={me.email} disabled /></div>
        <button className="btn primary block" disabled={busy || !name.trim()} onClick={save}>Enregistrer</button>
      </div>

      <div className="eyebrow">Affichage</div>
      <div className="toggle">
        <button aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Jour</button>
        <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Nuit</button>
        <button aria-pressed={theme === "system"} onClick={() => setTheme("system")}>Comme le téléphone</button>
      </div>

      <div className="eyebrow">Sécurité</div>
      <div className="btnrow" style={{ marginTop: 0 }}>
        <button className="btn ghost" onClick={() => setPwOpen(true)}>Changer mon mot de passe</button>
        <button className="btn ghost" onClick={logout}>Se déconnecter</button>
      </div>
      {pwOpen && <ChangePassword email={me.email} onClose={() => setPwOpen(false)} />}
      <p className="small" style={{ marginTop: 16 }}>Astuce : sur téléphone, ajoute Disciply à l'écran d'accueil depuis le menu du navigateur pour l'ouvrir comme une app.</p>
    </div>
  );
}

/** Changer son mot de passe dans l'app : l'ancien, puis le nouveau (pas besoin d'e-mail). */
function ChangePassword({ email, onClose }: { email: string; onClose: () => void }) {
  const toast = useToast();
  const [old, setOld] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setErr("");
    if (pw.length < 8) return setErr("Le nouveau mot de passe doit faire au moins 8 caractères.");
    if (pw !== pw2) return setErr("Les deux nouveaux mots de passe ne sont pas identiques.");
    setBusy(true);
    try {
      const u = auth.currentUser!;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(email, old));
      await updatePassword(u, pw);
      toast("Mot de passe changé"); onClose();
    } catch (e) {
      const c = (e as { code?: string }).code;
      setErr(c === "auth/wrong-password" || c === "auth/invalid-credential" ? "Le mot de passe actuel n'est pas le bon." : frError(e));
    } finally { setBusy(false); }
  }
  return (
    <Sheet title="Changer mon mot de passe" onClose={onClose}>
      <div className="field"><label htmlFor="pw-old">Mot de passe actuel</label><input id="pw-old" type="password" autoComplete="current-password" value={old} onChange={e => setOld(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw-new">Nouveau mot de passe</label><input id="pw-new" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw-new2">Confirmer le nouveau mot de passe</label><input id="pw-new2" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></div>
      {err && <div className="error">{err}</div>}
      <button className="btn primary block" disabled={busy || !old || !pw} onClick={go}>{busy ? "Enregistrement…" : "Changer le mot de passe"}</button>
    </Sheet>);
}
