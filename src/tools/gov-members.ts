import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { flattenBindings } from "../core/flatten.js";
import { personDisplayName } from "../core/person-name.js";
import { sparqlStringLiteral } from "../core/sparql-literal.js";
import type { Tool } from "./types.js";

const inputSchema = z.object({
  governmentUri: z
    .string()
    .url()
    .optional()
    .describe("URI del governo (es. http://dati.camera.it/ocd/governo.rdf/g202)"),
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura"),
  name: z
    .string()
    .optional()
    .describe("Cerca per nome/cognome del membro (case-insensitive)"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

const columns = [
  "uri",
  "label",
  "person_name",
  "person_uri",
  "role",
  "start_date",
  "end_date",
  "termination_reason",
  "government_uri",
  "legislature_uri",
];

export const govMembersTool: Tool<typeof inputSchema> = {
  name: "gov-members",
  description:
    "[CAMERA] Membri del governo italiano: presidente del consiglio, ministri, sottosegretari, viceministri. Con nome, ruolo, date inizio/fine, motivo cessazione. Filtrabile per governo, legislatura o nome persona.",
  inputSchema,
  examples: [
    "italianparliament gov-members list --legislature 19",
    "italianparliament gov-members list --government-uri http://dati.camera.it/ocd/governo.rdf/g202",
    "italianparliament gov-members list --name meloni",
  ],
  async execute(input) {
    const filters: string[] = [];
    if (input.governmentUri) {
      filters.push(`?m ocd:rif_governo <${input.governmentUri}> .`);
    }
    if (input.legislature) {
      filters.push(
        `?m ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}> .`,
      );
    }
    if (input.name) {
      // Il nome d'uso non è nella label della persona ma nel blank node
      // foaf:nickname (vedi core/person-name.ts): cercare "casellati" sulla sola
      // label restituiva zero righe. Le due parti sono concatenate perché
      // ?alias_surname è opzionale, e CONTAINS su una variabile non legata
      // solleverebbe un errore che scarta la riga.
      filters.push(
        `FILTER(CONTAINS(LCASE(CONCAT(COALESCE(?persona_name, ""), " ", COALESCE(?alias_surname, ""))), ${sparqlStringLiteral(input.name.toLowerCase())}))`,
      );
    }

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?m ?label ?persona_name ?persona_first ?persona_surname ?alias_surname
       ?rif_persona ?role ?start_date ?end_date ?reason ?rif_governo ?rif_leg
WHERE {
  ?m a ocd:membroGoverno .
  ?m rdfs:label ?label .
  # Tutto ciò che dipende dalla persona sta DENTRO l'OPTIONAL che la lega a ?m:
  # in blocchi separati ?rif_persona resterebbe libero sugli incarichi che non
  # la espongono e si legherebbe a qualunque risorsa del grafo, moltiplicando
  # le righe con dati di altre persone. Oggi tutti i membri di governo hanno
  # ocd:rif_persona (verificato: zero eccezioni), ma la garanzia è del dato, non
  # della query.
  OPTIONAL {
    ?m ocd:rif_persona ?rif_persona .
    OPTIONAL { ?rif_persona rdfs:label ?persona_name }
    OPTIONAL { ?rif_persona foaf:firstName ?persona_first }
    OPTIONAL { ?rif_persona foaf:surname ?persona_surname }
    OPTIONAL { ?rif_persona foaf:nickname ?nick . ?nick foaf:surname ?alias_surname }
  }
  OPTIONAL { ?m ocd:membroGoverno ?role }
  OPTIONAL { ?m ocd:startDate ?start_date }
  OPTIONAL { ?m ocd:endDate ?end_date }
  OPTIONAL { ?m ocd:motivoTermine ?reason }
  OPTIONAL { ?m ocd:rif_governo ?rif_governo }
  OPTIONAL { ?m ocd:rif_leg ?rif_leg }
  ${filters.join("\n  ")}
}
ORDER BY ?persona_name
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    // 18 persone hanno due cognomi d'uso (4 delle quali membri di governo):
    // l'endpoint restituisce una riga per alias, che va raccolto prima di
    // comporre il nome. Il LIMIT resta applicato lato SPARQL su quelle righe,
    // quindi in quei rari casi la pagina può contenerne qualcuna in meno.
    const aliasesByPerson = new Map<string, string[]>();
    for (const r of raw) {
      const alias = r.alias_surname || "";
      if (!alias) continue;
      const person = r.rif_persona || "";
      const known = aliasesByPerson.get(person) ?? [];
      if (!known.includes(alias)) known.push(alias);
      aliasesByPerson.set(person, known);
    }

    // Dedup sulla riga intera, non sull'URI dell'incarico: un incarico può
    // legittimamente comparire più volte, per esempio quando attraversa più
    // legislature (mgr68_48_20071932_9026, sottosegretario dal 1932, ne copre
    // cinque). Collassarlo sull'URI cancellerebbe quelle righe.
    const rows = [];
    const seen = new Set<string>();
    for (const r of raw) {
      // Con nome e cognome separati si ricompone il nome d'uso; se la persona
      // non li espone si ripiega sulla sua rdfs:label.
      const personName = r.persona_first
        ? personDisplayName(
            r.persona_first,
            r.persona_surname || "",
            aliasesByPerson.get(r.rif_persona || "") ?? [],
          )
        : r.persona_name || "";
      const row = {
        uri: r.m ?? "",
        label: r.label ?? "",
        person_name: personName,
        person_uri: r.rif_persona ?? "",
        role: r.role ?? "",
        start_date: r.start_date ?? "",
        end_date: r.end_date ?? "",
        termination_reason: r.reason ?? "",
        government_uri: r.rif_governo ?? "",
        legislature_uri: r.rif_leg ?? "",
      };
      const key = JSON.stringify(row);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
    return { rows, columns };
  },
};
