import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { bootstrapMaster } from "../../lib/api";
import { Loading, Logo, frError } from "../../components/ui";

/** Première utilisation : le compte de l'administrateur de l'application et le premier campus. Une seule fois. */
export default function Setup() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [campus, setCampus] = useState("Impact Centre Chrétien Yaoundé");
  const [city, setCity] = useState("Yaoundé");
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
    try { await bootstrapMaster(name.trim(), email.trim(), pw, campus.trim(), city.trim()); }
    catch (x) { setErr(frError(x)); setBusy(false); }
  }

  if (open === null) return <Loading />;
  return (
    <div className="auth"><div className="auth-card">
      <div className="logo"><Logo width={200} /></div>
      {!open ? (
        <>
          <h1>Installation déjà faite</h1>
          <p className="small">L'administrateur de l'application existe déjà. Les autres comptes se créent par invitation.</p>
          <Link className="btn ghost block" to="/connexion">Aller à la connexion</Link>
        </>
      ) : (
        <>
          <h1>Bienvenue sur Disciply</h1>
          <p className="small" style={{ margin: 0 }}>Crée le compte de l'administrateur de l'application et le premier campus. Tu pourras ensuite ajouter d'autres campus et inviter leurs pasteurs.</p>
          <form onSubmit={submit}>
            {err && <div className="error" role="alert">{err}</div>}
            <div className="field"><label htmlFor="campus">Premier campus</label><input id="campus" required value={campus} onChange={e => setCampus(e.target.value)} /></div>
            <div className="field"><label htmlFor="city">Ville</label><input id="city" value={city} onChange={e => setCity(e.target.value)} /></div>
            <div className="field"><label htmlFor="name">Ton nom</label><input id="name" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
            <div className="field"><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="field"><label htmlFor="pw">Mot de passe</label><input id="pw" type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /><span className="hint">8 caractères minimum</span></div>
            <button className="btn primary block" disabled={busy}>{busy ? "Création…" : "Créer le compte"}</button>
          </form>
        </>
      )}
    </div></div>
  );
}
