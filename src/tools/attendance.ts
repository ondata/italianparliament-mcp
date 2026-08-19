import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personHtmlUrl } from "../core/html-url.js";
import type { Tool } from "./types.js";

function stripLegLabel(label: string): string {
  return label.replace(/,\s*.* Legislatura della Repubblica\s*$/, "").trim();
}

const inputSchema = z.object({
  uri: z.string().url().optional().describe("URI completo del deputato"),
  id: z.number().int().min(1).optional().describe("ID numerico deputato"),
  legislature: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Numero legislatura (richiesta con --id)"),
});

const columns = [
  "deputy_uri",
  "deputy_name",
  "html_url",
  "favorevole",
  "contrario",
  "astensione",
  "non_ha_votato",
  "in_missione",
  "presidente_di_turno",
  "assenze",
  "ha_votato",
  "altro",
  "totale",
  "presenze",
  "presenze_pct",
  "missioni_pct",
  "assenze_pct",
];

export const attendanceTool: Tool<typeof inputSchema> = {
  name: "attendance",
  title: "Partecipazione al voto di un deputato",
  description:
    "[CAMERA] Presenze e assenze di un deputato nelle votazioni d'Assemblea della sua legislatura. Conteggi per esito (favorevole/contrario/astensione/ha votato in scrutinio segreto) e, dentro il non ha votato, le tre situazioni che il dato Camera tiene distinte: in_missione, presidente_di_turno e assenze (l'assenza vera). Le tre ricompongono non_ha_votato; se non lo fanno, la differenza è in altro ed è una descrizione nuova alla fonte, non un'assenza. ATTENZIONE: non_ha_votato NON è il numero di assenze, è la loro somma — la colonna da citare per l'assenteismo è assenze. Un ministro o un presidente di Camera risulta con decine di migliaia di non_ha_votato che sono quasi tutte missioni. presenze somma voti espressi, scrutini segreti e turni di presidenza; le missioni restano categoria a sé e non sono assenze, come fa Openpolis. Il denominatore delle percentuali (presenze_pct/missioni_pct/assenze_pct) è totale, cioè le votazioni in cui il deputato risulta registrato: alla Camera è già delimitato al mandato, quindi chi subentra a legislatura iniziata non risulta assente per il periodo in cui non sedeva. Le percentuali sono confrontabili con quelle di Openpolis e dei tabulati giornalistici entro circa un punto, perché Openpolis scarta alcune votazioni (segrete, per alzata di mano) e fotografa i dati in un altro momento: non presentarle come cifre identiche. Contare presidente_di_turno fra le presenze è una scelta nostra, non una verifica contro Openpolis: chi presiede è in Aula, e l'impatto è di circa un voto per votazione; la colonna resta separata per chi volesse calcolare diversamente. L'URI del deputato è già specifico di una legislatura (es. .../deputato.rdf/d306921_17). Input per URI o per id+legislature.",
  inputSchema,
  examples: [
    "italianparliament attendance show --uri http://dati.camera.it/ocd/deputato.rdf/d302103_19",
    "italianparliament attendance show --id 302103 --legislature 19",
    "italianparliament attendance show --uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --format jsonl",
  ],
  async execute(input) {
    if (!input.uri && (input.id === undefined || input.legislature === undefined)) {
      throw new Error("Passare --uri oppure --id e --legislature insieme.");
    }
    const uri =
      input.uri ??
      `http://dati.camera.it/ocd/deputato.rdf/d${input.id}_${input.legislature}`;

    // COUNT(DISTINCT ?v), non COUNT(?v): la tripla `?v a ocd:voto` è asserita
    // sia nel grafo generale `ocd/` sia nel tematico `ocd/votazioni/`, e la
    // vista di default (unione) le somma, raddoppiando ogni conteggio. Il nodo
    // voto è uno solo, con un solo dc:type — non sono appelli ripetuti.
    // Fenomeno documentato in docs/lod-wiki/camera/named-graph.md.
    // Il vincolo `a ocd:voto` va tenuto: ocd:rif_deputato lega anche risorse di
    // altro tipo (Relatore, Titolare), che entrerebbero nel conteggio.
    // dc:description scompone il "Non ha votato" nelle tre situazioni che il
    // dato Camera tiene distinte e che non sono la stessa cosa per il lettore:
    // "In missione" (assente per incarico, non è un'assenza), "Presidente di
    // turno" (in Aula, presiede) e "Non ha partecipato" (l'assenza vera).
    // Senza questa scomposizione Meloni risulta con 19.409 voti non espressi su
    // 19.426, mentre 18.998 di quelli sono missioni. È OPTIONAL perché la porta
    // solo il "Non ha votato": i voti espressi non hanno dc:description.
    const query = `${OCD_PREFIXES}
SELECT ?type ?descr (COUNT(DISTINCT ?v) AS ?n) WHERE {
  ?v a ocd:voto ; ocd:rif_deputato <${uri}> ; dc:type ?type .
  OPTIONAL { ?v dc:description ?descr }
} GROUP BY ?type ?descr`;

    const labelQuery = `${OCD_PREFIXES}
SELECT ?label WHERE { <${uri}> rdfs:label ?label } LIMIT 1`;

    const [results, labelResults] = await Promise.all([
      cdQuery(query),
      cdQuery(labelQuery),
    ]);
    const raw = flattenBindings(results);
    if (raw.length === 0) {
      throw new Error(`Nessun voto trovato per il deputato: ${uri}`);
    }

    // Valori noti di dc:type sul voto (verificati su leg. 17 e 19): 4 esiti +
    // "Ha votato", marcatore di partecipazione per gli scrutini segreti dove la
    // scelta individuale non è tracciata (non è un'assenza).
    const KNOWN: Record<string, string> = {
      Favorevole: "favorevole",
      Contrario: "contrario",
      Astensione: "astensione",
      "Non ha votato": "non_ha_votato",
      "Ha votato": "ha_votato",
    };
    // Sottocategorie di "Non ha votato", dal dc:description.
    const SUB: Record<string, string> = {
      "In missione": "in_missione",
      "Presidente di turno": "presidente_di_turno",
      "Non ha partecipato": "assenze",
    };
    const counts: Record<string, number> = {
      favorevole: 0,
      contrario: 0,
      astensione: 0,
      non_ha_votato: 0,
      in_missione: 0,
      presidente_di_turno: 0,
      assenze: 0,
      ha_votato: 0,
      altro: 0,
    };
    let totale = 0;
    for (const r of raw) {
      const n = Number(r.n ?? 0);
      const key = KNOWN[r.type ?? ""] ?? "altro";
      counts[key] += n;
      totale += n;
      if (key === "non_ha_votato") {
        // Una descrizione non prevista NON va nelle assenze: attribuire a
        // qualcuno un'assenza che il dato non afferma è esattamente l'errore
        // che questa scomposizione serve a togliere. Finisce in `altro`, dove
        // sta già tutto ciò che non è classificabile, e la somma delle tre
        // sottocolonne smette di ricomporre non_ha_votato: è il segnale che
        // la fonte ha cambiato schema, e il test di ricomposizione lo rileva.
        counts[SUB[r.descr ?? ""] ?? "altro"] += n;
      }
    }

    const label = flattenBindings(labelResults)[0]?.label ?? "";
    // Presenze con la stessa formula usata per il Senato: chi ha espresso un
    // voto, chi ha partecipato a scrutinio segreto e chi presiedeva. Le
    // missioni restano una categoria a sé, non sono assenze. Il denominatore è
    // `totale`, che alla Camera è già delimitato al mandato del deputato
    // (verificato sui subentrati: chi entra a legislatura iniziata ha solo le
    // votazioni successive al suo ingresso), quindi qui non serve la query di
    // periodo che al Senato è necessaria.
    const presenze =
      counts.favorevole +
      counts.contrario +
      counts.astensione +
      counts.ha_votato +
      counts.presidente_di_turno;
    const pct = (n: number): string =>
      totale > 0 ? ((n / totale) * 100).toFixed(2) : "";
    const rows = [
      {
        deputy_uri: uri,
        deputy_name: stripLegLabel(label),
        html_url: personHtmlUrl(uri),
        favorevole: String(counts.favorevole),
        contrario: String(counts.contrario),
        astensione: String(counts.astensione),
        non_ha_votato: String(counts.non_ha_votato),
        in_missione: String(counts.in_missione),
        presidente_di_turno: String(counts.presidente_di_turno),
        assenze: String(counts.assenze),
        ha_votato: String(counts.ha_votato),
        altro: String(counts.altro),
        totale: String(totale),
        presenze: String(presenze),
        presenze_pct: pct(presenze),
        missioni_pct: pct(counts.in_missione),
        assenze_pct: pct(counts.assenze),
      },
    ];
    return { rows, columns };
  },
};
