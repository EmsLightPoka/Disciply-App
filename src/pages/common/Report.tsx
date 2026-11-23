import { isCampusAdmin } from "../../lib/types";
import { useMemo, useState } from "react";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { currentSunday, fullDate, lastSundays } from "../../lib/dates";
import { Top, shareText, useToast } from "../../components/ui";
import { ICheck, IShare, ISpark, IUser, IUsers } from "../../components/Icons";

/** Rapport du dimanche : nouvelles âmes par culte et présence des âmes suivies. */
export default function Report() {
  const { profile, settings, myFamily, campus } = useSession();
  const { souls, active, attendance } = useScope();
  const toast = useToast();
  const [date, setDate] = useState(currentSunday());

  const r = useMemo(() => {
    const arrived = souls.filter(s => s.arrivalDate === date);
    const byService = settings.services.map(sv => {
      const l = arrived.filter(s => s.service === sv);
      const nc = l.filter(s => s.status === "NC"), na = l.filter(s => s.status === "NA");
      return { sv, nc: nc.length, ncH: nc.filter(s => s.gender === "H").length, ncF: nc.filter(s => s.gender === "F").length, na: na.length };
    });
    const pointed = active.filter(s => attendance.get(s.id)?.get(date));
    const present = pointed.filter(s => attendance.get(s.id)!.get(date)!.present).length;
    return { arrived, byService, pointed: pointed.length, present };
  }, [souls, active, attendance, date, settings.services]);

  const scopeName = isCampusAdmin(profile!.role) ? (campus?.name ? `Campus ${campus.name}` : settings.churchName) : myFamily ? `Famille ${myFamily.name}` : "";
  const totalNC = r.byService.reduce((a, b) => a + b.nc, 0), totalNA = r.byService.reduce((a, b) => a + b.na, 0);
  const pct = r.pointed ? Math.round((r.present / r.pointed) * 100) : 0;
  const text = [
    `*Rapport du dimanche ${fullDate(date)}*`, scopeName, "",
    ...r.byService.map(x => `${x.sv} : ${x.nc} NC (${x.ncH} H, ${x.ncF} F) · ${x.na} NA`), "",
    `Total : ${totalNC} nouveau${totalNC > 1 ? "x" : ""} converti${totalNC > 1 ? "s" : ""}, ${totalNA} nouvel${totalNA > 1 ? "s" : ""} arrivant${totalNA > 1 ? "s" : ""}`,
    `Âmes suivies présentes : ${r.present} sur ${r.pointed} pointées${r.pointed ? ` (${pct} %)` : ""}`,
    `Âmes en suivi : ${active.length}`
  ].join("\n");

  return (
    <div className="page">
      <Top title="Chiffres du dimanche" sub={scopeName} />
      <div className="filters">{lastSundays(5).reverse().map(d => <button key={d} aria-pressed={d === date} onClick={() => setDate(d)}>{fullDate(d).replace(/ \d{4}$/, "")}</button>)}</div>
      <div className="grid2 grid4" style={{ marginTop: 8 }}>
        <div className="stat"><div className="ic"><ISpark /></div><div className="v">{totalNC}</div><div className="l">nouveaux convertis</div></div>
        <div className="stat"><div className="ic"><IUser /></div><div className="v">{totalNA}</div><div className="l">nouveaux arrivants</div></div>
        <div className="stat"><div className="ic"><ICheck /></div><div className="v">{r.pointed ? `${pct} %` : "—"}</div><div className="l">présence des âmes suivies</div></div>
        <div className="stat"><div className="ic"><IUsers /></div><div className="v">{active.length}</div><div className="l">âmes en suivi</div></div>
      </div>
      <div className="eyebrow">Par culte</div>
      <div className="tablewrap"><table className="t">
        <thead><tr><th>Culte</th><th>NC</th><th>Hommes</th><th>Femmes</th><th>NA</th></tr></thead>
        <tbody>{r.byService.map(x => <tr key={x.sv}><td>{x.sv}</td><td>{x.nc}</td><td>{x.ncH}</td><td>{x.ncF}</td><td>{x.na}</td></tr>)}</tbody>
      </table></div>
      <p className="small">NC : nouveau converti. NA : nouvel arrivant. Les âmes sont comptées selon leur date d'arrivée.</p>
      <div className="eyebrow">Texte à partager</div>
      <div className="card" style={{ whiteSpace: "pre-line", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{text}</div>
      <div className="btnrow"><button className="btn primary" onClick={() => shareText(text, toast)}><IShare />Partager sur WhatsApp</button></div>
    </div>
  );
}
