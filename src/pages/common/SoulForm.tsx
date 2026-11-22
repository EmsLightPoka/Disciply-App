import { useState, type FormEvent } from "react";
import { useSession } from "../../lib/session";
import type { Soul } from "../../lib/types";
import { today } from "../../lib/dates";

export type SoulFields = Pick<Soul, "name" | "phone" | "gender" | "neighborhood" | "status" | "service" | "arrivalDate" | "inviter">;

export default function SoulForm({ initial, onSubmit, submitLabel, busy, short, hideService }: {
  initial?: Partial<SoulFields>; onSubmit: (d: SoulFields) => void; submitLabel: string; busy?: boolean; short?: boolean; hideService?: boolean;
}) {
  const { settings } = useSession();
  const [d, setD] = useState<SoulFields>({
    name: "", phone: "", gender: "F", neighborhood: "", status: "NC", service: settings.services[0] ?? "", arrivalDate: today(), inviter: "", ...initial
  });
  const set = <K extends keyof SoulFields>(k: K, v: SoulFields[K]) => setD(x => ({ ...x, [k]: v }));
  function submit(e: FormEvent) { e.preventDefault(); onSubmit({ ...d, name: d.name.trim(), phone: d.phone.trim(), neighborhood: d.neighborhood.trim(), inviter: d.inviter?.trim() ?? "" }); }

  return (
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="f-name">Nom et prénom</label><input id="f-name" required value={d.name} onChange={e => set("name", e.target.value)} autoComplete="off" /></div>
      <div className="field"><label htmlFor="f-phone">Téléphone</label><input id="f-phone" inputMode="tel" value={d.phone} onChange={e => set("phone", e.target.value)} placeholder="6 XX XX XX XX" /></div>
      <div className="field"><label>Statut</label><div className="toggle">
        <button type="button" aria-pressed={d.status === "NC"} onClick={() => set("status", "NC")}>Nouveau converti</button>
        <button type="button" aria-pressed={d.status === "NA"} onClick={() => set("status", "NA")}>Nouvel arrivant</button></div></div>
      <div className="field"><label>Sexe</label><div className="toggle">
        <button type="button" aria-pressed={d.gender === "F"} onClick={() => set("gender", "F")}>Femme</button>
        <button type="button" aria-pressed={d.gender === "H"} onClick={() => set("gender", "H")}>Homme</button></div></div>
      {!hideService && <div className="grid2">
        <div className="field"><label htmlFor="f-service">Culte</label><select id="f-service" value={d.service} onChange={e => set("service", e.target.value)}>{settings.services.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="f-date">Date d'arrivée</label><input id="f-date" type="date" max={today()} value={d.arrivalDate} onChange={e => set("arrivalDate", e.target.value)} /></div>
      </div>}
      <div className="field"><label htmlFor="f-quartier">Quartier</label><input id="f-quartier" value={d.neighborhood} onChange={e => set("neighborhood", e.target.value)} /></div>
      {!short && <>
        <div className="field"><label htmlFor="f-inviter">Invitée par</label><input id="f-inviter" value={d.inviter ?? ""} onChange={e => set("inviter", e.target.value)} placeholder="Nom de la personne qui l'a invitée" /></div>
      </>}
      <button className="btn primary block" disabled={busy}>{submitLabel}</button>
    </form>
  );
}
