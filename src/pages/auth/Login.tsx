import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Logo, frError } from "../../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => { getDoc(doc(db, "meta", "bootstrap")).then(s => setNeedsSetup(!s.exists())).catch(() => {}); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (x) { setErr(frError(x)); setBusy(false); }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="logo"><Logo width={200} /></div>
        <h1>Connexion</h1>
        <p className="verse">«&nbsp;Allez, faites de toutes les nations des disciples.&nbsp;»<cite>Matthieu 28.19</cite></p>
        <form onSubmit={submit}>
          {err && <div className="error" role="alert">{err}</div>}
          <div className="field"><label htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
          <button className="btn primary block" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
        </form>
        <div className="links"><Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link></div>
        <p className="small" style={{ marginTop: 18 }}>Pas encore de compte ? Demande une invitation à ton berger ou au responsable. Tu recevras un lien pour créer ton compte.</p>
        {needsSetup && <p className="small"><Link to="/installation">Première utilisation : créer le compte du responsable</Link></p>}
      </div>
    </div>
  );
}
