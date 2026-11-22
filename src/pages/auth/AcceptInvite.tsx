import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { acceptInvitation } from "../../lib/api";
import { ROLE_LABEL, type Invitation } from "../../lib/types";
import { Loading, Logo, frError } from "../../components/ui";
import { useSession } from "../../lib/session";

export default function AcceptInvite() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const [inv, setInv] = useState<Invitation | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"F" | "H" | "">("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "invitations", id))
      .then(s => { const d = s.exists() ? ({ id: s.id, ...s.data() } as Invitation) : null; setInv(d); if (d) { setName(d.name); if (d.gender) setGender(d.gender); } })
      .catch(() => setInv(null));
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (pw.length < 8) return setErr("Le mot de passe doit faire au moins 8 caractères.");
    if (pw !== pw2) return setErr("Les deux mots de passe ne sont pas identiques.");
    if (!gender) return setErr("Indique si tu es un homme ou une femme : les âmes sont attribuées selon le sexe.");
    setBusy(true);
    try { await acceptInvitation(inv!, name.trim(), phone.trim(), gender, pw); }
    catch (x) { setErr(frError(x)); setBusy(false); }
  }

  if (inv === undefined) return <Loading />;
  return (
    <div className="auth"><div className="auth-card">
      <div className="logo"><Logo width={200} /></div>
      {!inv || inv.usedBy ? (
        <>
          <h1>Invitation introuvable</h1>
          <p className="small">{inv?.usedBy ? "Cette invitation a déjà servi à créer un compte." : "Ce lien n'est pas valide ou a été supprimé."} Demande un nouveau lien à ton berger ou au responsable.</p>
          <Link className="btn ghost block" to="/connexion">Aller à la connexion</Link>
        </>
      ) : user ? (
        <>
          <h1>Tu es déjà connecté</h1>
          <p className="small">Déconnecte-toi d'abord pour créer le compte de {inv.name}.</p>
        </>
      ) : (
        <>
          <h1>Créer ton compte</h1>
          <p className="small" style={{ margin: 0 }}>{inv.createdByName} t'invite à rejoindre Disciply.</p>
          <div className="card" style={{ marginTop: 12 }}>
            <dl className="kv">
              <dt>Rôle</dt><dd>{ROLE_LABEL[inv.role]}</dd>
              <dt>Campus</dt><dd>{inv.campusName ?? "Tous les campus"}</dd>
              {inv.familyName && <><dt>Famille</dt><dd>{inv.familyName}</dd></>}
              <dt>E-mail</dt><dd>{inv.email}</dd>
            </dl>
          </div>
          <form onSubmit={submit}>
            {err && <div className="error" role="alert">{err}</div>}
            <div className="field"><label htmlFor="name">Nom et prénom</label><input id="name" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
            <div className="field"><label htmlFor="phone">Téléphone</label><input id="phone" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="6 XX XX XX XX" autoComplete="tel" /></div>
            <div className="field"><label>Sexe</label><div className="toggle">
              <button type="button" aria-pressed={gender === "F"} onClick={() => setGender("F")}>Femme</button>
              <button type="button" aria-pressed={gender === "H"} onClick={() => setGender("H")}>Homme</button></div></div>
            <div className="field"><label htmlFor="pw">Mot de passe</label><input id="pw" type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /><span className="hint">8 caractères minimum</span></div>
            <div className="field"><label htmlFor="pw2">Confirmer le mot de passe</label><input id="pw2" type="password" required value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></div>
            <button className="btn primary block" disabled={busy}>{busy ? "Création…" : "Créer mon compte"}</button>
          </form>
        </>
      )}
    </div></div>
  );
}
