import { useEffect, useState } from "react";
import { onSnapshot, type DocumentReference, type Query } from "firebase/firestore";

export interface Live<T> { data: T; loading: boolean; error: Error | null; }

/** Écoute une requête Firestore en direct. Passer `null` pour ne rien écouter. */
export function useQuery<T>(q: Query | null, deps: unknown[]): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: !!q, error: null });
  useEffect(() => {
    if (!q) { setState({ data: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true }));
    // En cas de refus (droits qui viennent de changer), on réessaie quelques fois.
    let stop = () => {}, tries = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const listen = () => {
      stop = onSnapshot(q,
        snap => { tries = 0; setState({ data: snap.docs.map(d => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }); },
        error => {
          if (tries++ < 3) { timer = setTimeout(listen, 1500 * tries); return; }
          console.error(error); setState({ data: [], loading: false, error });
        });
    };
    listen();
    return () => { clearTimeout(timer); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useDocument<T>(ref: DocumentReference | null, deps: unknown[]): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: !!ref, error: null });
  useEffect(() => {
    if (!ref) { setState({ data: null, loading: false, error: null }); return; }
    return onSnapshot(ref,
      snap => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      error => { console.error(error); setState({ data: null, loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Vrai quand des écritures locales ne sont pas encore parties vers le serveur. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener("online", on); addEventListener("offline", off);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);
  return online;
}
