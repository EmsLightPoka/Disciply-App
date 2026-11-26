import { useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useQuery } from "../../lib/hooks";
import { updateUser } from "../../lib/api";
import type { UserProfile } from "../../lib/types";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../lib/session";
import { createCampus, switchCampus } from "../../lib/api";
import { Avatar, Sheet, Top, frError, useToast } from "../../components/ui";
import { IPlus } from "../../components/Icons";

/** Administrateur de l'application : liste des campus, création, et choix du campus sur lequel travailler. */
export default function Campuses() {
  const { campuses, campusId, profile, isFirst } = useSession();
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
      {isFirst && <Supers />}
      {profile?.role === "master" && <Pastors />}
      {isFirst && <ToFix />}
      <p className="small">Pour donner un leader à un campus : choisis le campus, puis Ouvriers, Ajouter, rôle Leader du campus. Le super admin peut aussi nommer le Pasteur principal, qui voit tous les campus.</p>
      {open && <Sheet title="Nouveau campus" onClose={() => setOpen(false)}>
        <div className="field"><label htmlFor="cn">Nom</label><input id="cn" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. ICC Douala" /></div>
        <div className="field"><label htmlFor="cc">Ville</label><input id="cc" value={city} onChange={e => setCity(e.target.value)} /></div>
        <button className="btn primary block" disabled={busy || !name.trim()} onClick={create}>Créer le campus</button>
      </Sheet>}
    </div>
  );
}

/** Anciens comptes créés avec le rôle « administrateur de l'application » : seul le premier compte garde ce rôle. */
function ToFix() {
  const { campuses, profile } = useSession();
  const toast = useToast();
  const q = useQuery<UserProfile>(query(collection(db, "users"), where("role", "==", "master")), [profile?.id]);
  const { superIds } = useSession();
  const list = q.data.filter(u => u.id !== profile?.id && !superIds.includes(u.id));
  const [pick, setPick] = useState<Record<string, string>>({});
  if (!list.length) return null;
  return <>
    <div className="eyebrow">Comptes à rattacher à un campus</div>
    <p className="small" style={{ margin: "0 2px 8px" }}>Seul ton compte voit tous les campus. Ces comptes doivent devenir leader d'un seul campus.</p>
    <div className="list">{list.map(u => (
      <div className="row" key={u.id} style={{ flexWrap: "wrap" }}><Avatar name={u.name} />
        <span className="main-col"><div className="name">{u.name}</div><div className="meta">{u.email}</div></span>
        <select aria-label="Campus" value={pick[u.id] ?? u.campusId ?? ""} onChange={e => setPick({ ...pick, [u.id]: e.target.value })} style={{ flex: "1 1 140px" }}>
          <option value="">Choisir un campus…</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="btn primary sm" style={{ flex: "none" }} disabled={!(pick[u.id] ?? u.campusId)} onClick={() =>
          updateUser(u.id, { role: "admin", campusId: pick[u.id] ?? u.campusId, familyId: null }).then(() => toast(`${u.name} est leader de ce campus`)).catch(e => toast(frError(e)))}>Nommer leader</button>
      </div>))}</div>
  </>;
}

/** Super admin : le ou les pasteurs principaux (mêmes accès que le super admin, sur tous les campus). */
function Pastors() {
  const { profile, campusId } = useSession();
  const q = useQuery<UserProfile>(query(collection(db, "users"), where("role", "==", "pastor")), [profile?.id]);
  return <>
    <div className="eyebrow">Pasteur principal</div>
    <div className="list">{q.data.map(u => (
      <div className="row" key={u.id}><Avatar name={u.name} />
        <span className="main-col"><div className="name">{u.name}</div><div className="meta">{u.email}{u.active ? "" : " · désactivé"}</div></span></div>))}
      {q.data.length === 0 && <div className="empty">Pas encore de pasteur principal.</div>}</div>
    <div className="btnrow">{campusId
      ? <Link className="btn primary" to="/equipe?inviter=1&role=pastor"><IPlus />Créer le compte du pasteur principal</Link>
      : <span className="small">Choisis d'abord un campus ci-dessus.</span>}</div>
  </>;
}

/** Premier compte : les autres super admins (vue sur tout), qu'il est seul à pouvoir créer. */
function Supers() {
  const { profile, campusId, superIds } = useSession();
  const q = useQuery<UserProfile>(query(collection(db, "users"), where("role", "==", "master")), [profile?.id, superIds.join()]);
  const list = q.data.filter(u => superIds.includes(u.id));
  return <>
    <div className="eyebrow">Autres super admins</div>
    <div className="list">{list.map(u => (
      <div className="row" key={u.id}><Avatar name={u.name} />
        <span className="main-col"><div className="name">{u.name}</div><div className="meta">{u.email}{u.active ? "" : " · désactivé"}</div></span></div>))}
      {list.length === 0 && <div className="empty">Aucun autre super admin.</div>}</div>
    <div className="btnrow">{campusId
      ? <Link className="btn ghost" to="/equipe?inviter=1&role=master"><IPlus />Créer un compte super admin</Link>
      : <span className="small">Choisis d'abord un campus ci-dessus.</span>}</div>
  </>;
}
