import { useEffect, useState } from "react";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { useOnline } from "../../lib/hooks";
import { markAttendance } from "../../lib/api";
import { cap, currentSunday, lastSundays, longDate, today } from "../../lib/dates";
import { STATUS_LABEL } from "../../lib/souls";
import type { Soul } from "../../lib/types";
import { Avatar, Loading, Sheet, Top, frError, useToast } from "../../components/ui";
import { ICloud } from "../../components/Icons";

/** Pointage du dimanche : un seul pointage par âme et par dimanche. */
export default function Sunday() {
  const { profile, settings } = useSession();
  const { active, attendance, pending: waiting, workerName, loading } = useScope();
  const online = useOnline();
  const toast = useToast();
  const [date, setDate] = useState(currentSunday());
  const [askFor, setAskFor] = useState<Soul | null>(null);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(0);
  useEffect(() => { if (online) setPending(0); }, [online]);
  if (loading) return <Loading />;

  const me = profile!;
  const list = active.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
  const isE = (s: Soul) => !!waiting.get(s.id)?.has(date);
  const done = active.filter(s => attendance.get(s.id)?.get(date) || isE(s)).length;
  const nbE = active.filter(isE).length;

  function mark(s: Soul, present: boolean, reason?: string, pend = false) {
    if (!online) setPending(p => p + 1);
    markAttendance(me.id, s, date, present, reason, pend).catch(e => toast(frError(e)));
  }
  function allPresent() {
    const rest = active.filter(s => !attendance.get(s.id)?.get(date) && !isE(s));
    rest.forEach(s => mark(s, true));
    toast(rest.length ? `${rest.length} âme${rest.length > 1 ? "s" : ""} marquée${rest.length > 1 ? "s" : ""} présente${rest.length > 1 ? "s" : ""}` : "Tout le monde est déjà pointé");
  }
  const sundays = lastSundays(4).reverse();

  return (
    <div className="page">
      <Top title="Pointage" sub={cap(longDate(date))} />
      <div className="filters">{sundays.map(v => {
        return <button key={v} aria-pressed={v === date} onClick={() => setDate(v)}>{v === today() ? "Aujourd'hui" : v === currentSunday() ? "Ce dimanche" : longDate(v).replace(/^dimanche /, "Dim. ")}</button>;
      })}</div>
      {(!online || pending > 0) && <div className="sync"><ICloud />Pas de réseau. Les pointages sont gardés sur le téléphone et partiront dès que la connexion revient.</div>}
      <div className="small">{done} sur {active.length} pointées{nbE ? ` · ${nbE} en attente (E), à confirmer au complément du jeudi` : ""}</div>
      <div className="progress"><b style={{ width: `${active.length ? (done / active.length) * 100 : 0}%` }} /></div>
      {active.length > 8 && <div className="field" style={{ margin: "10px 0 0" }}><input placeholder="Chercher un nom" value={q} onChange={e => setQ(e.target.value)} aria-label="Chercher un nom" /></div>}

      {active.length === 0 ? <div className="card empty" style={{ marginTop: 12 }}>Aucune âme à pointer.</div> : (
        <div className="list" style={{ marginTop: 12 }}>{list.map(s => {
          const a = attendance.get(s.id)?.get(date);
          return (
            <div className="row" key={s.id}>
              <Avatar name={s.name} />
              <span className="main-col">
                <div className="name">{s.name}</div>
                <div className="meta">{isE(s) ? <span style={{ color: "var(--warn)" }}>En attente · pas encore de retour</span> : a && !a.present ? <span style={{ color: "var(--bad)" }}>Absent · {a.reason ?? "motif non indiqué"}</span> : me.role === "maker" ? STATUS_LABEL[s.status] : workerName(s.makerId)}</div>
              </span>
              <div className="seg">
                <button className="p" aria-pressed={a?.present === true} aria-label={`${s.name} présent`} onClick={() => mark(s, true)}>P</button>
                <button className="a" aria-pressed={a?.present === false} aria-label={`${s.name} absent`} onClick={() => setAskFor(s)}>A</button>
                <button className="e" aria-pressed={isE(s)} aria-label={`${s.name} en attente, pas encore de retour`} title="En attente : pas encore de retour" onClick={() => mark(s, false, undefined, true)}>E</button>
              </div>
            </div>);
        })}</div>)}
      {active.length > 0 && <div className="btnrow"><button className="btn ghost" onClick={allPresent}>Marquer les autres présents</button></div>}
      <p className="small" style={{ textAlign: "center" }}>P : présent · A : absent · E : en attente (pas encore de retour). Chaque pointage est enregistré tout de suite. Les « E » se confirment au plus tard le jeudi (complément du rapport) : les rapports se mettent à jour tout seuls.</p>

      {askFor && (
        <Sheet title={`Pourquoi ${askFor.name.split(" ")[0]} est absent(e) ?`} onClose={() => setAskFor(null)}>
          <p className="small" style={{ marginTop: 0 }}>Le motif aide à relancer la personne.</p>
          <div className="opts">{settings.absenceReasons.map(r => <button key={r} onClick={() => { mark(askFor, false, r); setAskFor(null); }}>{r}</button>)}</div>
        </Sheet>)}
    </div>
  );
}
