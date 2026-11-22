import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { bootstrapAdmin } from "../../lib/api";
import { DEFAULT_SETTINGS } from "../../lib/types";
import { Loading, Logo, frError } from "../../components/ui";

/** Première utilisation : création du compte du responsable général. Ne marche qu'une seule fois. */
export default function Setup() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [church, setChurch] = useState(DEFAULT_SETTINGS.churchName);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getDoc(doc(db, "meta", "bootstrap")).then(s => setOpen(!s.exists())).catch(() => setOpen(false)); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (pw.length < 8) return setErr("Le mot de passe doit faire au moins 8 caractères.");
    setBusy(true);
    try { await bootstrapAdmin(name.trim(), email.trim(), pw, church.trim()); }
    catch (x) { setErr(frError(x)); setBusy(false); }
  }

  if (open === null) return <Loading />;
  return (
    <div className="auth"><div className="auth-card">
      <div className="logo"><Logo width={200} /></div>
      {!open ? (
        <>
          <h1>Installation déjà faite</h1>
          <p className="small">Le compte du responsable existe déjà. Les autres comptes se créent par invitation.</p>
          <Link className="btn ghost block" to="/connexion">Aller à la connexion</Link>
        </>
      ) : (
        <>
          <h1>Bienvenue sur Disciply</h1>
          <p className="small" style={{ margin: 0 }}>Crée le compte du responsable général. Tu pourras ensuite créer les familles et inviter les bergers et les faiseurs.</p>
          <form onSubmit={submit}>
            {err && <div className="error" role="alert">{err}</div>}
            <div className="field"><label htmlFor="church">Nom de l'église</label><input id="church" required value={church} onChange={e => setChurch(e.target.value)} /></div>
            <div className="field"><label htmlFor="name">Ton nom</label><input id="name" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
            <div className="field"><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="field"><label htmlFor="pw">Mot de passe</label><input id="pw" type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /><span className="hint">8 caractères minimum</span></div>
            <button className="btn primary block" disabled={busy}>{busy ? "Création…" : "Créer le compte responsable"}</button>
          </form>
        </>
      )}
    </div></div>
  );
}
