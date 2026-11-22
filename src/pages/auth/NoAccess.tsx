import { useSession } from "../../lib/session";
import { Logo } from "../../components/ui";

export default function NoAccess() {
  const { user, profile, logout } = useSession();
  return (
    <div className="auth"><div className="auth-card">
      <div className="logo"><Logo width={200} /></div>
      <h1>{profile && !profile.active ? "Compte désactivé" : "Compte sans accès"}</h1>
      <p className="small">
        {profile && !profile.active
          ? "Ton compte a été désactivé par le responsable. Contacte-le si c'est une erreur."
          : `Le compte ${user?.email ?? ""} n'est relié à aucune invitation. Demande un lien d'invitation à ton berger ou au responsable.`}
      </p>
      <button className="btn ghost block" onClick={logout}>Se déconnecter</button>
    </div></div>
  );
}
