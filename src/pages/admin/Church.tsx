import { useEffect, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Link } from "react-router-dom";
import { DEMO_DOMAIN, DEMO_PASSWORD, isDemoCampus, seedDemo } from "../../lib/demo";
import { addService } from "../../lib/api";
import { today } from "../../lib/dates";
import { useSession } from "../../lib/session";
import { useScope } from "../../lib/scope";
import { currentSunday } from "../../lib/dates";
import { stepCount } from "../../lib/souls";
import { Avatar, Loading, Top, frError } from "../../components/ui";
import { usePublishFamilyStats, useFamilyStats } from "../../components/FamilyView";
import { IChart, ICheck, IPlus, ISpark, IUsers } from "../../components/Icons";

export default function Church() {
  const { settings, families, campus, profile } = useSession();
  const { souls, active, attendance, streak, loading } = useScope();
  const seedable = !loading && profile?.role === "master" && isDemoCampus(campus?.name) && souls.length < 5 && !families.some(f => f.name === "Amour");
  // Une fois affichée, la carte reste là pendant le remplissage (les familles créées ne la font pas disparaître).
  const [sticky, setSticky] = useState(false);
  useEffect(() => { if (seedable) setSticky(true); }, [seedable]);
  const canSeed = seedable || sticky;
  const stats = useFamilyStats();
  usePublishFamilyStats(families.map(f => f.id));
  if (loading) return <Loading />;
  const sunday = currentSunday();
  const total = souls.length || 1;
  const est = souls.filter(s => s.state === "established").length;
  const full = active.filter(s => stepCount(s, settings) === settings.steps.length).length;
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = souls.filter(s => s.arrivalDate.startsWith(month)).length;
  const fam = families.map(f => ({ ...f, ...stats(f.id) }));
  void sunday; void attendance; void streak;

  return (
    <div className="page wide">
      <Top title="Vue du campus" sub={campus?.name ? (/^campus/i.test(campus.name) ? campus.name : `Campus ${campus.name}`) : settings.churchName} right={families.length > 0 ? <Link to="/equipe?inviter=1" className="btn primary sm"><IPlus />Ouvrier</Link> : undefined} />
      {canSeed && <DemoSeed />}
      <Duplicates />
      {isDemoCampus(campus?.name) && families.length > 0 && <TestService />}
      {families.length === 0 && !canSeed && <div className="hero" style={{ marginBottom: 16 }}>
        <span className="big">Pour commencer, crée les familles de disciples</span>
        <span className="small">Ensuite, ajoute les ouvriers : un berger pour chaque famille, puis les faiseurs de disciples (bouton « + Ouvrier »).</span>
        <Link to="/familles" className="btn grad" style={{ alignSelf: "flex-start" }}>Créer les familles</Link>
      </div>}
      <div className="grid2 grid4">
        <div className="stat"><div className="ic"><IUsers /></div><div className="v">{active.length}</div><div className="l">âmes en suivi</div></div>
        <div className="stat"><div className="ic"><ICheck /></div><div className="v">{Math.round(((active.length + est) / total) * 100)} %</div><div className="l">taux de maintien</div></div>
        <div className="stat"><div className="ic"><IChart /></div><div className="v">{Math.round(((est + full) / total) * 100)} %</div><div className="l">taux de réussite</div></div>
        <div className="stat"><div className="ic"><ISpark /></div><div className="v">{thisMonth}</div><div className="l">reçues ce mois-ci</div></div>
      </div>
      <p className="small">Maintien : âmes suivies ou affermies sur toutes les âmes reçues. Réussite : affermies ou ayant validé toutes les étapes.</p>

      <div className="eyebrow">Familles · touche une famille pour voir ses faiseurs et leurs âmes</div>
      <div className="list">{fam.map(f => (
        <Link key={f.id} className="row" to={`/familles/${f.id}`}><Avatar name={f.name} />
          <span className="main-col"><div className="name">Famille {f.name}</div>
            <div className="meta">{f.souls} âmes · {f.makers} faiseur{f.makers > 1 ? "s" : ""}{f.noMaker ? ` · ${f.noMaker} sans faiseur` : ""}</div>
            <span className="track" style={{ display: "block", marginTop: 6 }}><b style={{ width: `${f.present ?? 0}%` }} /></span></span>
          <span style={{ textAlign: "right", flex: "none" }}><b>{f.present === null ? "—" : `${f.present} %`}</b><div className="small" style={{ margin: 0 }}>présence</div>
            {f.alerts > 0 && <span className="chip warn">{f.alerts} alerte{f.alerts > 1 ? "s" : ""}</span>}</span>
        </Link>))}
        {fam.length === 0 && <div className="empty">Aucune famille.</div>}</div>
      <div className="btnrow"><Link className="btn ghost" to="/rapport-dimanche">Chiffres du dimanche</Link><Link className="btn ghost" to="/a-attribuer">Âmes à attribuer</Link></div>
    </div>
  );
}

/** Campus de démonstration vide : le super admin le remplit avec des données fictives, en un clic. */
function DemoSeed() {
  const { profile, campusId, campus, settings } = useSession();
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ accounts: string[]; souls: number } | null>(null);
  const [err, setErr] = useState("");
  const log = (m: string) => setLines(l => [...l.slice(-5), m]);
  async function run() {
    setBusy(true); setErr("");
    try { setDone(await seedDemo(profile!, campusId!, campus?.name ?? "Démo", settings, log)); }
    catch (e) { console.error(e); setErr(frError(e)); }
    finally { setBusy(false); }
  }
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="ico-g" style={{ marginBottom: 10 }}><ISpark /></div>
      <h2 style={{ fontSize: 18 }}>Remplir le campus de démonstration</h2>
      {!done ? <>
        <p className="small">Crée 6 familles, un berger et 3 faiseurs par famille (de vrais comptes de test), environ 200 âmes fictives avec leurs étapes, formations, difficultés et 8 dimanches de présences. Aucune personne réelle. Compter 1 à 2 minutes.</p>
        {err && <div className="error">{err}</div>}
        {busy && <div className="pre small" style={{ margin: "8px 0" }}>{lines.join("\n")}</div>}
        <button className="btn primary" disabled={busy} onClick={run}>{busy ? "Création en cours…" : "Remplir avec des données de démonstration"}</button>
      </> : <>
        <p className="small">C'est prêt : {done.souls} âmes et {done.accounts.length} comptes. Chaque compte se connecte avec le mot de passe <b>{DEMO_PASSWORD}</b>, par exemple :</p>
        <div className="pre small">{`berger.amour@${DEMO_DOMAIN}\nfaiseur1.amour@${DEMO_DOMAIN}\nfaiseur2.foi@${DEMO_DOMAIN}`}</div>
      </>}
    </div>
  );
}

/** Familles en double (même nom) restées vides : le pasteur les supprime en un clic. */
function Duplicates() {
  const { families } = useSession();
  const { souls, workers, services } = useScope();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const used = (id: string) => souls.some(s => s.familyId === id) || workers.some(w => w.familyId === id) || services.some(s => s.familyId === id);
  const extra: string[] = [];
  const byName = new Map<string, typeof families>();
  for (const f of families) { const k = f.name.trim().toLowerCase(); byName.set(k, [...(byName.get(k) ?? []), f]); }
  for (const list of byName.values()) {
    if (list.length < 2) continue;
    const keep = list.find(f => used(f.id) || f.shepherdId) ?? list[0];
    for (const f of list) if (f.id !== keep.id && !used(f.id) && !f.shepherdId) extra.push(f.id);
  }
  if (!extra.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>{extra.length} famille{extra.length > 1 ? "s" : ""} en double</h2>
      <p className="small">Ces familles portent le même nom qu'une autre et sont vides (aucune âme, aucun ouvrier). On peut les supprimer sans rien perdre.</p>
      {err && <div className="error">{err}</div>}
      <button className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { for (const id of extra) await deleteDoc(doc(db, "families", id)); } catch (e) { setErr(frError(e)); } finally { setBusy(false); }
      }}>{busy ? "Suppression…" : "Supprimer les doublons"}</button>
    </div>);
}

/** Campus de démonstration : ouvrir un « culte de test » aujourd'hui pour essayer l'enregistrement des NC et NA. */
function TestService() {
  const { families, campusId, familyName } = useSession();
  const { services } = useScope();
  const [fam, setFam] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const open = services.filter(s => s.date === today());
  const f = families.find(x => x.id === fam) ?? families[0];
  const slug = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Tester un jour de culte</h2>
      <p className="small">L'enregistrement des nouvelles âmes n'est ouvert qu'à la famille de service, le jour du culte. Pour essayer dès maintenant, ouvre un culte de test aujourd'hui pour une famille, puis connecte-toi avec un de ses faiseurs (mot de passe {DEMO_PASSWORD}).</p>
      {open.length > 0 && <div className="success">Ouvert aujourd'hui : {open.map(s => `Famille ${familyName(s.familyId)} (${s.slot})`).join(", ")}. Essaie avec faiseur1.{slug(familyName(open[0].familyId))}@{DEMO_DOMAIN}.</div>}
      {err && <div className="error">{err}</div>}
      <div className="field"><label htmlFor="ts-fam">Famille de service</label><select id="ts-fam" value={f?.id ?? ""} onChange={e => setFam(e.target.value)}>{families.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <button className="btn primary" disabled={busy || !f} onClick={async () => {
        setBusy(true); setErr("");
        try { await addService(campusId!, today(), "Culte de test", 9, f!.id); } catch (e) { setErr(frError(e)); } finally { setBusy(false); }
      }}>Ouvrir un culte de test aujourd'hui</button>
    </div>);
}
