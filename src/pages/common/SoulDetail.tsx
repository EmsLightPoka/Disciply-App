import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collection, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useDocument, useQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import type { Note, Soul } from "../../lib/types";
import { addNote, cancelStep, establishSoul, exitSoul, reinstateSoul, reportDifficulty, resolveDifficulty, setFormation, transferSoul, updateSoul, validateStep } from "../../lib/api";
import { isCampusAdmin, isLeader } from "../../lib/types";
import AssignSheet from "../../components/AssignSheet";
import { fullDate, lastSundays, shortDate, today } from "../../lib/dates";
import { STATUS_LABEL, stepCount, telHref, waHref } from "../../lib/souls";
import { Avatar, Loading, Sheet, Top, frError, useToast } from "../../components/ui";
import { IChat, IPhone, IPlus } from "../../components/Icons";
import SoulForm from "./SoulForm";

type Modal = null | { kind: "step"; stepId: string } | { kind: "cancel"; stepId: string } | { kind: "note" } | { kind: "edit" }
  | { kind: "more" } | { kind: "assign" } | { kind: "transfer" } | { kind: "exit" } | { kind: "delete" } | { kind: "difficulty" } | { kind: "formation"; name: string };

export default function SoulDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { profile, settings, families, familyName } = useSession();
  const { attendance, streak, workerName } = useScope();
  const soulQ = useDocument<Soul>(doc(db, "souls", id), [id]);
  const notesQ = useQuery<Note>(query(collection(db, "souls", id, "notes"), orderBy("createdAt", "desc")), [id]);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState(today());
  const [detail, setDetail] = useState("");

  if (soulQ.loading) return <Loading />;
  const s = soulQ.data;
  if (!s) return <div className="page"><Top title="Âme introuvable" back /><div className="card empty">Cette fiche n'existe pas ou ne t'est plus confiée.</div></div>;

  const me = profile!;
  const uid = me.id;
  const total = settings.steps.length;
  const k = stepCount(s, settings);
  const nextIdx = settings.steps.findIndex(st => !s.steps?.[st.id]);
  const att = attendance.get(s.id);
  const abs = streak(s.id);
  const close = () => { setModal(null); setText(""); setDetail(""); setDate(today()); };

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast(ok); close(); }
    catch (e) { toast(frError(e)); }
    finally { setBusy(false); }
  }

  const manager = isLeader(me.role) || isCampusAdmin(me.role);
  const [diffKind, setDiffKind] = [detail, setDetail];
  const step = modal && (modal.kind === "step" || modal.kind === "cancel") ? settings.steps.find(x => x.id === modal.stepId)! : null;

  return (
    <div className="page">
      <Top title="" back right={<button className="btn ghost sm" onClick={() => setModal({ kind: "more" })}>Actions</button>} />
      <div className="soulhead">
        <Avatar name={s.name} lg />
        <h1>{s.name}</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <span className={"chip " + s.status.toLowerCase()}>{STATUS_LABEL[s.status]}</span>
          {s.state === "exited" && <span className="chip bad">Sortie du suivi</span>}
          {s.state === "established" && <span className="chip ok">Disciple affermi</span>}
          {abs >= settings.absenceThreshold && <span className="chip warn">{abs} absences de suite</span>}
        </div>
        <div className="small">Famille {familyName(s.familyId)} · {s.makerId ? `suivie par ${workerName(s.makerId)}` : "pas encore attribuée"}</div>
      </div>

      {s.phone && <div className="actions2">
        <a className="call" href={telHref(s.phone)}><IPhone />Appeler</a>
        <a className="wa" href={waHref(s.phone)} target="_blank" rel="noreferrer"><IChat />WhatsApp</a>
      </div>}

      <div className="eyebrow">Croissance · {k} sur {total}</div>
      <div className="card" style={{ padding: "6px 16px" }}><div className="steps">
        {settings.steps.map((st, i) => {
          const rec = s.steps?.[st.id];
          const isNext = !rec && i === nextIdx;
          return (
            <button key={st.id} className={"step " + (rec ? "done" : isNext ? "next" : "")}
              onClick={() => setModal(rec ? { kind: "cancel", stepId: st.id } : { kind: "step", stepId: st.id })}>
              <span className="n">{i + 1}</span>
              <span><div className="t">{st.label}</div><div className="d">{rec ? `Validée le ${shortDate(rec.date)}${rec.detail ? " · " + rec.detail : ""}` : st.description}</div></span>
              {isNext && <span className="cta">Valider</span>}
            </button>);
        })}
      </div></div>

      <div className="eyebrow">Difficultés</div>
      {s.difficulty ? (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <div className="serve"><span className="chip warn">{s.difficulty.kind}</span><span className="small">signalée le {shortDate(s.difficulty.at)}</span></div>
          {s.difficulty.text && <p style={{ margin: "8px 0 0" }}>{s.difficulty.text}</p>}
          <div className="btnrow"><button className="btn ghost sm" onClick={() => run(() => resolveDifficulty(uid, s.id), "Difficulté marquée comme résolue")}>C'est résolu</button>
            <button className="btn ghost sm" onClick={() => setModal({ kind: "difficulty" })}>Mettre à jour</button></div>
        </div>
      ) : <button className="btn ghost block" onClick={() => setModal({ kind: "difficulty" })}>Signaler une difficulté</button>}

      <div className="eyebrow">Formations</div>
      <div className="checks">{settings.formations.map(f => {
        const st = s.formations?.[f]?.status;
        return <button key={f} className={st ?? ""} onClick={() => setModal({ kind: "formation", name: f })}>{f}{st === "done" ? " · terminée" : st === "started" ? " · en cours" : ""}</button>;
      })}</div>

      <div className="eyebrow">8 derniers dimanches</div>
      <div className="pills">{lastSundays(8).map(d => {
        const a = att?.get(d);
        return <span key={d} className={"pill " + (a ? (a.present ? "p" : "a") : "n")} title={`${shortDate(d)} : ${a ? (a.present ? "présent" : "absent" + (a.reason ? " (" + a.reason + ")" : "")) : "non pointé"}`}>{a ? (a.present ? "P" : "A") : "–"}</span>;
      })}</div>

      <div className="eyebrow">Notes <button className="btn ghost sm" style={{ flex: "none" }} onClick={() => setModal({ kind: "note" })}><IPlus />Ajouter</button></div>
      <div className="list">{notesQ.data.length ? notesQ.data.map(n => (
        <div className="note" key={n.id}><div className="when">{n.createdAt ? n.createdAt.toDate().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "À l'instant"} · {n.authorName}</div>{n.text}</div>
      )) : <div className="empty" style={{ padding: 16 }}>Pas encore de note. Après un appel, note ce qui s'est dit.</div>}</div>

      <div className="eyebrow">Informations <button className="btn ghost sm" style={{ flex: "none" }} onClick={() => setModal({ kind: "edit" })}>Modifier</button></div>
      <div className="card"><dl className="kv">
        <dt>Téléphone</dt><dd>{s.phone || "—"}</dd>
        <dt>Quartier</dt><dd>{s.neighborhood || "—"}</dd>
        <dt>Sexe</dt><dd>{s.gender === "F" ? "Femme" : "Homme"}</dd>
        <dt>Culte</dt><dd>{s.service}</dd>
        <dt>Arrivée</dt><dd>{fullDate(s.arrivalDate)}</dd>
        {s.inviter && <><dt>Invitée par</dt><dd>{s.inviter}</dd></>}
        {s.exitReason && <><dt>Sortie</dt><dd>{s.exitReason}{s.exitDate ? ` (${shortDate(s.exitDate)})` : ""}</dd></>}
      </dl></div>

      {s.history && s.history.length > 0 && <>
        <div className="eyebrow">Historique</div>
        <div className="list">{[...s.history].reverse().slice(0, 12).map((h, i) => (
          <div className="note" key={i}><div className="when">{new Date(h.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} · {workerName(h.by)}</div>{h.text}</div>))}</div>
      </>}
      <div style={{ height: 24 }} />

      {/* ---------- Feuilles ---------- */}
      {modal?.kind === "step" && step && (
        <Sheet title={`Valider « ${step.label} »`} onClose={close}>
          <p className="small" style={{ marginTop: 0 }}>{step.description}</p>
          <div className="field"><label htmlFor="sd">Date</label><input id="sd" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} /></div>
          {step.detailLabel && <div className="field"><label htmlFor="sx">{step.detailLabel}</label><input id="sx" value={detail} onChange={e => setDetail(e.target.value)} /></div>}
          <button className="btn primary block" disabled={busy || !date} onClick={() => run(() => validateStep(uid, s.id, step.id, step.label, date, detail.trim() || undefined), `Étape « ${step.label} » validée`)}>Valider l'étape</button>
        </Sheet>)}
      {modal?.kind === "cancel" && step && (
        <Sheet title={step.label} onClose={close}>
          <p>Validée le {fullDate(s.steps[step.id].date)}{s.steps[step.id].detail ? ` · ${s.steps[step.id].detail}` : ""}.</p>
          <div className="btnrow"><button className="btn ghost" onClick={close}>Fermer</button>
            <button className="btn danger" disabled={busy} onClick={() => run(() => cancelStep(uid, s.id, step.id, step.label), "Validation annulée")}>Annuler la validation</button></div>
        </Sheet>)}
      {modal?.kind === "note" && (
        <Sheet title={`Note sur ${s.name.split(" ")[0]}`} onClose={close}>
          <div className="field"><label htmlFor="nt">Ce qui s'est dit</label><textarea id="nt" value={text} onChange={e => setText(e.target.value)} placeholder="Ex. Appelée, elle était malade. Revient dimanche." /></div>
          <button className="btn primary block" disabled={busy || !text.trim()} onClick={() => run(() => addNote(s.id, uid, me.name, text.trim()), "Note enregistrée")}>Enregistrer la note</button>
        </Sheet>)}
      {modal?.kind === "edit" && (
        <Sheet title="Modifier les informations" onClose={close}>
          <SoulForm initial={s} submitLabel="Enregistrer" busy={busy} onSubmit={data => run(() => updateSoul(uid, s.id, data), "Informations mises à jour")} />
        </Sheet>)}
      {modal?.kind === "more" && (
        <Sheet title="Actions" onClose={close}>
          <div className="opts">
            {s.state === "active" && manager && <button onClick={() => setModal({ kind: "assign" })}>{s.makerId ? "Changer de faiseur" : "Attribuer à un faiseur"}</button>}
            {s.state === "active" && manager && <button onClick={() => setModal({ kind: "transfer" })}>Transférer vers une autre famille</button>}
            {s.state === "active" && <button disabled={busy} onClick={() => run(() => establishSoul(uid, s.id), "Bravo ! Disciple affermi")}>Marquer comme disciple affermi{k < total && <span className="small">{k}/{total} étapes</span>}</button>}
            {s.state === "active" && <button onClick={() => setModal({ kind: "exit" })}>Sortir du suivi (archiver)</button>}
            {s.state !== "active" && manager && <button disabled={busy} onClick={() => run(() => reinstateSoul(uid, s.id), "Âme réintégrée : elle est dans À attribuer")}>Réintégrer dans le suivi</button>}
            {isCampusAdmin(me.role) && <button style={{ color: "var(--bad)" }} onClick={() => setModal({ kind: "delete" })}>Supprimer définitivement</button>}
          </div>
          {!isCampusAdmin(me.role) && <p className="small" style={{ marginTop: 12 }}>Une âme n'est jamais supprimée : elle est archivée et peut être réintégrée.</p>}
        </Sheet>)}
      {modal?.kind === "assign" && <AssignSheet soul={s} onClose={close} />}
      {modal?.kind === "difficulty" && (
        <Sheet title="Signaler une difficulté" onClose={close}>
          <p className="small" style={{ marginTop: 0 }}>Ton berger la verra dans ton rapport de la semaine.</p>
          <div className="checks" style={{ marginBottom: 12 }}>{settings.difficulties.map(k => <button key={k} className={diffKind === k ? "started" : ""} onClick={() => setDiffKind(k)}>{k}</button>)}</div>
          <div className="field"><label htmlFor="dt">Précisions</label><textarea id="dt" value={text} onChange={e => setText(e.target.value)} placeholder="Ce qui se passe, ce dont elle a besoin" /></div>
          <button className="btn primary block" disabled={busy || !diffKind} onClick={() => run(() => reportDifficulty(me, s.id, diffKind, text.trim()), "Difficulté signalée")}>Signaler</button>
        </Sheet>)}
      {modal?.kind === "formation" && (
        <Sheet title={modal.name} onClose={close}>
          <div className="opts">
            <button disabled={busy} onClick={() => run(() => setFormation(uid, s.id, modal.name, "started"), `${modal.name} : commencée`)}>A commencé la formation</button>
            <button disabled={busy} onClick={() => run(() => setFormation(uid, s.id, modal.name, "done"), `${modal.name} : terminée`)}>A terminé la formation</button>
            {s.formations?.[modal.name] && <button disabled={busy} onClick={() => run(() => setFormation(uid, s.id, modal.name, null), "Formation retirée")}>Retirer</button>}
          </div>
        </Sheet>)}
      {modal?.kind === "transfer" && (
        <Sheet title="Transférer vers une famille" onClose={close}>
          <p className="small" style={{ marginTop: 0 }}>L'âme quitte la famille {familyName(s.familyId)}. Le berger de la famille d'accueil choisira son faiseur.</p>
          <div className="opts">{families.filter(f => f.id !== s.familyId).map(f => (
            <button key={f.id} disabled={busy} onClick={() => run(async () => { await transferSoul(uid, s.id, f.id, f.name); if (!isCampusAdmin(me.role)) nav(-1); }, `Transférée vers ${f.name}`)}>{f.name}</button>))}</div>
        </Sheet>)}
      {modal?.kind === "exit" && (
        <Sheet title="Pourquoi sortir du suivi ?" onClose={close}>
          <div className="opts">{settings.exitReasons.map(r => <button key={r} disabled={busy} onClick={() => run(() => exitSoul(uid, s.id, r), "Âme archivée")}>{r}</button>)}</div>
        </Sheet>)}
      {modal?.kind === "delete" && (
        <Sheet title="Supprimer définitivement ?" onClose={close}>
          <p>La fiche de {s.name} et tout son historique seront perdus. Préfère l'archivage en cas de doute.</p>
          <div className="field"><label htmlFor="cf">Tape SUPPRIMER pour confirmer</label><input id="cf" value={text} onChange={e => setText(e.target.value)} /></div>
          <div className="btnrow"><button className="btn ghost" onClick={close}>Annuler</button>
            <button className="btn danger" disabled={busy || text !== "SUPPRIMER"} onClick={() => run(async () => { await deleteDoc(doc(db, "souls", s.id)); nav("/ames", { replace: true }); }, "Fiche supprimée")}>Supprimer</button></div>
        </Sheet>)}
      {me.role === "maker" && s.makerId !== uid && <p className="small"><Link to="/ames">Retour à mes âmes</Link></p>}
    </div>
  );
}
