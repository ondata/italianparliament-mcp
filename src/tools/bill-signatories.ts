import { z } from "zod";
import { cdQuery, snQuery } from "../core/client.js";
import { OCD_PREFIXES, OSR_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import { richerDisplayName, personDisplayName } from "../core/person-name.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  billUri: z
    .string()
    .url()
    .describe(
      "URI del DDL. Camera (es. http://dati.camera.it/ocd/attocamera.rdf/ac19_2696) o Senato (es. http://dati.senato.it/ddl/25597). Il ramo è rilevato dall'URI.",
    ),
  limit: z.number().int().min(1).max(1000).default(200),
});

const columns = ["name", "role", "is_primary", "person_uri", "html_url"];

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

// Camera: primo/co-firmatari come proprietà dirette dell'atto
// (ocd:primo_firmatario / ocd:altro_firmatario → deputato).
// Per i decreti-legge / atti di iniziativa governativa il firmatario NON è un
// deputato ma un blank node "membro di governo": il nome vive un hop più in là
// via ocd:rif_persona (→ persona.rdf), e il dicastero è in ocd:ruolo. Senza
// seguirli, il nome torna vuoto (bug: 5 righe con name="" sui decreti governativi).
function cameraQuery(billUri: string, limit: number): string {
  return `${OCD_PREFIXES}
SELECT DISTINCT ?ruolo ?dep ?firstName ?surname ?label
       ?persona ?govRole ?pFirstName ?pSurname ?pLabel ?pAliasSurname
WHERE {
  { <${billUri}> ocd:primo_firmatario ?dep . BIND("primo" AS ?ruolo) }
  UNION
  { <${billUri}> ocd:altro_firmatario ?dep . BIND("co" AS ?ruolo) }
  OPTIONAL { ?dep foaf:firstName ?firstName }
  OPTIONAL { ?dep foaf:surname ?surname }
  OPTIONAL { ?dep <${RDFS_LABEL}> ?label }
  OPTIONAL {
    ?dep ocd:rif_persona ?persona .
    OPTIONAL { ?persona foaf:firstName ?pFirstName }
    OPTIONAL { ?persona foaf:surname ?pSurname }
    OPTIONAL { ?persona <${RDFS_LABEL}> ?pLabel }
    # Il cognome d'uso dei ministri proponenti sta qui, non in foaf:surname:
    # senza questo hop la ministra per le Riforme è "MARIA ELISABETTA ALBERTI".
    OPTIONAL { ?persona foaf:nickname ?pNick . ?pNick foaf:surname ?pAliasSurname }
  }
  OPTIONAL { ?dep ocd:ruolo ?govRole }
}
LIMIT ${limit}`;
}

// Senato: firmatari via osr:iniziativa → senatore, con flag osr:primoFirmatario.
// osr:tipoIniziativa è il discriminante esplicito del ramo di iniziativa
// (Governativa / Parlamentare / Popolare / Regionale / CNEL / di ente /
// di commissione): l'assenza di osr:senatore NON implica atto governativo,
// perché i DDL parlamentari arrivati dalla Camera hanno presentatori deputati
// senza osr:senatore ma con ocd:rif_deputato (URI nel grafo Camera).
function senatoQuery(billUri: string, limit: number): string {
  return `${OSR_PREFIXES}
SELECT ?presentatore ?senatore ?deputato ?primoFirmatario ?tipoIniziativa
WHERE {
  <${billUri}> osr:iniziativa ?init .
  OPTIONAL { ?init osr:presentatore ?presentatore }
  OPTIONAL { ?init osr:senatore ?senatore }
  OPTIONAL { ?init ocd:rif_deputato ?deputato }
  OPTIONAL { ?init osr:primoFirmatario ?primoFirmatario }
  OPTIONAL { ?init osr:tipoIniziativa ?tipoIniziativa }
}
LIMIT ${limit}`;
}

/**
 * Numero e legislatura di un atto Camera dal suo URI
 * (`.../attocamera.rdf/ac19_2500` → leg 19, atto 2500). Le letture successive
 * hanno il suffisso col trattino, come nel repertorio Senato
 * (`ac19_976-B` → 976-B): verificato sul grafo Camera.
 */
export function parseCameraActUri(
  uri: string,
): { legislature: number; number: string } | undefined {
  const m = /\/ac(\d+)_(\d+(?:-[A-Z])?)/.exec(uri);
  if (!m) return undefined;
  return { legislature: Number(m[1]), number: m[2] };
}

/**
 * Pattern della fase Camera nel repertorio Senato per un numero d'atto.
 *
 * L'URI Camera scrive la lettura successiva attaccata (`ac19_1511B`), il
 * repertorio Senato la scrive col trattino (`1511-B`): un confronto esatto sul
 * numero così com'è non lega nulla e l'origine resterebbe non trovata. Si cerca
 * quindi sul numero base accettando il suffisso — le letture dello stesso DDL
 * condividono comunque l'`osr:idDdl`, che è ciò che serve.
 */
export function cameraPhasePattern(number: string): string {
  return `${number.replace(/-?[A-Z]$/, "")}(-[A-Z])?`;
}

/**
 * DDL Senato da cui proviene un atto Camera "di passaggio": quando un DDL nasce
 * al Senato e arriva alla Camera, l'atto Camera NON porta i firmatari (nel
 * grafo OCD mancano `ocd:primo_firmatario`/`ocd:altro_firmatario`), che restano
 * sul DDL di origine. Il legame è lo stesso usato da bill-progress: le fasi
 * dello stesso DDL condividono `osr:idDdl`, e il repertorio Senato contiene
 * anche le fasi Camera (`osr:ramo = "C"`).
 *
 * `undefined` quando la fase Camera non esiste nel repertorio Senato o non c'è
 * alcuna fase S: lì il vuoto è genuino e va lasciato vuoto.
 */
async function originatingSenatoDdl(
  cameraUri: string,
): Promise<{ uri: string; phase: string } | undefined> {
  const act = parseCameraActUri(cameraUri);
  if (!act) return undefined;
  const idRows = flattenBindings(
    await snQuery(`${OSR_PREFIXES}
SELECT DISTINCT ?id WHERE {
  ?a osr:idDdl ?id ; osr:numeroFase ?n ; osr:ramo ?r ; osr:legislatura ${act.legislature} .
  FILTER(REGEX(STR(?n), "^${cameraPhasePattern(act.number)}$") && STR(?r) = "C")
}
LIMIT 2`),
  );
  const id = idRows[0]?.id;
  if (!id) return undefined;

  // STR(?idd) e non il letterale nudo: osr:idDdl è tipizzato (xsd:integer),
  // quindi `osr:idDdl "54448"` non lega nulla e la ricerca dell'origine
  // fallirebbe in silenzio — stessa forma usata da bill-progress.
  const phaseRows = flattenBindings(
    await snQuery(`${OSR_PREFIXES}
SELECT ?a ?fase WHERE {
  ?a osr:idDdl ?idd ; osr:fase ?fase ; osr:ramo ?r .
  FILTER(STR(?idd) = "${id.replace(/"/g, "")}" && STR(?r) = "S")
}
LIMIT 10`),
  )
    .filter((r) => r.a && r.fase)
    // Prima lettura al Senato: la fase senza suffisso di navetta (S.1452,
    // non S.1452-B) è quella che porta l'iniziativa e quindi i firmatari.
    .sort((x, y) => (x.fase ?? "").length - (y.fase ?? "").length);
  const first = phaseRows[0];
  return first ? { uri: first.a, phase: first.fase } : undefined;
}

// La rdfs:label del deputato Camera arriva col suffisso
// ", XIX Legislatura della Repubblica": si tiene solo la parte prima della virgola.
// Quella label porta il nome d'uso ("ROSA MARIA VILLECCO CALIPARI") mentre
// foaf:surname porta quello anagrafico ("VILLECCO"): fra le due si tiene la
// forma più informativa (vedi core/person-name.ts).
function cleanCameraName(
  firstName: string,
  surname: string,
  label: string,
  aliasSurname = "",
): string {
  const composed = personDisplayName(
    firstName,
    surname,
    aliasSurname ? [aliasSurname] : [],
  );
  const fromLabel = (label.split(",")[0] ?? "").trim();
  return richerDisplayName(composed, fromLabel);
}

export const billSignatoriesTool: Tool<typeof inputSchema> = {
  name: "bill-signatories",
  description:
    "[CAMERA/SENATO] Firmatari di un DDL: primo firmatario e cofirmatari con nome e link al profilo. Per gli atti di iniziativa governativa (decreti-legge e DDL del Governo) i proponenti sono i ministri: il ruolo è 'Governo — <dicastero>' (Camera, es. 'Governo — Ministro dell'Interno') o 'Governo (proponente)' (Senato) invece di 'primo firmatario', con is_primary=false (i proponenti sono più d'uno, non un singolo parlamentare). Sui DDL Senato di iniziativa parlamentare arrivati dalla Camera i firmatari sono deputati (person_uri nel grafo Camera); altre iniziative (Popolare, Regionale, CNEL) hanno ruolo '<tipo> (proponente)' senza link persona. Il ramo è rilevato automaticamente dall'URI del DDL (ottenibile da bill-progress).",
  inputSchema,
  examples: [
    "italianparliament bill-signatories show --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696",
    "italianparliament bill-signatories show --bill-uri http://dati.senato.it/ddl/25597 --format jsonl",
  ],
  async execute(input) {
    const isSenato = input.billUri.includes("dati.senato.it");

    if (isSenato) {
      const raw = flattenBindings(await snQuery(senatoQuery(input.billUri, input.limit)));
      const rows = raw.map((r) => {
        // flattenBindings rende "" i binding assenti: servono || (non ??).
        const personUri = r.senatore || r.deputato || "";
        const tipo = r.tipoIniziativa || "";
        if (personUri || tipo === "Parlamentare") {
          return {
            name: r.presentatore ?? "",
            role: r.primoFirmatario === "1" ? "primo firmatario" : "cofirmatario",
            is_primary: r.primoFirmatario === "1" ? "true" : "false",
            person_uri: personUri,
            html_url: personHtmlUrl(personUri),
          };
        }
        // Nessuna entità persona nel grafo: il presentatore vive solo come
        // stringa (es. "Pres. Consiglio  Giorgia Meloni (Gov. Meloni-I)",
        // oppure il proponente di un'iniziativa Popolare/Regionale/CNEL)
        // → niente person_uri/html_url. Senza tipoIniziativa si assume
        // governativo (comportamento storico).
        const isGov = !tipo || tipo === "Governativa";
        return {
          name: r.presentatore ?? "",
          role: isGov ? "Governo (proponente)" : `${tipo} (proponente)`,
          is_primary: isGov
            ? "false"
            : r.primoFirmatario === "1"
              ? "true"
              : "false",
          person_uri: "",
          html_url: "",
        };
      });
      return { rows, columns };
    }

    const raw = flattenBindings(await cdQuery(cameraQuery(input.billUri, input.limit)));
    const rows = raw.map((r) => {
      // Iniziativa governativa: il firmatario è un membro di governo (blank node),
      // il nome è sulla persona collegata via ocd:rif_persona. Coerente col ramo
      // Senato: role esplicito "Governo — <dicastero>", is_primary=false (i
      // proponenti governativi sono più d'uno, non un singolo primo firmatario).
      if (r.persona) {
        return {
          name: cleanCameraName(
            r.pFirstName ?? "",
            r.pSurname ?? "",
            r.pLabel ?? "",
            r.pAliasSurname ?? "",
          ),
          role: r.govRole ? `Governo — ${r.govRole}` : "Governo (proponente)",
          is_primary: "false",
          person_uri: r.persona,
          html_url: personHtmlUrl(r.persona),
        };
      }
      return {
        name: cleanCameraName(r.firstName ?? "", r.surname ?? "", r.label ?? ""),
        role: r.ruolo === "primo" ? "primo firmatario" : "cofirmatario",
        is_primary: r.ruolo === "primo" ? "true" : "false",
        person_uri: r.dep ?? "",
        html_url: personHtmlUrl(r.dep),
      };
    });
    // Vuoto sul ramo Camera: può essere un atto "di passaggio", cioè la lettura
    // Camera di un DDL nato al Senato, dove i firmatari stanno sul DDL di
    // origine. Senza dirlo, un vuoto (dato che vive altrove) si legge come
    // "atto senza firmatari". Sondato solo sul vuoto; un errore della sonda
    // (403 Senato, timeout) lascia il vuoto com'era invece di far fallire tutto.
    if (rows.length === 0) {
      const origine = await originatingSenatoDdl(input.billUri).catch(
        () => undefined,
      );
      if (origine)
        return {
          rows,
          columns,
          hint: `Nessun firmatario sull'atto Camera: è la lettura Camera di un DDL presentato al SENATO come ${origine.phase}, e i firmatari stanno sul DDL di origine. Rilancia con --bill-uri ${origine.uri}. La numerazione non si conserva tra i rami, quindi il numero dell'atto Camera non aiuta a cercarli al Senato.`,
        };
    }
    return { rows, columns };
  },
};
