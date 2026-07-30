import { cdQuery } from "./client.js";
import { flattenBindings } from "./flatten.js";

/**
 * Freschezza del LOD Camera, per area di dato.
 *
 * Il LOD Camera pubblica a lotti (confermato dal gestore: il repository RDF è
 * l'ultimo anello di una catena di produttori distinti, e pubblica solo quando
 * riceve i dati). Il segnale di quel caricamento esiste ed è per-record:
 * `ods:modified` (<http://lod.xdams.org/ontologies/ods/modified>). Verificato
 * il 2026-07-29: presente su ~24 classi `ocd:`, con copertura di fatto totale
 * (sugli `ocd:aic`: 1.110.266 valori su 1.110.258 atti) e valori distribuiti in
 * lotti giornalieri (712 atti stampati il 28/07/2026, 852 il 23/07).
 *
 * Il MAX per classe è coerente con il contenuto più recente di quella classe
 * (votazioni: ultimo voto 2026-07-23, ultimo lotto 2026-07-24; sedute: ultima
 * seduta 2026-06-17, ultimo lotto 2026-06-18), quindi si può leggere come
 * "l'area risulta caricata fino a qui". Le aree divergono: al 2026-07-29 gli
 * atti erano al 28/07 e i lavori d'Aula al 18/06.
 *
 * NON confondere con `dcterms:modified`, che sulle 66 risorse `dcat:Dataset` è
 * congelato al 2024-02-08 e non riflette alcun caricamento.
 *
 * Il Senato non ha un equivalente (zero `ods:modified` sui `osr:Ddl`), quindi
 * qui si copre solo la Camera.
 */

/** Cache per classe, viva quanto il processo: il lotto cambia una volta al giorno. */
const cache = new Map<string, string | undefined>();
const inflight = new Map<string, Promise<string | undefined>>();

/**
 * Timestamp dell'ultimo caricamento noto per una classe `ocd:` (es. "aic",
 * "votazione"), in formato ISO. `undefined` se la classe non espone
 * `ods:modified` o se la query fallisce: la freschezza è un'informazione
 * accessoria, non deve mai far fallire il comando che la chiede.
 */
export async function cameraLastLoad(ocdClass: string): Promise<string | undefined> {
  if (cache.has(ocdClass)) return cache.get(ocdClass);
  const pending = inflight.get(ocdClass);
  if (pending) return pending;

  const p = (async () => {
    try {
      const query = `PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX ods: <http://lod.xdams.org/ontologies/ods/>
SELECT (MAX(?m) AS ?last) WHERE {
  ?s a ocd:${ocdClass} ; ods:modified ?m .
}`;
      const rows = flattenBindings(await cdQuery(query));
      const last = rows[0]?.last;
      const value = last && /^\d{4}-\d{2}-\d{2}/.test(last) ? last : undefined;
      cache.set(ocdClass, value);
      return value;
    } catch {
      // Nessun warning su stderr: a differenza di currentLegislature() qui non
      // c'è un fallback da annunciare, e il chiamante sta già gestendo un
      // risultato vuoto. Non si mette in cache, così un flap transitorio
      // dell'endpoint non congela l'assenza per tutto il processo.
      return undefined;
    } finally {
      inflight.delete(ocdClass);
    }
  })();

  inflight.set(ocdClass, p);
  return p;
}

/**
 * `covered` distingue i due casi che il chiamante deve poter pesare: la
 * finestra richiesta è già stata caricata (il vuoto ha un'altra causa) oppure
 * no (il vuoto può essere solo ritardo di pubblicazione). Con `covered: true`
 * un tool che ha un'ipotesi migliore sul vuoto — es. `votes` con la fiducia
 * votata il giorno prima — può darle la precedenza.
 */
export type FreshnessNote = { covered: boolean; text: string };

/**
 * Nota che qualifica un risultato vuoto rispetto all'ultimo caricamento.
 * Funzione pura (il timestamp arriva dal chiamante) per poterla testare senza
 * endpoint. `undefined` quando non c'è nulla di utile da dire.
 */
export function buildFreshnessNote(
  lastLoad: string | undefined,
  opts: { areaLabel: string; dateFrom?: string; dateTo?: string },
): FreshnessNote | undefined {
  if (!lastLoad) return undefined;
  // Senza finestra temporale il vuoto non è spiegabile con il ritardo di
  // pubblicazione: l'hint sarebbe rumore.
  if (!opts.dateFrom && !opts.dateTo) return undefined;
  const loadDay = lastLoad.slice(0, 10);
  // Il confronto è sul giorno del lotto, non sull'istante: un lotto caricato
  // il 28/07 contiene gli atti fino al 27/07, quindi chiedere il 28 o dopo
  // cade già nella zona ambigua.
  //
  // Servono TRE esiti, non due: guardare solo `dateFrom` dichiara coperta anche
  // una finestra 01/06→29/07 che oltrepassa il lotto (e quindi esclude a torto
  // la latenza per la sua coda); guardare solo `dateTo` fa l'errore opposto,
  // dichiarando non coperta una finestra 2020→oggi di cui il 99% è caricato. Il
  // caso a cavallo del lotto è reale e va detto per quello che è.
  const start = opts.dateFrom;
  const end = opts.dateTo;
  const startsBeyond = !!start && start >= loadDay;
  // Senza `dateTo` la finestra è aperta a destra: se comincia prima del lotto,
  // include per costruzione anche i giorni non ancora caricati.
  const endsBeyond = end ? end >= loadDay : true;
  const area = `${capitalize(opts.areaLabel)} del LOD Camera risulta caricata fino al ${loadDay}`;
  const prefix = `${area} (ultimo lotto: ${lastLoad}).`;
  const nonConcludere =
    "questo vuoto può essere dato non ancora pubblicato, NON assenza dell'atto. Verifica alla fonte (camera.it/senato.it) prima di concludere, e non dedurre che non sia avvenuto nulla.";

  if (startsBeyond) {
    return {
      covered: false,
      text: `${prefix} La finestra richiesta parte dal ${start}, quindi non è ancora coperta da un caricamento: ${nonConcludere}`,
    };
  }
  if (endsBeyond) {
    // A cavallo del lotto: parte della finestra è caricata, parte no. `covered:
    // false` perché la latenza resta una spiegazione possibile del vuoto.
    const estremi = start
      ? end
        ? `dal ${start} al ${end}`
        : `dal ${start} in avanti`
      : `fino al ${end}`;
    return {
      covered: false,
      text: `${prefix} La finestra richiesta va ${estremi}, quindi è coperta solo fino al ${loadDay}: per i giorni successivi ${nonConcludere}`,
    };
  }
  return {
    covered: true,
    text: `${area}, quindi la finestra richiesta è interamente coperta: il vuoto NON si spiega con il ritardo di pubblicazione. Cerca la causa nei filtri attivi o in un'assenza strutturale del dato, non nella latenza.`,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Interroga l'ultimo caricamento e ne costruisce la nota. Da chiamare solo sul
 * ramo "risultato vuoto", per non aggiungere una query alle chiamate che hanno
 * già dato righe.
 */
export async function cameraFreshnessNote(opts: {
  ocdClass: string;
  areaLabel: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<FreshnessNote | undefined> {
  if (!opts.dateFrom && !opts.dateTo) return undefined;
  return buildFreshnessNote(await cameraLastLoad(opts.ocdClass), opts);
}

/** Come `cameraFreshnessNote`, per i chiamanti che vogliono solo il testo. */
export async function cameraFreshnessHint(opts: {
  ocdClass: string;
  areaLabel: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<string | undefined> {
  return (await cameraFreshnessNote(opts))?.text;
}
