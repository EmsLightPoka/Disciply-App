import { useMemo, useState } from "react";
import { collection, doc, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useDocument, useQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { familyReportId, makerReportId, sendFamilyReport, submitMakerReport } from "../../lib/api";
import { addDays, currentSunday, fullDate, lastSundays } from "../../lib/dates";
import { isCampusAdmin, isLeader, type FamilyReport, type MakerReport, type UserProfile } from "../../lib/types";
import { Top, copyText, frError, shareText, useToast } from "../../components/ui";
import { IAlert, ICal, ICheck, IReport, IShare, IUsers } from "../../components/Icons";

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
  const { active, attendance } = useScope();
  const toast = useToast();
  const me = profile!;
  const sent = useDocument<MakerReport>(doc(db, "reports", makerReportId(week, me.id)), [week, me.id]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const r = useMemo(() => {
    const present = active.filter(s => attendance.get(s.id)?.get(week)?.present === true).length;
    const absent = active.filter(s => attendance.get(s.id)?.get(week)?.present === false).length;
    return {
      souls: active.length, present, absent, notPointed: active.length - present - absent,
      newAssigned: active.filter(s => s.history?.some(h => h.text.startsWith("Attribuée") && inWeek(h.at, week))).length,
      difficulties: active.filter(s => s.difficulty).map(s => ({ soulName: s.name, text: `${s.difficulty!.kind}${s.difficulty!.text ? " : " + s.difficulty!.text : ""}` })),
      formations: active.filter(s => s.formations && Object.keys(s.formations).length).map(s => ({
        soulName: s.name, text: Object.entries(s.formations!).map(([k, v]) => `${k} (${v.status === "done" ? "terminée" : "commencée"})`).join(", ")
      }))
    };
  }, [active, attendance, week]);

  async function send() {
    setBusy(true);
    try {
      await submitMakerReport({ ...r, campusId: campusId!, familyId: me.familyId!, makerId: me.id, makerName: me.name, week, comment: comment.trim() || sent.data?.comment || "" });
      toast("Rapport envoyé à ton berger");
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }

  return <>
    {sent.data && <div className="success">Rapport envoyé {sent.data.submittedAt ? `le ${sent.data.submittedAt.toDate().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}` : ""}. Tu peux le renvoyer pour le mettre à jour.</div>}
    <div className="grid2 grid4">
      <div className="stat"><div className="ic"><IUsers /></div><div className="v">{r.souls}</div><div className="l">âmes suivies</div></div>
      <div className="stat"><div className="ic"><ICheck /></div><div className="v">{r.present}</div><div className="l">présentes dimanche</div></div>
      <div className="stat"><div className="ic bad"><IAlert /></div><div className="v">{r.absent}</div><div className="l">absentes</div></div>
      <div className="stat"><div className="ic"><ICal /></div><div className="v">{r.notPointed}</div><div className="l">non pointées</div></div>
    </div>
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
  const { workers, souls, active, attendance } = useScope();
  const toast = useToast();
  const me = profile!;
  const reports = useQuery<MakerReport>(query(collection(db, "reports"), where("campusId", "==", campusId ?? ""), where("familyId", "==", me.familyId ?? ""), where("week", "==", week)), [week, campusId, me.familyId]);
  const sent = useDocument<FamilyReport>(doc(db, "familyReports", familyReportId(week, me.familyId ?? "-")), [week, me.familyId]);
  const pastors = useQuery<UserProfile>(query(collection(db, "users"), where("campusId", "==", campusId ?? ""), where("role", "==", "admin")), [campusId]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const makers = workers.filter(w => w.role === "maker" && w.active);
  const got = new Map(reports.data.map(r => [r.makerId, r]));

  const totals = useMemo(() => {
    const present = active.filter(s => attendance.get(s.id)?.get(week)?.present === true).length;
    const absent = active.filter(s => attendance.get(s.id)?.get(week)?.present === false).length;
    const newSouls = souls.filter(s => s.arrivalDate >= addDays(week, -6) && s.arrivalDate <= week).length;
    return { souls: active.length, present, absent, newSouls, reports: reports.data.length, makers: makers.length };
  }, [active, souls, attendance, week, reports.data.length, makers.length]);

  const famName = myFamily?.name ?? "";
  const text = [
    `*RAPPORT HEBDOMADAIRE · FAMILLE ${famName.toUpperCase()}*`,
    `Semaine du dimanche ${fullDate(week)}`,
    `Berger : ${me.name}`, "",
    "*1. Chiffres*",
    `Âmes en suivi : ${totals.souls}`,
    `Présentes dimanche : ${totals.present} · Absentes : ${totals.absent} · Non pointées : ${totals.souls - totals.present - totals.absent}`,
    `Nouvelles âmes reçues : ${totals.newSouls}`,
    `Rapports reçus : ${totals.reports} sur ${totals.makers} faiseurs`, "",
    "*2. Par faiseur*",
    ...makers.map(m => { const r = got.get(m.id); return r ? `• ${m.name} : ${r.souls} âmes, ${r.present} présentes, ${r.absent} absentes` : `• ${m.name} : rapport non reçu`; }), "",
    "*3. Difficultés*",
    ...(reports.data.flatMap(r => r.difficulties.map(d => `• ${d.soulName} (${r.makerName}) : ${d.text}`)).concat(reports.data.some(r => r.difficulties.length) ? [] : ["Aucune difficulté signalée"])), "",
    "*4. Formations*",
    ...(reports.data.flatMap(r => r.formations.map(d => `• ${d.soulName} : ${d.text}`)).concat(reports.data.some(r => r.formations.length) ? [] : ["Aucune formation en cours"])),
    ...(comment.trim() || sent.data?.comment ? ["", "*5. Mot du berger*", comment.trim() || sent.data!.comment] : [])
  ].join("\n");

  async function send() {
    if (!myFamily || !campusId) return;
    setBusy(true);
    try {
      await sendFamilyReport({ campusId, familyId: myFamily.id, familyName: myFamily.name, week, text, totals, comment: comment.trim(), sentBy: me.id, sentByName: me.name }, pastors.data);
      toast(pastors.data.length ? "Rapport envoyé au pasteur" : "Rapport enregistré. Aucun pasteur n'a encore de compte sur ce campus.");
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }

  return <>
    {sent.data && <div className="success">Compilation envoyée au pasteur par {sent.data.sentByName}. Tu peux la renvoyer si tu reçois d'autres rapports.</div>}
    <div className="eyebrow">Rapports des faiseurs · {reports.data.length} sur {makers.length}</div>
    <div className="list">{makers.map(m => { const r = got.get(m.id); return (
      <div className="note" key={m.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontWeight: 500 }}>{m.name}</b>{r ? <span className="chip ok">Reçu</span> : <span className="chip warn">En attente</span>}</div>
        {r && <div className="small">{r.souls} âmes · {r.present} présentes · {r.absent} absentes{r.difficulties.length ? ` · ${r.difficulties.length} difficulté(s)` : ""}{r.comment ? ` · « ${r.comment} »` : ""}</div>}
      </div>); })}
      {makers.length === 0 && <div className="empty">Aucun faiseur dans la famille.</div>}</div>
    <div className="eyebrow">Compilation pour le pasteur</div>
    <div className="field"><label htmlFor="bc">Mot du berger (facultatif)</label><textarea id="bc" defaultValue={sent.data?.comment ?? ""} onChange={e => setComment(e.target.value)} /></div>
    <div className="card pre">{text}</div>
    <div className="btnrow">
      <button className="btn ghost" onClick={async () => toast((await copyText(text)) ? "Texte copié" : "Copie impossible")}>Copier</button>
      <button className="btn primary" disabled={busy} onClick={send}>Envoyer au pasteur</button>
    </div>
  </>;
}

function PastorView({ week }: { week: string }) {
  const { campusId, families } = useSession();
  const toast = useToast();
  const list = useQuery<FamilyReport>(query(collection(db, "familyReports"), where("campusId", "==", campusId ?? ""), where("week", "==", week)), [campusId, week]);
  const got = new Map(list.data.map(r => [r.familyId, r]));
  const [openId, setOpenId] = useState<string | null>(null);
  const missing = families.filter(f => !got.has(f.id));
  const total = list.data.reduce((a, r) => ({ souls: a.souls + r.totals.souls, present: a.present + r.totals.present, newSouls: a.newSouls + r.totals.newSouls }), { souls: 0, present: 0, newSouls: 0 });
  const all = list.data.map(r => r.text).join("\n\n────────\n\n");

  return <>
    <div className="grid2 grid4">
      <div className="stat"><div className="ic"><IReport /></div><div className="v">{list.data.length}/{families.length}</div><div className="l">familles ont envoyé</div></div>
      <div className="stat"><div className="ic"><IUsers /></div><div className="v">{total.souls}</div><div className="l">âmes suivies</div></div>
      <div className="stat"><div className="ic"><ICheck /></div><div className="v">{total.present}</div><div className="l">présentes dimanche</div></div>
      <div className="stat"><div className="ic"><IUsers /></div><div className="v">{total.newSouls}</div><div className="l">nouvelles âmes</div></div>
    </div>
    <div className="eyebrow">Rapports des familles</div>
    <div className="list">{list.data.map(r => (
      <div key={r.id}>
        <button className="row" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
          <span className="main-col"><div className="name">Famille {r.familyName}</div><div className="meta">Envoyé par {r.sentByName} · {r.totals.souls} âmes · {r.totals.present} présentes · {r.totals.reports}/{r.totals.makers} rapports</div></span>
          <span className="small">{openId === r.id ? "Fermer" : "Lire"}</span>
        </button>
        {openId === r.id && <div className="note pre">{r.text}</div>}
      </div>))}
      {list.data.length === 0 && <div className="empty">Aucun rapport reçu pour cette semaine.</div>}</div>
    {missing.length > 0 && <p className="small">En attente : {missing.map(f => f.name).join(", ")}.</p>}
    {list.data.length > 0 && <div className="btnrow"><button className="btn primary" onClick={() => shareText(all, toast)}><IShare />Partager tous les rapports</button></div>}
  </>;
}
