import { useEffect, useMemo, useState } from "react";
import { collection, doc, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useDocument, useQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { familyReportId, makerReportId, markAttendance, refreshFamilyReport, sendFamilyReport, submitMakerReport } from "../../lib/api";
import { buildFamilyReport, contactsOf, countWeek } from "../../lib/report";
import Dashboard, { ReportShare } from "../../components/Dashboard";
import { addDays, currentSunday, fullDate, lastSundays, today } from "../../lib/dates";
import { isCampusAdmin, isLeader, type FamilyReport, type MakerReport, type UserProfile } from "../../lib/types";
import { Avatar, Top, copyText, frError, useToast } from "../../components/ui";

/** Rapport de la semaine : le faiseur l'envoie le lundi, le berger compile, le pasteur reçoit. */
export default function Reports() {
  const { profile } = useSession();
  const [week, setWeek] = useState(currentSunday());
  const role = profile!.role;
  return (
    <div className="page">
      <Top title={role === "maker" ? "Mon rapport de la semaine" : isLeader(role) ? "Rapports de la famille" : "Rapports reçus"} sub={`Semaine du dimanche ${fullDate(week)}`} />
      <div className="filters">{lastSundays(5).reverse().map(d => <button key={d} aria-pressed={d === week} onClick={() => setWeek(d)}>{fullDate(d).replace(/ \d{4}$/, "")}</button>)}</div>
      {role === "maker" ? <MakerView week={week} /> : isLeader(role) ? <LeaderView week={week} /> : isCampusAdmin(role) ? <PastorView week={week} /> : null}
    </div>
  );
}

function inWeek(at: string, week: string) { const d = at.slice(0, 10); return d >= addDays(week, -6) && d <= addDays(week, 1); }

function MakerView({ week }: { week: string }) {
  const { profile, campusId } = useSession();
  const { active, attendance, pending } = useScope();
  const toast = useToast();
  const me = profile!;
  const sent = useDocument<MakerReport>(doc(db, "reports", makerReportId(week, me.id)), [week, me.id]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const r = useMemo(() => {
    const c = countWeek(active, week, attendance, pending);
    return {
      souls: c.souls, present: c.present, absent: c.absent, pending: c.pending, notPointed: c.notPointed,
      newAssigned: active.filter(s => s.history?.some(h => h.text.startsWith("Attribuée") && inWeek(h.at, week))).length,
      difficulties: active.filter(s => s.difficulty).map(s => ({ soulName: s.name, text: `${s.difficulty!.kind}${s.difficulty!.text ? " : " + s.difficulty!.text : ""}` })),
      formations: active.filter(s => s.formations && Object.keys(s.formations).length).map(s => ({
        soulName: s.name, text: Object.entries(s.formations!).map(([k, v]) => `${k} (${v.status === "done" ? "terminée" : "commencée"})`).join(", ")
      }))
    };
  }, [active, attendance, pending, week]);
  const waiting = active.filter(s => pending.get(s.id)?.has(week));
  const ct = contactsOf(active, week);
  const base = { campusId: campusId!, familyId: me.familyId!, makerId: me.id, makerName: me.name, week };

  // Complément : dès qu'un « E » est confirmé, le rapport déjà envoyé se met à jour tout seul.
  const sd = sent.data;
  useEffect(() => {
    if (!sd || !me.familyId || !campusId) return;
    if (sd.present === r.present && sd.absent === r.absent && (sd.pending ?? 0) === r.pending && sd.notPointed === r.notPointed) return;
    submitMakerReport({ ...r, ...base, comment: sd.comment ?? "" }, true).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sd?.present, sd?.absent, sd?.pending, sd?.notPointed, r.present, r.absent, r.pending, r.notPointed]);

  async function send() {
    setBusy(true);
    try {
      await submitMakerReport({ ...r, ...base, comment: comment.trim() || sent.data?.comment || "" });
      toast("Rapport envoyé à ton berger");
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }
  const mark = (soulId: string, present: boolean) => {
    const s = active.find(x => x.id === soulId)!;
    markAttendance(me.id, s, week, present, present ? undefined : "Motif non indiqué").catch(e => toast(frError(e)));
  };
  const isThursday = new Date().getDay() === 4;

  return <>
    {sent.data && <div className="success">Rapport envoyé{sent.data.submittedAt ? ` le ${sent.data.submittedAt.toDate().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}` : ""}{sent.data.complementAt ? `, complété le ${sent.data.complementAt.toDate().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}` : ""}. Il se met à jour tout seul quand tu confirmes une présence.</div>}
    <Dashboard d={{ ...r, withFi: active.filter(s => s.impactFamilyId).length, answered: ct.answered.length, contacted: ct.answered.length + ct.waiting.length }} />

    <div className="eyebrow">Complément du jeudi{isThursday ? " · c'est aujourd'hui" : ""}</div>
    {waiting.length ? <div className="list">{waiting.map(s => (
      <div className="row" key={s.id}><Avatar name={s.name} />
        <span className="main-col"><div className="name">{s.name}</div><div className="meta">En attente : pas encore de retour</div></span>
        <div className="seg"><button className="p" aria-label={`${s.name} présent`} onClick={() => mark(s.id, true)}>P</button><button className="a" aria-label={`${s.name} absent`} onClick={() => mark(s.id, false)}>A</button></div>
      </div>))}</div>
      : <div className="empty" style={{ padding: 14 }}>Aucune âme en attente pour ce dimanche.</div>}
    <p className="small">Le dimanche et le lundi, pointe P, A ou E (en attente). Le jeudi, confirme les « E » ici : ton rapport, celui du berger et celui du pasteur se mettent à jour tout seuls.</p>

    <div className="eyebrow">Suivi des appels de la semaine</div>
    <div className="list">{ct.answered.length + ct.waiting.length ? [...ct.answered, ...ct.waiting].map(s => <div className="note" key={s.id}><b style={{ fontWeight: 500 }}>{s.name}</b> · {s.lastContact!.answered ? "a répondu" : "pas encore répondu"}{s.lastContact!.text ? ` · ${s.lastContact!.text}` : ""}</div>) : <div className="empty" style={{ padding: 14 }}>Note sur la fiche de chaque âme si elle a répondu à ton appel ou ton message.</div>}</div>

    <div className="eyebrow">Difficultés signalées</div>
    <div className="list">{r.difficulties.length ? r.difficulties.map(d => <div className="note" key={d.soulName}><b style={{ fontWeight: 500 }}>{d.soulName}</b> · {d.text}</div>) : <div className="empty" style={{ padding: 14 }}>Aucune. Signale une difficulté depuis la fiche de l'âme.</div>}</div>
    <div className="eyebrow">Formations</div>
    <div className="list">{r.formations.length ? r.formations.map(d => <div className="note" key={d.soulName}><b style={{ fontWeight: 500 }}>{d.soulName}</b> · {d.text}</div>) : <div className="empty" style={{ padding: 14 }}>Aucune formation commencée.</div>}</div>
    <div className="field" style={{ marginTop: 16 }}><label htmlFor="cm">Commentaire pour ton berger</label><textarea id="cm" defaultValue={sent.data?.comment ?? ""} onChange={e => setComment(e.target.value)} placeholder="Ce qui s'est passé cette semaine, ce dont tu as besoin…" /></div>
    <button className="btn primary block" disabled={busy || !me.familyId} onClick={send}>{sent.data ? "Mettre à jour mon rapport" : "Envoyer mon rapport"}</button>
    <p className="small">Le rapport se remplit tout seul avec ton pointage et tes fiches. Envoie-le chaque lundi.</p>
  </>;
}

function LeaderView({ week }: { week: string }) {
  const { profile, campusId, myFamily } = useSession();
  const { workers, souls, active, attendance, pending } = useScope();
  const toast = useToast();
  const me = profile!;
  const reports = useQuery<MakerReport>(query(collection(db, "reports"), where("campusId", "==", campusId ?? ""), where("familyId", "==", me.familyId ?? ""), where("week", "==", week)), [week, campusId, me.familyId]);
  const sent = useDocument<FamilyReport>(doc(db, "familyReports", familyReportId(week, me.familyId ?? "-")), [week, me.familyId]);
  const pastors = useQuery<UserProfile>(query(collection(db, "users"), where("campusId", "==", campusId ?? ""), where("role", "==", "admin")), [campusId]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const makers = workers.filter(w => w.role === "maker" && w.active);
  const got = new Map(reports.data.map(r => [r.makerId, r]));
  const word = comment.trim() || sent.data?.comment || "";
  const { text, totals } = buildFamilyReport({ familyName: myFamily?.name ?? "", shepherdName: sent.data?.sentByName ?? me.name, week, souls, active, attendance, pending, makers, reports: reports.data, comment: word });

  // Le rapport déjà envoyé au pasteur suit les compléments du jeudi.
  const sentText = sent.data?.text;
  useEffect(() => {
    if (!sentText || !myFamily || !campusId || sentText === text || reports.loading) return;
    refreshFamilyReport(familyReportId(week, myFamily.id), { text, totals, sentBy: me.id, campusId, familyId: myFamily.id }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentText, text, reports.loading]);

  async function send() {
    if (!myFamily || !campusId) return;
    setBusy(true);
    try {
      await sendFamilyReport({ campusId, familyId: myFamily.id, familyName: myFamily.name, week, text, totals, comment: comment.trim(), sentBy: me.id, sentByName: me.name }, pastors.data);
      toast(pastors.data.length ? "Rapport envoyé au leader" : "Rapport enregistré. Aucun leader n'a encore de compte sur ce campus.");
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }

  return <>
    {sent.data && <div className="success">Compilation envoyée par {sent.data.sentByName}. Elle se met à jour toute seule avec les compléments du jeudi.</div>}
    <Dashboard d={totals} />
    <div className="eyebrow">Rapports des faiseurs · {reports.data.length} sur {makers.length}</div>
    <div className="list">{makers.map(m => { const r = got.get(m.id); const c = countWeek(active.filter(s => s.makerId === m.id), week, attendance, pending); return (
      <div className="note" key={m.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontWeight: 500 }}>{m.name}</b>{r ? <span className="chip ok">{r.complementAt ? "Complété" : "Reçu"}</span> : <span className="chip warn">Pas encore de rapport</span>}</div>
        <div className="small">{c.souls} âmes · {c.present} P · {c.absent} A · {c.pending} E{c.notPointed ? ` · ${c.notPointed} non pointées` : ""}{r?.comment ? ` · « ${r.comment} »` : ""}</div>
      </div>); })}
      {makers.length === 0 && <div className="empty">Aucun faiseur dans la famille.</div>}</div>
    <div className="eyebrow">Compilation pour le leader et le pasteur principal</div>
    <div className="field"><label htmlFor="bc">Mot du berger (facultatif)</label><textarea id="bc" defaultValue={sent.data?.comment ?? ""} onChange={e => setComment(e.target.value)} /></div>
    <div className="card pre">{text}</div>
    <div className="btnrow">
      <button className="btn ghost" onClick={async () => toast((await copyText(text)) ? "Texte copié" : "Copie impossible")}>Copier</button>
      <button className="btn primary" disabled={busy} onClick={send}>{sent.data ? "Renvoyer dans l'app" : "Envoyer dans l'app"}</button>
    </div>
    <p className="small">Pour ceux qui ne sont pas sur l'app : envoie aussi le rapport au pasteur principal ou dans le groupe WhatsApp de la famille.</p>
    <ReportShare title={`Rapport famille ${myFamily?.name ?? ""}, semaine du ${fullDate(week)}`} text={text} toast={toast} />
  </>;
}

function PastorView({ week }: { week: string }) {
  const { campusId, families } = useSession();
  const { souls, active, attendance, pending, workers, workerName } = useScope();
  const toast = useToast();
  const list = useQuery<FamilyReport>(query(collection(db, "familyReports"), where("campusId", "==", campusId ?? ""), where("week", "==", week)), [campusId, week]);
  const reps = useQuery<MakerReport>(query(collection(db, "reports"), where("campusId", "==", campusId ?? ""), where("week", "==", week)), [campusId, week]);
  const got = new Map(list.data.map(r => [r.familyId, r]));
  const [openId, setOpenId] = useState<string | null>(null);
  // Toujours recalculé en direct : les compléments du jeudi apparaissent sans attendre.
  const live = families.map(f => {
    const fr = got.get(f.id);
    const b = buildFamilyReport({ familyName: f.name, shepherdName: fr?.sentByName ?? workerName(f.shepherdId), week,
      souls: souls.filter(s => s.familyId === f.id), active: active.filter(s => s.familyId === f.id), attendance, pending,
      makers: workers.filter(w => w.role === "maker" && w.active && w.familyId === f.id), reports: reps.data.filter(r => r.familyId === f.id), comment: fr?.comment });
    return { f, fr, ...b };
  });
  const sentList = live.filter(x => x.fr);
  const missing = live.filter(x => !x.fr).map(x => x.f.name);
  const total = live.reduce((a, x) => ({ souls: a.souls + x.totals.souls, present: a.present + x.totals.present, absent: a.absent + x.totals.absent, pending: a.pending + x.totals.pending, notPointed: a.notPointed + x.totals.notPointed, newSouls: a.newSouls + x.totals.newSouls, withFi: a.withFi + x.totals.withFi, answered: a.answered + x.totals.answered, contacted: a.contacted + x.totals.contacted, reports: a.reports + x.totals.reports, makers: a.makers + x.totals.makers }),
    { souls: 0, present: 0, absent: 0, pending: 0, notPointed: 0, newSouls: 0, withFi: 0, answered: 0, contacted: 0, reports: 0, makers: 0 });
  const all = sentList.map(x => x.text).join("\n\n────────\n\n");
  void toast; void today;

  return <>
    <p className="small" style={{ margin: "0 2px 8px" }}><b>{sentList.length} sur {families.length}</b> familles ont envoyé leur rapport.</p>
    <Dashboard d={total} />
    <div className="eyebrow">Rapports des familles · mis à jour en direct</div>
    <div className="list">{live.map(x => (
      <div key={x.f.id}>
        <button className="row" onClick={() => setOpenId(openId === x.f.id ? null : x.f.id)}>
          <span className="main-col"><div className="name">Famille {x.f.name}</div><div className="meta">{x.fr ? `Envoyé par ${x.fr.sentByName}` : "Pas encore envoyé par le berger"} · {x.totals.souls} âmes · {x.totals.present} P · {x.totals.absent} A · {x.totals.pending} E · {x.totals.reports}/{x.totals.makers} rapports</div></span>
          <span className="small">{openId === x.f.id ? "Fermer" : "Lire"}</span>
        </button>
        {openId === x.f.id && <><div className="note pre">{x.text}</div><ReportShare title={`Rapport famille ${x.f.name}, semaine du ${fullDate(week)}`} text={x.text} toast={toast} /></>}
      </div>))}
      {live.length === 0 && <div className="empty">Aucune famille.</div>}</div>
    {missing.length > 0 && <p className="small">Pas encore envoyé : {missing.join(", ")}.</p>}
    {sentList.length > 0 && <><div className="eyebrow">Tous les rapports de la semaine</div><ReportShare title={`Rapports des familles, semaine du ${fullDate(week)}`} text={all} toast={toast} /></>}
  </>;
}
