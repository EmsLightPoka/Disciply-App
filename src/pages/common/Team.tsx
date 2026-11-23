import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { createInvitation, inviteLink, updateUser } from "../../lib/api";
import { ROLE_LABEL, isCampusAdmin, type Invitation, type Role, type UserProfile } from "../../lib/types";
import { Avatar, Sheet, Top, copyText, frError, shareText, useToast } from "../../components/ui";
import { IPlus } from "../../components/Icons";

export default function Team() {
  const { profile, families, familyName, settings, campusId, campus } = useSession();
  const { workers, active, attendance } = useScope();
  const toast = useToast();
  const me = profile!;
  const isAdmin = isCampusAdmin(me.role);
  const isShepherd = me.role === "shepherd";
  const canInvite = isAdmin || isShepherd;
  const invQ = useQuery<Invitation>(!campusId || !canInvite ? null : isAdmin
    ? query(collection(db, "invitations"), where("campusId", "==", campusId))
    : query(collection(db, "invitations"), where("campusId", "==", campusId), where("familyId", "==", me.familyId ?? "")), [me.id, campusId]);
  const pending = invQ.data.filter(i => !i.usedBy);
  const [params] = useSearchParams();
  const [showInvite, setShowInvite] = useState(params.get("inviter") === "1");
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [edit, setEdit] = useState<UserProfile | null>(null);
  const [famFilter, setFamFilter] = useState("");

  const list = workers.filter(w => w.id !== me.id || isAdmin).filter(w => !famFilter || w.familyId === famFilter);
  const load = (id: string) => active.filter(s => s.makerId === id).length;
  const rate = (id: string) => {
    let n = 0, p = 0;
    for (const s of active.filter(x => x.makerId === id)) for (const a of attendance.get(s.id)?.values() ?? []) { n++; if (a.present) p++; }
    return n ? Math.round((p / n) * 100) : null;
  };
  const shareMsg = (inv: { id: string; name: string }) => `Bonjour ${inv.name}, tu es invité(e) sur Disciply, l'app de suivi des âmes de ${campus?.name ?? settings.churchName}. Crée ton compte avec ce lien : ${inviteLink(inv.id)}`;

  return (
    <div className="page">
      <Top title={isAdmin ? "Ouvriers" : "Équipe"} sub={isAdmin ? `${workers.length} comptes` : `Famille ${familyName(me.familyId)}`}
        right={canInvite ? <button className="btn primary sm" style={{ flex: "none" }} onClick={() => setShowInvite(true)}><IPlus />Inviter</button> : undefined} />
      {isAdmin && <div className="field" style={{ marginBottom: 6 }}><select aria-label="Famille" value={famFilter} onChange={e => setFamFilter(e.target.value)}><option value="">Toutes les familles</option>{families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}

      {pending.length > 0 && <>
        <div className="eyebrow">Invitations en attente</div>
        <div className="list">{pending.map(i => (
          <div className="row" key={i.id}>
            <Avatar name={i.name} />
            <span className="main-col"><div className="name">{i.name}</div><div className="meta">{ROLE_LABEL[i.role]} · {i.familyName ?? (i.campusName ? `Campus ${i.campusName}` : "Tout le campus")} · {i.email}</div></span>
            <button className="btn ghost sm" style={{ flex: "none" }} onClick={() => shareText(shareMsg(i), toast)}>Envoyer</button>
            <button className="btn ghost sm" style={{ flex: "none" }} aria-label={`Supprimer l'invitation de ${i.name}`} onClick={() => deleteDoc(doc(db, "invitations", i.id)).then(() => toast("Invitation supprimée")).catch(e => toast(frError(e)))}>✕</button>
          </div>))}</div>
      </>}

      <div className="eyebrow">{isAdmin ? "Comptes" : "Ouvriers de la famille"}</div>
      <div className="list">{list.map(w => {
        const r = rate(w.id);
        return (
          <button key={w.id} className="row" onClick={() => (isAdmin || (isShepherd && w.id !== me.id)) && setEdit(w)} style={{ cursor: isAdmin || isShepherd ? "pointer" : "default" }}>
            <Avatar name={w.name} />
            <span className="main-col">
              <div className="name">{w.name}{w.id === me.id ? " (moi)" : ""}</div>
              <div className="meta">{ROLE_LABEL[w.role]}{isAdmin && w.familyId ? ` · ${familyName(w.familyId)}` : ""}{w.gender ? ` · ${w.gender === "F" ? "Femme" : "Homme"}` : ""}{w.role === "maker" || w.role === "assistant" ? ` · ${load(w.id)} âmes${r !== null ? ` · présence ${r} %` : ""}` : ""}</div>
            </span>
            {!w.active && <span className="chip bad">Désactivé</span>}
          </button>);
      })}{list.length === 0 && <div className="empty">Personne pour l'instant. Invite un ouvrier.</div>}</div>

      {showInvite && <InviteSheet onClose={() => setShowInvite(false)} onCreated={inv => { setShowInvite(false); setCreated(inv); }} />}
      {created && (
        <Sheet title="Invitation prête" onClose={() => setCreated(null)}>
          <p className="small" style={{ marginTop: 0 }}>Envoie ce lien à {created.name}. Il permet de créer un seul compte, avec l'adresse e-mail indiquée.</p>
          <div className="copybox">{inviteLink(created.id)}</div>
          <div className="btnrow">
            <button className="btn ghost" onClick={async () => toast((await copyText(inviteLink(created.id))) ? "Lien copié" : "Copie impossible, sélectionne le lien")}>Copier le lien</button>
            <button className="btn primary" onClick={() => shareText(shareMsg(created), toast)}>Envoyer par WhatsApp</button>
          </div>
        </Sheet>)}
      {edit && (isAdmin ? <EditWorker w={edit} onClose={() => setEdit(null)} /> : <PromoteSheet w={edit} onClose={() => setEdit(null)} />)}
    </div>
  );
}

function InviteSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (i: { id: string; name: string }) => void }) {
  const { profile, families, campusId, campus } = useSession();
  const toast = useToast();
  const me = profile!;
  const isAdmin = isCampusAdmin(me.role);
  const roles: Role[] = me.role === "master" ? ["maker", "assistant", "shepherd", "admin", "master"]
    : isAdmin ? ["maker", "assistant", "shepherd", "admin"] : ["maker", "assistant"];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"F" | "H" | "">("");
  const [role, setRole] = useState<Role>("maker");
  const [famChoice, setFamilyId] = useState("");
  const familyId = famChoice || me.familyId || families[0]?.id || "";
  const [busy, setBusy] = useState(false);
  const noFamily = role === "admin" || role === "master";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!noFamily && !familyId) return toast("Crée d'abord une famille dans Familles.");
    if (!gender) return toast("Indique s'il s'agit d'un homme ou d'une femme.");
    setBusy(true);
    try {
      const fid = noFamily ? null : familyId;
      const id = await createInvitation(me, {
        name: name.trim(), email, role, gender, campusId: role === "master" ? null : campusId, campusName: campus?.name,
        familyId: fid, ...(fid ? { familyName: families.find(f => f.id === fid)?.name } : {})
      });
      onCreated({ id, name: name.trim() });
    } catch (x) { toast(frError(x)); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Inviter un ouvrier" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="i-name">Nom et prénom</label><input id="i-name" required value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="i-email">Adresse e-mail</label><input id="i-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /><span className="hint">L'ouvrier devra créer son compte avec cette adresse.</span></div>
        <div className="field"><span className="label">Sexe</span><div className="toggle">
          <button type="button" aria-pressed={gender === "F"} onClick={() => setGender("F")}>Femme</button>
          <button type="button" aria-pressed={gender === "H"} onClick={() => setGender("H")}>Homme</button></div></div>
        <div className="field"><label htmlFor="i-role">Rôle</label><select id="i-role" value={role} onChange={e => setRole(e.target.value as Role)}>
          {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
        {isAdmin && !noFamily && <div className="field"><label htmlFor="i-fam">Famille de disciples</label><select id="i-fam" value={familyId} onChange={e => setFamilyId(e.target.value)}>{families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
        <button className="btn primary block" disabled={busy}>Créer le lien d'invitation</button>
      </form>
    </Sheet>
  );
}

function PromoteSheet({ w, onClose }: { w: UserProfile; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const toAssistant = w.role === "maker";
  if (w.role !== "maker" && w.role !== "assistant") return null;
  return (
    <Sheet title={w.name} onClose={onClose}>
      <p className="small" style={{ marginTop: 0 }}>{ROLE_LABEL[w.role]}{w.phone ? ` · ${w.phone}` : ""}</p>
      <p>{toAssistant ? "Un assistant berger peut attribuer les âmes, enregistrer jusqu'au lundi midi et voir les rapports de la famille." : "Il redeviendra faiseur de disciples et ne verra plus que ses âmes."}</p>
      <button className="btn primary block" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await updateUser(w.id, { role: toAssistant ? "assistant" : "maker" }); toast(toAssistant ? `${w.name} est assistant berger` : `${w.name} est faiseur de disciples`); onClose(); }
        catch (e) { toast(frError(e)); } finally { setBusy(false); }
      }}>{toAssistant ? "Nommer assistant berger" : "Retirer le rôle d'assistant"}</button>
    </Sheet>
  );
}

function EditWorker({ w, onClose }: { w: UserProfile; onClose: () => void }) {
  const { profile, families, familyName } = useSession();
  const toast = useToast();
  const [role, setRole] = useState<Role>(w.role);
  const [familyId, setFamilyId] = useState(w.familyId ?? "");
  const [busy, setBusy] = useState(false);
  const self = w.id === profile!.id;
  async function save(data: Partial<UserProfile>, ok: string) {
    setBusy(true);
    try { await updateUser(w.id, data); toast(ok); onClose(); } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title={w.name} onClose={onClose}>
      <p className="small" style={{ marginTop: 0 }}>{w.email}{w.phone ? ` · ${w.phone}` : ""} · {familyName(w.familyId)}</p>
      <div className="field"><label htmlFor="e-role">Rôle</label><select id="e-role" value={role} disabled={self} onChange={e => setRole(e.target.value as Role)}>
        {(["maker", "assistant", "shepherd", "admin", ...(profile!.role === "master" ? ["master" as Role] : [])] as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
      {role !== "admin" && role !== "master" && <div className="field"><label htmlFor="e-fam">Famille</label><select id="e-fam" value={familyId} onChange={e => setFamilyId(e.target.value)}>
        <option value="">Choisir…</option>{families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
      <button className="btn primary block" disabled={busy || (role !== "admin" && role !== "master" && !familyId)} onClick={() => save({ role, familyId: role === "admin" || role === "master" ? null : familyId }, "Compte mis à jour")}>Enregistrer</button>
      {!self && <div className="btnrow">
        <button className={"btn " + (w.active ? "danger" : "ghost")} disabled={busy} onClick={() => save({ active: !w.active }, w.active ? "Compte désactivé" : "Compte réactivé")}>{w.active ? "Désactiver le compte" : "Réactiver le compte"}</button>
      </div>}
      {w.role === "maker" && w.active && <p className="small">Avant de désactiver un faiseur, confie ses âmes à quelqu'un d'autre depuis À attribuer ou leur fiche.</p>}
    </Sheet>
  );
}
