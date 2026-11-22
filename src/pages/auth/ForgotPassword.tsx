import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { Logo, frError } from "../../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await sendPasswordResetEmail(auth, email.trim(), { url: `${location.origin}/connexion` }); setSent(true); }
    catch (x) {
      // Pour ne pas révéler quels e-mails ont un compte, on affiche le même message.
      if ((x as { code?: string }).code === "auth/user-not-found") setSent(true); else setErr(frError(x));
    } finally { setBusy(false); }
  }

  return (
    <div className="auth"><div className="auth-card">
      <div className="logo"><Logo width={200} /></div>
      <h1>Mot de passe oublié</h1>
      {sent ? (
        <>
          <div className="success" style={{ marginTop: 14 }}>Si un compte existe pour {email}, un e-mail vient d'être envoyé avec un lien pour choisir un nouveau mot de passe. Pense à regarder dans les spams.</div>
          <Link className="btn ghost block" to="/connexion">Retour à la connexion</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="small" style={{ marginTop: 0 }}>Entre ton adresse e-mail. Tu recevras un lien pour choisir un nouveau mot de passe.</p>
          {err && <div className="error" role="alert">{err}</div>}
          <div className="field"><label htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <button className="btn primary block" disabled={busy}>Envoyer le lien</button>
          <div className="links"><Link to="/connexion">Retour à la connexion</Link></div>
        </form>
      )}
    </div></div>
  );
}
