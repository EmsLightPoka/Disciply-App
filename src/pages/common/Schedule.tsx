import { useMemo, useState } from "react";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { addService, removeService } from "../../lib/api";
import { cap, fullDate, iso, today } from "../../lib/dates";
import { isCampusAdmin } from "../../lib/types";
import { Top, frError, useToast } from "../../components/ui";

/** Programme de service : pour chaque dimanche du mois et chaque culte, la famille qui sert. */
export default function Schedule() {
  const { profile, settings, families, familyName, campusId } = useSession();
  const { services } = useScope();
  const toast = useToast();
  const admin = isCampusAdmin(profile!.role);
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [busy, setBusy] = useState(false);

  const sundays = useMemo(() => {
    const out: string[] = [];
    const d = new Date(month);
    d.setDate(1 + ((7 - d.getDay()) % 7));
    while (d.getMonth() === month.getMonth()) { out.push(iso(d)); d.setDate(d.getDate() + 7); }
    return out;
  }, [month]);
  const label = cap(month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const at = (date: string, slot: string) => services.find(s => s.date === date && s.slot === slot);

  async function choose(date: string, slot: string, slotIndex: number, familyId: string) {
    if (!campusId) return;
    setBusy(true);
    try {
      const cur = at(date, slot);
      if (cur) await removeService(cur);
      if (familyId) await addService(campusId, date, slot, slotIndex, familyId);
      toast(familyId ? `${familyName(familyId)} sert au ${slot} du ${fullDate(date)}` : "Culte libéré");
    } catch (e) { toast(frError(e)); } finally { setBusy(false); }
  }

  const mine = services.filter(s => s.familyId === profile!.familyId && s.date >= today());

  return (
    <div className="page wide">
      <Top title="Programme de service" sub={admin ? "Choisis la famille qui sert à chaque culte. Seules ces familles pourront enregistrer les nouvelles âmes ce jour-là." : "Les cultes où les familles servent ce mois-ci."} />
      {!admin && <div className="card" style={{ marginBottom: 12 }}>
        <b style={{ fontWeight: 500 }}>Prochains services de ma famille</b>
        {mine.length ? <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{mine.map(s => <li key={s.id}>{cap(fullDate(s.date))}, {s.slot}</li>)}</ul> : <p className="small" style={{ margin: "4px 0 0" }}>Aucun service prévu pour l'instant.</p>}
      </div>}
      <div className="serve" style={{ marginBottom: 10 }}>
        <button className="btn ghost sm" onClick={() => shift(-1)} aria-label="Mois précédent">←</button>
        <h2 style={{ fontSize: 18, minWidth: 150, textAlign: "center" }}>{label}</h2>
        <button className="btn ghost sm" onClick={() => shift(1)} aria-label="Mois suivant">→</button>
      </div>
      {admin && families.length === 0 && <div className="error">Crée d'abord les familles de disciples dans Familles.</div>}
      <div className="list">{sundays.map(date => (
        <div className="cal-row" key={date}>
          <div><b style={{ fontWeight: 500 }}>{cap(fullDate(date).replace(/ \d{4}$/, ""))}</b>{date === today() && <div className="chip ok" style={{ marginTop: 4 }}>Aujourd'hui</div>}</div>
          {settings.services.map((slot, i) => {
            const cur = at(date, slot);
            return (
              <div className="slot" key={slot}>
                <span className="lbl">{slot}</span>
                {admin ? (
                  <select aria-label={`${slot} du ${fullDate(date)}`} disabled={busy} value={cur?.familyId ?? ""} onChange={e => choose(date, slot, i, e.target.value)}>
                    <option value="">Aucune famille</option>
                    {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                ) : <span style={{ fontWeight: cur?.familyId === profile!.familyId ? 600 : 400 }}>{cur ? familyName(cur.familyId) : "—"}</span>}
              </div>);
          })}
        </div>))}</div>
      <p className="small">Les faiseurs de la famille qui sert peuvent enregistrer les nouvelles âmes jusqu'à minuit. Le berger et l'assistant ont jusqu'au lundi midi pour finir la saisie.</p>
    </div>
  );
}
