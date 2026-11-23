import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../lib/session";
import { createCampus, switchCampus } from "../../lib/api";
import { Avatar, Sheet, Top, frError, useToast } from "../../components/ui";
import { IPlus } from "../../components/Icons";

/** Administrateur de l'application : liste des campus, création, et choix du campus sur lequel travailler. */
export default function Campuses() {
  const { campuses, campusId, profile } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try { const id = await createCampus(name.trim(), city.trim()); await switchCampus(profile!.id, id); toast(`Campus ${name} créé`); setOpen(false); setName(""); setCity(""); nav("/eglise"); }
    catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="page">
      <Top title="Tous les campus" sub="Tu vois tous les campus de l'église. Touche un campus pour entrer dans sa vue, ou crée-en un nouveau." right={<button className="btn primary sm" style={{ flex: "none" }} onClick={() => setOpen(true)}><IPlus />Nouveau</button>} />
      <div className="list">{campuses.map(c => (
        <button key={c.id} className="row" onClick={async () => { await switchCampus(profile!.id, c.id); nav("/eglise"); }}>
          <Avatar name={c.name} /><span className="main-col"><div className="name">{c.name}</div><div className="meta">{c.city}</div></span>
          {c.id === campusId && <span className="chip ok">Campus actuel</span>}
        </button>))}
        {campuses.length === 0 && <div className="empty">Aucun campus.</div>}</div>
      <p className="small">Pour donner un pasteur à un campus : choisis le campus, puis Ouvriers, Inviter, rôle Pasteur du campus.</p>
      {open && <Sheet title="Nouveau campus" onClose={() => setOpen(false)}>
        <div className="field"><label htmlFor="cn">Nom</label><input id="cn" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. ICC Douala" /></div>
        <div className="field"><label htmlFor="cc">Ville</label><input id="cc" value={city} onChange={e => setCity(e.target.value)} /></div>
        <button className="btn primary block" disabled={busy || !name.trim()} onClick={create}>Créer le campus</button>
      </Sheet>}
    </div>
  );
}
