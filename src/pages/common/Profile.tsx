import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useSession, applyTheme } from "../../lib/session";
import { updateUser } from "../../lib/api";
import { ROLE_LABEL } from "../../lib/types";
import { Avatar, Top, frError, useToast } from "../../components/ui";

export default function Profile() {
  const { profile, myFamily, settings, logout } = useSession();
  const toast = useToast();
  const me = profile!;
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [busy, setBusy] = useState(false);
  const theme = me.theme ?? (document.documentElement.dataset.theme as "light" | "dark" | undefined) ?? "system";

  async function save() {
    setBusy(true);
    try { await updateUser(me.id, { name: name.trim(), phone: phone.trim() }); toast("Profil enregistré"); }
    catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  async function setTheme(t: "light" | "dark" | "system") { applyTheme(t); updateUser(me.id, { theme: t }).catch(() => {}); }
  async function resetPw() {
    try { await sendPasswordResetEmail(auth, me.email); toast("E-mail envoyé pour changer ton mot de passe"); } catch (e) { toast(frError(e)); }
  }

  return (
    <div className="page">
      <Top title="Profil" />
      <div className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Avatar name={me.name} lg />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 17 }}>{me.name}</div>
          <div className="small">{ROLE_LABEL[me.role]}</div>
          <div className="small">{me.role === "admin" ? settings.churchName : myFamily ? `Famille ${myFamily.name}` : "Famille non définie"}</div>
        </div>
      </div>

      <div className="eyebrow">Mes informations</div>
      <div className="card">
        <div className="field"><label htmlFor="p-name">Nom</label><input id="p-name" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="p-phone">Téléphone</label><input id="p-phone" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
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
        <button className="btn ghost" onClick={resetPw}>Changer mon mot de passe</button>
        <button className="btn ghost" onClick={logout}>Se déconnecter</button>
      </div>
      <p className="small" style={{ marginTop: 16 }}>Astuce : sur téléphone, ajoute Disciply à l'écran d'accueil depuis le menu du navigateur pour l'ouvrir comme une app.</p>
    </div>
  );
}
