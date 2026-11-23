import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSession } from "../lib/session";
import { useScope } from "../lib/scope";
import { currentSunday } from "../lib/dates";
import { STATUS_LABEL, stepCount } from "../lib/souls";
import type { Soul } from "../lib/types";
import { Avatar, Dots } from "./ui";
import { IAlert, ICheck, ISpark, IUsers } from "./Icons";

export interface FamilyStats { campusId: string; familyId: string; souls: number; present: number | null; alerts: number; noMaker: number; makers: number; established: number; thisMonth: number; sunday: string; }

/** Les chiffres d'une famille, calculés à partir des données visibles (pasteur ou berger). */
export function useFamilyStats() {
  const { settings, campusId } = useSession();
  const { souls, active, attendance, streak, workers } = useScope();
  return (familyId: string): FamilyStats => {
    const sunday = currentSunday();
    const a = active.filter(s => s.familyId === familyId);
    const pointed = a.filter(s => attendance.get(s.id)?.get(sunday));
    const p = pointed.filter(s => attendance.get(s.id)!.get(sunday)!.present).length;
    const month = new Date().toISOString().slice(0, 7);
    return {
      campusId: campusId ?? "", familyId, sunday,
      souls: a.length,
      present: pointed.length ? Math.round((p / pointed.length) * 100) : null,
      alerts: a.filter(s => streak(s.id) >= settings.absenceThreshold).length,
      noMaker: a.filter(s => !s.makerId).length,
      makers: workers.filter(w => w.role === "maker" && w.active && w.familyId === familyId).length,
      established: souls.filter(s => s.familyId === familyId && s.state === "established").length,
      thisMonth: souls.filter(s => s.familyId === familyId && s.arrivalDate.startsWith(month)).length
    };
  };
}

/** Le pasteur ou le berger publie les chiffres de la famille, pour que les faiseurs les voient (sans voir les âmes des autres). */
export function usePublishFamilyStats(familyIds: string[]) {
  const stats = useFamilyStats();
  const { loading } = useScope();
  const sent = useRef(new Map<string, string>());
  const all = familyIds.map(stats);
  const key = JSON.stringify(all);
  useEffect(() => {
    if (loading) return;
    for (const s of all) {
      const k = JSON.stringify(s);
      if (sent.current.get(s.familyId) === k || !s.campusId) continue;
      sent.current.set(s.familyId, k);
      setDoc(doc(db, "familyStats", s.familyId), s).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loading]);
}

/** Pour le faiseur : les chiffres généraux de sa famille. */
export function useMyFamilyStats(familyId: string | null | undefined) {
  const [s, setS] = useState<FamilyStats | null>(null);
  useEffect(() => {
    if (!familyId) return;
    getDoc(doc(db, "familyStats", familyId)).then(d => setS(d.exists() ? (d.data() as FamilyStats) : null), () => setS(null));
  }, [familyId]);
  return s;
}

export function StatTiles({ s }: { s: FamilyStats }) {
  return (
    <div className="grid2 grid4">
      <div className="stat"><div className="ic"><IUsers /></div><div className="v">{s.souls}</div><div className="l">âmes en suivi</div></div>
      <div className="stat"><div className="ic"><ICheck /></div><div className="v">{s.present === null ? "—" : `${s.present} %`}</div><div className="l">présence ce dimanche</div></div>
      <div className="stat"><div className="ic bad"><IAlert /></div><div className="v">{s.alerts}</div><div className="l">en alerte</div></div>
      <div className="stat"><div className="ic"><ISpark /></div><div className="v">{s.thisMonth}</div><div className="l">reçues ce mois-ci</div></div>
    </div>
  );
}

/** Chaque faiseur de la famille, et les âmes qui lui sont attribuées (touche un faiseur pour ouvrir sa liste). */
export function FamilyMakers({ familyId }: { familyId: string }) {
  const { settings } = useSession();
  const { active, attendance, streak, workers } = useScope();
  const sunday = currentSunday();
  const [open, setOpen] = useState<string | null>(null);
  const makers = workers.filter(w => (w.role === "maker" || w.role === "assistant") && w.active && w.familyId === familyId);
  const groups: { id: string; name: string; sub: string; souls: Soul[] }[] = makers.map(m => ({ id: m.id, name: m.name, sub: m.role === "assistant" ? "Assistant berger" : "Faiseur", souls: active.filter(s => s.makerId === m.id) }));
  const orphans = active.filter(s => s.familyId === familyId && !s.makerId);
  if (orphans.length) groups.push({ id: "_none", name: "Sans faiseur", sub: "À attribuer", souls: orphans });

  return (
    <div className="list">{groups.map(g => {
      const al = g.souls.filter(s => streak(s.id) >= settings.absenceThreshold).length;
      const pointed = g.souls.filter(s => attendance.get(s.id)?.get(sunday));
      const p = pointed.filter(s => attendance.get(s.id)!.get(sunday)!.present).length;
      const isOpen = open === g.id;
      return (
        <div key={g.id} style={{ display: "contents" }}>
          <button className="row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.id)}>
            <Avatar name={g.name} />
            <span className="main-col"><div className="name">{g.name}</div>
              <div className="meta">{g.sub} · {g.souls.length} âme{g.souls.length > 1 ? "s" : ""}{pointed.length ? ` · présence ${Math.round((p / pointed.length) * 100)} %` : ""}</div></span>
            {al > 0 && <span className="chip warn">{al} alerte{al > 1 ? "s" : ""}</span>}
            <span aria-hidden="true" style={{ opacity: .5, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
          </button>
          {isOpen && <div className="sublist">{g.souls.map(s => {
            const k = streak(s.id);
            return (
              <Link key={s.id} className="row" to={`/ames/${s.id}`}>
                <span className="main-col"><div className="name">{s.name}</div>
                  <div className="meta"><span className={"chip " + s.status.toLowerCase()}>{STATUS_LABEL[s.status]}</span>{k >= settings.absenceThreshold && <span className="chip warn">{k} absences</span>}</div></span>
                <Dots n={stepCount(s, settings)} total={settings.steps.length} />
              </Link>);
          })}{g.souls.length === 0 && <div className="empty">Aucune âme attribuée.</div>}</div>}
        </div>);
    })}{groups.length === 0 && <div className="empty">Aucun faiseur dans cette famille pour l'instant.</div>}</div>
  );
}
