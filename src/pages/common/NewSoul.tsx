import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { createSoul } from "../../lib/api";
import { cap, fullDate } from "../../lib/dates";
import { normalizePhone } from "../../lib/souls";
import { isCampusAdmin, type ServiceSlot } from "../../lib/types";
import { Top, frError, useToast } from "../../components/ui";
import SoulForm, { type SoulFields } from "./SoulForm";

/**
 * Enregistrement des nouvelles âmes (NC et NA).
 * Seules les familles qui servent au culte du jour peuvent enregistrer : faiseurs jusqu'à minuit,
 * berger et assistant jusqu'au lundi midi. Le pasteur peut toujours enregistrer.
 * L'âme arrive dans « À attribuer » : c'est le berger ou l'assistant qui choisit le faiseur.
 */
export default function NewSoul() {
  const { profile, families, familyName, campusId } = useSession();
  const { openServices, souls } = useScope();
  const toast = useToast();
  const nav = useNavigate();
  const me = profile!;
  const admin = isCampusAdmin(me.role);
  const [svcChoice, setSvc] = useState("");
  const [famChoice, setFam] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [dup, setDup] = useState<{ d: SoulFields; name: string } | null>(null);

  const service: ServiceSlot | undefined = openServices.find(s => s.id === svcChoice) ?? openServices[0];
  const familyId = admin ? famChoice || families[0]?.id || "" : me.familyId ?? "";

  if (!admin && !service) {
    return (
      <div className="page">
        <Top title="Nouvelle âme" back />
        <div className="card">
          <p style={{ marginTop: 0 }}><b style={{ fontWeight: 500 }}>L'enregistrement est fermé aujourd'hui.</b></p>
          <p className="small">Seules les familles qui servent au culte peuvent enregistrer les nouvelles âmes, le jour de leur service. Consulte le programme pour voir quand ta famille sert.</p>
          <Link className="btn ghost" to={me.role === "maker" ? "/aujourdhui" : "/programme"}>{me.role === "maker" ? "Retour" : "Voir le programme"}</Link>
        </div>
      </div>
    );
  }

  async function save(d: SoulFields, force = false) {
    if (!familyId || !campusId) return toast("Choisis d'abord une famille.");
    const p = normalizePhone(d.phone);
    const twin = p.length >= 8 ? souls.find(s => normalizePhone(s.phone).endsWith(p.slice(-8))) : undefined;
    if (twin && !force) { setDup({ d, name: twin.name }); return; }
    setDup(null); setBusy(true);
    try {
      await Promise.race([
        createSoul(me, campusId, { ...d, service: service?.slot ?? d.service, arrivalDate: !admin && service ? service.date : d.arrivalDate, familyId, makerId: null }, admin ? undefined : service),
        new Promise(r => setTimeout(r, 1500)) // hors ligne : la fiche part plus tard
      ]);
      setCount(c => c + 1); setFormKey(k => k + 1);
      toast(`${d.name} enregistrée. Saisis la suivante.`);
    } catch (e) { toast(frError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="page">
      <Top title="Nouvelle âme" back sub={count ? `${count} enregistrée${count > 1 ? "s" : ""} pendant cette saisie` : "Juste l'essentiel. Le reste se complète plus tard."} />
      {!admin && service && (
        openServices.length > 1 ? (
          <div className="field"><label htmlFor="svc">Culte</label>
            <select id="svc" value={service.id} onChange={e => setSvc(e.target.value)}>
              {openServices.map(s => <option key={s.id} value={s.id}>{s.slot}, {fullDate(s.date)}</option>)}</select></div>
        ) : <div className="success">Famille {familyName(familyId)} · {service.slot} du {cap(fullDate(service.date))}</div>
      )}
      {admin && (
        <div className="field"><label htmlFor="fam">Famille de disciples</label>
          <select id="fam" value={familyId} onChange={e => setFam(e.target.value)}>
            {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>)}
      <SoulForm key={formKey} short hideService={!admin} submitLabel="Enregistrer et saisir la suivante" busy={busy} onSubmit={d => save(d)} />
      {dup && (
        <div className="error" style={{ marginTop: 12 }}>
          Ce numéro est déjà enregistré pour <b>{dup.name}</b>. Est-ce la même personne ?
          <div className="btnrow"><button className="btn ghost sm" onClick={() => setDup(null)}>Oui, ne pas enregistrer</button><button className="btn danger sm" onClick={() => save(dup.d, true)}>Non, enregistrer quand même</button></div>
        </div>)}
      <p className="small">L'âme part dans « À attribuer ». Le berger ou l'assistant choisira son faiseur.</p>
      <div className="btnrow"><button className="btn ghost" onClick={() => nav(-1)}>Terminer</button></div>
    </div>
  );
}
