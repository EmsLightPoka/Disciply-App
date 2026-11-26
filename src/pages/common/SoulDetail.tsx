import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collection, doc, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useDocument, useQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import type { Note, Soul } from "../../lib/types";
import { addNote, cancelStep, deleteSoulLogged, establishSoul, exitSoul, logContact, markImpactNotified, reinstateSoul, reportDifficulty, resolveDifficulty, setFormation, setNoContact, transferSoul, transferSoulCampus, updateSoul, validateStep } from "../../lib/api";
import { fill, waLink } from "../../lib/invite";
import { DEFAULT_SETTINGS, isGlobal, type Family } from "../../lib/types";
import { getDocs, where } from "firebase/firestore";
import { isCampusAdmin, isLeader } from "../../lib/types";
import AssignSheet from "../../components/AssignSheet";
import { fullDate, lastSundays, shortDate, today } from "../../lib/dates";
import { STATUS_LABEL, ageBand, stepCount, telHref, waHref } from "../../lib/souls";
import { Avatar, Loading, Sheet, Top, frError, useToast } from "../../components/ui";
import { IChat, IPhone, IPlus } from "../../components/Icons";
import SoulForm from "./SoulForm";
import { suggestImpact } from "../../lib/impact";
import { IMPACT_LABEL } from "../../lib/types";

type Modal = null | { kind: "step"; stepId: string } | { kind: "cancel"; stepId: string } | { kind: "note" } | { kind: "edit" }
  | { kind: "more" } | { kind: "assign" } | { kind: "transfer" } | { kind: "exit" } | { kind: "delete" } | { kind: "difficulty" } | { kind: "formation"; name: string }
  | { kind: "contact"; answered: boolean } | { kind: "nocontact" } | { kind: "campus" };

export default function SoulDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { profile, settings, families, familyName } = useSession();
  const { attendance, pending: pendingMap, streak, workerName } = useScope();
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
          {s.becameMaker && <span className="chip ok">Devenue faiseur de disciples</span>}
        </div>
        <div className="small">Famille {familyName(s.familyId)} · {s.makerId ? `suivie par ${workerName(s.makerId)}` : "pas encore attribuée"}</div>
      </div>

      {s.noContact && <div className="error" style={{ marginBottom: 12 }}><b>Ne souhaite plus être contactée</b> depuis le {shortDate(s.noContact.at)}{s.noContact.byName ? ` (noté par ${s.noContact.byName})` : ""}{s.noContact.reason ? ` · ${s.noContact.reason}` : ""}. Sa volonté passe avant tout : pas d'appel, pas de message, pas d'invitation.
        {manager && <div className="btnrow"><button className="btn ghost sm" disabled={busy} onClick={() => run(() => setNoContact(me, s.id, false), "Elle peut de nouveau être contactée")}>Elle accepte à nouveau d'être contactée</button></div>}</div>}

      {s.phone && !s.noContact && <div className="actions2">
        <a className="call" href={telHref(s.phone)}><IPhone />Appeler</a>
        <a className="wa" href={waHref(s.phone)} target="_blank" rel="noreferrer"><IChat />WhatsApp</a>
      </div>}

      {!s.noContact && s.state === "active" && <>
        <div className="eyebrow">Suivi des appels et messages</div>
        <div className="card">
          <p style={{ margin: "0 0 10px" }}>{s.lastContact ? <>Dernier contact le {new Date(s.lastContact.at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : <b>{s.lastContact.answered ? "a répondu" : "pas encore répondu"}</b>{s.lastContact.text ? ` · ${s.lastContact.text}` : ""}</> : "Après un appel ou un message WhatsApp, note si l'âme a répondu. C'est repris dans ton rapport."}</p>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn primary sm" onClick={() => setModal({ kind: "contact", answered: true })}>A répondu</button>
            <button className="btn ghost sm" onClick={() => setModal({ kind: "contact", answered: false })}>Pas encore répondu</button>
          </div>
        </div>
      </>}

      {k === total && s.state !== "exited" && !s.becameMaker && manager && <div className="hero" style={{ margin: "16px 0" }}>
        <span className="big">Toutes les étapes sont validées</span>
        <span className="small">{s.name.split(" ")[0]} peut devenir faiseur de disciples.</span>
        <Link className="btn grad" style={{ alignSelf: "flex-start" }} to={`/equipe?inviter=1&ame=${s.id}`}>Passer à l'étape faiseur de disciples</Link>
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

      <ImpactCard s={s} />

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
        const e = !a && pendingMap.get(s.id)?.has(d);
        return <span key={d} className={"pill " + (a ? (a.present ? "p" : "a") : e ? "e" : "n")} title={`${shortDate(d)} : ${a ? (a.present ? "présent" : "absent" + (a.reason ? " (" + a.reason + ")" : "")) : e ? "en attente (pas encore de retour)" : "non pointé"}`}>{a ? (a.present ? "P" : "A") : e ? "E" : "–"}</span>;
      })}</div>

      <div className="eyebrow">Notes <button className="btn ghost sm" style={{ flex: "none" }} onClick={() => setModal({ kind: "note" })}><IPlus />Ajouter</button></div>
      <div className="list">{notesQ.data.length ? notesQ.data.map(n => (
        <div className="note" key={n.id}><div className="when">{n.createdAt ? n.createdAt.toDate().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "À l'instant"} · {n.authorName}</div>{n.text}</div>
      )) : <div className="empty" style={{ padding: 16 }}>Pas encore de note. Après un appel, note ce qui s'est dit.</div>}</div>

      <div className="eyebrow">Informations <button className="btn ghost sm" style={{ flex: "none" }} onClick={() => setModal({ kind: "edit" })}>Modifier</button></div>
      <div className="card"><dl className="kv">
        <dt>Téléphone</dt><dd>{s.phone || "—"}</dd>
        <dt>Âge</dt><dd>{s.age != null ? `${s.age} ans · ${ageBand(s.age)}` : "—"}</dd>
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
            {isGlobal(me.role) && <button onClick={() => setModal({ kind: "campus" })}>Transférer vers un autre campus</button>}
            {!s.noContact && <button onClick={() => setModal({ kind: "nocontact" })}>Ne souhaite plus être contactée</button>}
            {s.state === "active" && <button disabled={busy} onClick={() => run(() => establishSoul(uid, s.id), "Bravo ! Disciple affermi")}>Marquer comme disciple affermi{k < total && <span className="small">{k}/{total} étapes</span>}</button>}
            {s.state === "active" && <button onClick={() => setModal({ kind: "exit" })}>Sortir du suivi (archiver)</button>}
            {s.state !== "active" && manager && <button disabled={busy} onClick={() => run(() => reinstateSoul(uid, s.id), "Âme réintégrée : elle est dans À attribuer")}>Réintégrer dans le suivi</button>}
            {isCampusAdmin(me.role) && <button style={{ color: "var(--bad)" }} onClick={() => setModal({ kind: "delete" })}>Supprimer définitivement</button>}
          </div>
          <p className="small" style={{ marginTop: 12 }}>Tout est daté et signé dans l'historique. {isCampusAdmin(me.role) ? "Une suppression laisse une trace dans le journal du campus." : "Une âme n'est jamais supprimée : elle est archivée et peut être réintégrée."}</p>
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
          <p className="small" style={{ marginTop: 0 }}>L'âme quitte la famille {familyName(s.familyId)} avec tout son historique. Le berger de la famille d'accueil choisira son faiseur.</p>
          <div className="opts">{families.filter(f => f.id !== s.familyId).map(f => (
            <button key={f.id} disabled={busy} onClick={() => run(async () => { await transferSoul(uid, s.id, f.id, f.name); if (!isCampusAdmin(me.role)) nav(-1); }, `Transférée vers ${f.name}`)}>{f.name}</button>))}</div>
        </Sheet>)}
      {modal?.kind === "exit" && (
        <Sheet title="Pourquoi sortir du suivi ?" onClose={close}>
          <div className="opts">{settings.exitReasons.map(r => <button key={r} disabled={busy} onClick={() => run(() => exitSoul(uid, s.id, r), "Âme archivée")}>{r}</button>)}</div>
        </Sheet>)}
      {modal?.kind === "delete" && (
        <Sheet title="Supprimer définitivement ?" onClose={close}>
          <p>La fiche de {s.name} et tout son historique seront perdus. La suppression reste notée dans le journal du campus (qui, quand). Préfère l'archivage en cas de doute.</p>
          <div className="field"><label htmlFor="cf">Tape SUPPRIMER pour confirmer</label><input id="cf" value={text} onChange={e => setText(e.target.value)} /></div>
          <div className="btnrow"><button className="btn ghost" onClick={close}>Annuler</button>
            <button className="btn danger" disabled={busy || text !== "SUPPRIMER"} onClick={() => run(async () => { await deleteSoulLogged(me, s); nav("/ames", { replace: true }); }, "Fiche supprimée")}>Supprimer</button></div>
        </Sheet>)}
      {modal?.kind === "contact" && (
        <Sheet title={modal.answered ? "L'âme a répondu" : "Pas encore de réponse"} onClose={close}>
          <div className="field"><label htmlFor="ct">Ce qui s'est dit (facultatif)</label><textarea id="ct" value={text} onChange={e => setText(e.target.value)} placeholder={modal.answered ? "Ex. Elle viendra dimanche avec sa sœur." : "Ex. Appelée deux fois, message WhatsApp envoyé."} /></div>
          <button className="btn primary block" disabled={busy} onClick={() => run(() => logContact(me, s.id, modal.answered, text.trim()), "Suivi enregistré : il apparaîtra dans ton rapport")}>Enregistrer</button>
        </Sheet>)}
      {modal?.kind === "nocontact" && (
        <Sheet title="Ne souhaite plus être contactée" onClose={close}>
          <p className="small" style={{ marginTop: 0 }}>Sa volonté passe avant tout. Les boutons d'appel, de message et d'invitation disparaissent pour elle. C'est daté et signé à ton nom.</p>
          <div className="field"><label htmlFor="nc">Précision (facultatif)</label><input id="nc" value={text} onChange={e => setText(e.target.value)} placeholder="Ex. Demandé par téléphone le 12/11" /></div>
          <button className="btn danger block" disabled={busy} onClick={() => run(() => setNoContact(me, s.id, true, text.trim()), "C'est noté : elle ne sera plus contactée")}>Confirmer</button>
        </Sheet>)}
      {modal?.kind === "campus" && <CampusTransfer s={s} onClose={close} />}
      {me.role === "maker" && s.makerId !== uid && <p className="small"><Link to="/ames">Retour à mes âmes</Link></p>}
    </div>
  );
}

/** Famille d'impact de l'âme : la plus proche de son quartier, avec les contacts du pilote et de l'hôte. */
function ImpactCard({ s }: { s: Soul }) {
  const { profile, settings } = useSession();
  const { impact } = useScope();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const fi = impact.find(f => f.id === s.impactFamilyId);
  const sugg = suggestImpact(s, impact);
  const best = sugg[0]?.near ? sugg[0].f : null;
  const choose = (id: string | null) => updateSoul(profile!.id, s.id, { impactFamilyId: id }).then(() => { toast(id ? "Famille d'impact attribuée" : "Famille d'impact retirée"); setOpen(false); }).catch(e => toast(frError(e)));
  if (!impact.length && !fi) return null;
  const fiMsg = (who: string) => fill(settings.impactMessage ?? DEFAULT_SETTINGS.impactMessage!, {
    pilote: who.split(" ")[0] || "", ame: s.name, telephone: s.phone || "non renseigné", quartier: s.neighborhood || "non renseigné",
    age: s.age != null ? `${s.age} ans` : "âge non renseigné", jour: fi?.kind === "FIJ" ? "mardi" : "jeudi", fi: fi?.name ?? "" });
  return <>
    <div className="eyebrow">Famille d'impact</div>
    {fi ? <div className="card">
      <div className="serve"><b>{fi.name}</b><span className="chip">{IMPACT_LABEL[fi.kind]}</span></div>
      <p className="small" style={{ margin: "6px 0" }}>{fi.quartiers.join(", ")}{fi.address ? ` · ${fi.address}` : ""}</p>
      {[["Pilote", fi.pilotName, fi.pilotPhone], ["Hôte", fi.hostName, fi.hostPhone]].map(([l, n, p]) => (
        <div className="row" key={l} style={{ padding: "8px 0", border: 0, background: "none", boxShadow: "none" }}>
          <span className="main-col"><div className="name">{n || "—"}</div><div className="meta">{l}{p ? ` · ${p}` : ""}</div></span>
          {p && <a className="iconbtn call" href={telHref(p)} aria-label={`Appeler ${l.toLowerCase()}`}><IPhone /></a>}
          {p && <a className="iconbtn" href={waHref(p)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${l.toLowerCase()}`}><IChat /></a>}
        </div>))}
      {!s.noContact && <div className="btnrow">
        {[["pilote", fi.pilotName, fi.pilotPhone], ["hôte", fi.hostName, fi.hostPhone]].filter(x => x[2]).map(([l, n, p]) => (
          <a key={l} className="btn primary sm" href={waLink(p, fiMsg(n))} target="_blank" rel="noreferrer" onClick={() => markImpactNotified(profile!.id, s.id, fi.name).catch(() => {})}><IChat />Prévenir {l === "pilote" ? "le pilote" : "l'hôte"}</a>))}
      </div>}
      <p className="small" style={{ margin: "6px 0 0" }}>{s.impactNotifiedAt ? `Pilote et hôte prévenus le ${shortDate(s.impactNotifiedAt)}.` : `Préviens le pilote et l'hôte pour qu'ils appellent ${s.name.split(" ")[0]} avant ${fi.kind === "FIJ" ? "mardi" : "jeudi"}.`}</p>
      <div className="btnrow"><button className="btn ghost sm" onClick={() => setOpen(true)}>Changer</button></div>
    </div> : <div className="card">
      <p style={{ margin: "0 0 10px" }}>{best ? <>La plus proche de {s.neighborhood} : <b>{best.name}</b> ({IMPACT_LABEL[best.kind]}).</> : s.neighborhood ? `Aucune famille d'impact ne couvre encore le quartier ${s.neighborhood}.` : "Indique le quartier de l'âme pour trouver la famille d'impact la plus proche."}</p>
      <div className="btnrow" style={{ marginTop: 0 }}>{best && <button className="btn primary sm" onClick={() => choose(best.id)}>Attribuer {best.name}</button>}<button className="btn ghost sm" onClick={() => setOpen(true)}>Choisir</button></div>
    </div>}
    {open && <Sheet title="Choisir une famille d'impact" onClose={() => setOpen(false)}>
      <p className="small" style={{ marginTop: 0 }}>{s.age != null ? `${s.age} ans${s.age < 25 ? " : les familles d'impact jeunes (mardi) sont proposées en premier." : "."}` : "Âge non renseigné : indique-le dans Informations, Modifier."}</p>
      <div className="list">{sugg.map(({ f, near }) => (
        <button key={f.id} className="row" onClick={() => choose(f.id)} aria-pressed={f.id === s.impactFamilyId}>
          <span className="main-col"><div className="name">{f.name}{f.id === s.impactFamilyId ? " · actuelle" : ""}</div><div className="meta">{IMPACT_LABEL[f.kind]} · {f.quartiers.join(", ")}</div></span>
          {near >= 2 && <span className="chip ok">Proche</span>}
        </button>))}</div>
      {s.impactFamilyId && <div className="btnrow"><button className="btn ghost" onClick={() => choose(null)}>Retirer la famille d'impact</button></div>}
    </Sheet>}
  </>;
}


/** Super admin ou pasteur principal : transfert vers un autre campus, avec tout l'historique (fiche, notes, présences). */
function CampusTransfer({ s, onClose }: { s: Soul; onClose: () => void }) {
  const { campuses, profile } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const [camp, setCamp] = useState("");
  const [fams, setFams] = useState<Family[]>([]);
  const [busy, setBusy] = useState(false);
  async function pickCampus(id: string) {
    setCamp(id);
    const q = await getDocs(query(collection(db, "families"), where("campusId", "==", id)));
    setFams(q.docs.map(d => ({ id: d.id, ...d.data() }) as Family).sort((a, b) => a.name.localeCompare(b.name, "fr")));
  }
  const c = campuses.find(x => x.id === camp);
  return (
    <Sheet title="Transférer vers un autre campus" onClose={onClose}>
      <p className="small" style={{ marginTop: 0 }}>La fiche part avec tout son historique : étapes, formations, notes et présences. Le berger d'accueil choisira son faiseur.</p>
      {!camp ? <div className="opts">{campuses.filter(x => x.id !== s.campusId).map(x => <button key={x.id} onClick={() => pickCampus(x.id)}>{x.name}</button>)}</div> : <>
        <p><b>{c?.name}</b> : choisis la famille d'accueil.</p>
        <div className="opts">{fams.map(f => <button key={f.id} disabled={busy} onClick={async () => {
          setBusy(true);
          try { await transferSoulCampus(profile!.id, s, camp, c?.name ?? "", f.id, f.name); toast(`Transférée vers ${c?.name}, famille ${f.name}`); onClose(); nav("/ames", { replace: true }); }
          catch (e) { toast(frError(e)); } finally { setBusy(false); }
        }}>{f.name}</button>)}
          {fams.length === 0 && <p className="small">Ce campus n'a pas encore de famille.</p>}
          <button onClick={() => setCamp("")}>← Autre campus</button></div>
      </>}
    </Sheet>);
}
