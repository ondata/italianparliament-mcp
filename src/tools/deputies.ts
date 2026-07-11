import { z } from "zod";
import { cdQuery } from "../core/client.js";
import { flattenBindings } from "../core/flatten.js";
import { OCD_PREFIXES } from "../core/prefixes.js";
import { personHtmlUrl } from "../core/html-url.js";
import { canonicalRegion } from "../core/province-region.js";
import type { Tool } from "./types.js";

// La Camera NON espone la geografia di nascita come triple RDF: la codifica solo
// come slug dentro l'URI del luogo, `comune_provincia_regione` (Italia) oppure
// `comune_stato` (estero). Casi speciali: le regioni mono/bi-provinciali (Valle
// d'Aosta, Trentino-Alto Adige) compaiono a 2 parti come `comune_regione`, per
// questo la 2ª parte va disambiguata via canonicalRegion (regione nota vs stato
// estero). La regione e portata alla forma canonica del Senato; provincia e
// comune restano nella forma nativa (deslug) dello slug Camera.
const deslug = (s: string): string => s.replace(/-/g, " ").trim();

export function parseCameraBirthPlace(slug: string): {
  birth_city: string;
  birth_province: string;
  birth_country: string;
  birth_region: string;
} {
  const empty = { birth_city: "", birth_province: "", birth_country: "", birth_region: "" };
  if (!slug) return empty;
  const parts = slug.split("_");
  const city = deslug(parts[0] ?? "");
  if (parts.length >= 3) {
    return {
      birth_city: city,
      birth_province: deslug(parts[1]),
      birth_country: "Italia",
      birth_region: canonicalRegion(parts[2]),
    };
  }
  if (parts.length === 2) {
    const region = canonicalRegion(parts[1]);
    if (region) {
      return { birth_city: city, birth_province: "", birth_country: "Italia", birth_region: region };
    }
    return { birth_city: city, birth_province: "", birth_country: deslug(parts[1]), birth_region: "" };
  }
  return { ...empty, birth_city: city };
}

const inputSchema = z.object({
  legislature: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Numero legislatura Camera (es. 19)"),
  region: z
    .string()
    .optional()
    .describe("Filtra per circoscrizione/regione (match case-insensitive, es. 'sicilia', 'lombardia', 'estero')"),
  gender: z
    .enum(["male", "female"])
    .optional()
    .describe("Filtra per genere: 'male' o 'female'"),
  bornFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Nati dal (YYYY-MM-DD, incluso)"),
  bornTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Nati fino al (YYYY-MM-DD, incluso)"),
  birthPlace: z
    .string()
    .optional()
    .describe(
      "Filtra per luogo di nascita: match case-insensitive su comune, provincia, regione o stato estero (es. 'catania', 'sicilia', 'svizzera')",
    ),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

const sparqlEsc = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const columns = [
  "uri",
  "label",
  "first_name",
  "last_name",
  "gender",
  "birth_date",
  "birth_place",
  "birth_city",
  "birth_province",
  "birth_country",
  "birth_region",
  "description",
  "photo_url",
  "profile_url",
  "legislature_uri",
  "mandate_uri",
  "mandate_start",
  "mandate_end",
  "mandate_termination_reason",
  "mandate_validation",
  "election_uri",
  "election_label",
  "html_url",
];

export const deputiesTool: Tool<typeof inputSchema> = {
  name: "deputies",
  description:
    "[CAMERA] Lista deputati della Camera dei Deputati. Filtrabile per legislatura e circoscrizione/regione. Restituisce nome, cognome, genere, foto, profilo, mandato, elezione.",
  inputSchema,
  examples: [
    "italianparliament deputies list --legislature 19 --limit 50",
    "italianparliament deputies list --legislature 19 --region sicilia --limit 50",
    "italianparliament deputies list --legislature 19 --gender female --birth-place sicilia",
    "italianparliament deputies list --legislature 19 --born-from 1990-01-01 --format jsonl",
    "italianparliament deputies list --limit 200 --offset 100",
    "italianparliament deputies list --format jsonl",
  ],
  async execute(input) {
    const legFilter =
      input.legislature !== undefined
        ? `FILTER(?rif_leg = <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${input.legislature}>)`
        : "";

    // Nascita/genere: il genere è già sul nodo deputato; la nascita sta sul nodo
    // persona (foaf:Person) collegato via lo stesso mandato Camera. Il vincolo
    // `a foaf:Person` evita che ?pers ricada sul nodo deputato (che condivide il
    // mandato ma non ha bio:Birth) generando righe duplicate.
    const birthFilters = [
      input.gender ? `FILTER(?gender = "${input.gender}")` : "",
      input.bornFrom ? `FILTER(STR(?birth_date) >= "${input.bornFrom.replace(/-/g, "")}")` : "",
      input.bornTo ? `FILTER(STR(?birth_date) <= "${input.bornTo.replace(/-/g, "")}")` : "",
      input.birthPlace
        ? `FILTER(CONTAINS(LCASE(STR(?birth_place_uri)), LCASE("${sparqlEsc(input.birthPlace)}")))`
        : "",
    ]
      .filter(Boolean)
      .join("\n  ");

    const query = `${OCD_PREFIXES}
SELECT DISTINCT ?s ?label ?first_name ?last_name ?gender ?birth_date ?birth_place_uri ?description
                ?photo_url ?profile_url ?rif_leg
                ?mandate_uri ?mandate_start ?mandate_end ?mandate_termination_reason
                ?mandate_validation ?election_uri ?election_label
WHERE {
  ?s a <http://dati.camera.it/ocd/deputato> .
  ?s rdfs:label ?label .
  OPTIONAL { ?s foaf:firstName ?first_name }
  OPTIONAL { ?s foaf:surname ?last_name }
  OPTIONAL { ?s foaf:gender ?gender }
  OPTIONAL {
    ?s ocd:rif_mandatoCamera ?_birthMandate .
    ?_pers ocd:rif_mandatoCamera ?_birthMandate ; a foaf:Person ; bio:Birth ?_birth .
    OPTIONAL { ?_birth bio:date ?birth_date }
    OPTIONAL { ?_birth ocd:rif_luogo ?birth_place_uri }
  }
  OPTIONAL { ?s dc:description ?description }
  OPTIONAL { ?s foaf:depiction ?photo_url }
  OPTIONAL { ?s dcterms:isReferencedBy ?profile_url }
  OPTIONAL { ?s <http://dati.camera.it/ocd/rif_leg> ?rif_leg }
  OPTIONAL {
    ?s <http://dati.camera.it/ocd/rif_mandatoCamera> ?mandate_uri .
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/startDate> ?mandate_start }
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/endDate> ?mandate_end }
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/motivoTermine> ?mandate_termination_reason }
    OPTIONAL { ?mandate_uri <http://dati.camera.it/ocd/convalida> ?mandate_validation }
    OPTIONAL {
      ?mandate_uri <http://dati.camera.it/ocd/rif_elezione> ?election_uri .
      ?election_uri rdfs:label ?election_label
    }
  }
  ${legFilter}
  ${input.region ? `FILTER(CONTAINS(LCASE(STR(?election_label)), LCASE("${sparqlEsc(input.region)}")))` : ""}
  ${birthFilters}
}
LIMIT ${input.limit}
OFFSET ${input.offset}`;

    const results = await cdQuery(query);
    const raw = flattenBindings(results);
    const rows = raw.map((r) => {
      const { s, rif_leg, birth_date, birth_place_uri, ...rest } = r;
      const bd = birth_date ?? "";
      // Ultimo segmento dell'URI, ripulito da eventuale query/fragment (?…/#…)
      // che altrimenti si attaccherebbe alla regione e la farebbe cadere a "".
      const birth_place = ((birth_place_uri ?? "").split("/").pop() ?? "").split(/[?#]/, 1)[0] ?? "";
      return {
        uri: s ?? "",
        legislature_uri: rif_leg ?? "",
        birth_date: /^\d{8}$/.test(bd) ? `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}` : bd,
        birth_place,
        ...parseCameraBirthPlace(birth_place),
        ...rest,
        html_url: personHtmlUrl(s),
      };
    });
    return { rows, columns };
  },
};
