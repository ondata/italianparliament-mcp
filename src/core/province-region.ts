// Mappa provincia di nascita → regione, per normalizzare la geografia su
// entrambe le camere. Il Senato espone osr:provinciaNascita (nome provincia,
// non codice ISTAT); questa mappa risolve il nome alla regione.
//
// Fonte: SITUAS/ISTAT report 64 "Elenco Province/Uts" (CLI opensituas). SITUAS
// e date-accurate: `get 64 --date DD/MM/YYYY` da la divisione in vigore a quella
// data. Uniamo tre snapshot per coprire tutte le grafie che possono comparire
// nei dati anagrafici (parlamentari nati sotto province poi soppresse o rinominate):
//   - 2010 (es. province sarde Olbia-Tempio, Carbonia-Iglesias);
//   - 2020 (era Sud Sardegna: le 5 province ISTAT sarde attuali a livello nazionale);
//   - snapshot piu recente (fine validita: in Sardegna riflette la riorganizzazione
//     regionale — Sulcis Iglesiente, Gallura Nord-Est Sardegna, Ogliastra, Medio Campidano).
// Tutte le varianti sarde ricadono comunque nella regione Sardegna.
//
// Alias: solo le forme brevi che il Senato usa e che SITUAS non ha a nessuna data
// (SITUAS usa i nomi estesi/bilingui): Aosta, Bolzano, "Monza e Brianza".
// Copertura verificata: 100% delle 110 province di nascita distinte del Senato
// risolvono a una regione (0 non risolte).
//
// Le chiavi sono gia normalizzate con normProvince(); non modificarle a mano:
// rigenerare da SITUAS (opensituas) se cambiano le circoscrizioni provinciali.

// Normalizza un nome di provincia per il confronto: toglie accenti, minuscolizza,
// rende spazi apostrofi/trattini/slash e collassa gli spazi. Deve restare identica
// alla normalizzazione usata per generare le chiavi di PROVINCE_REGION.
export function normProvince(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, " ")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROVINCE_REGION: Record<string, string> = {
  "agrigento": "Sicilia",
  "alessandria": "Piemonte",
  "ancona": "Marche",
  "aosta": "Valle d'Aosta/Vallée d'Aoste",
  "arezzo": "Toscana",
  "ascoli piceno": "Marche",
  "asti": "Piemonte",
  "avellino": "Campania",
  "bari": "Puglia",
  "barletta andria trani": "Puglia",
  "belluno": "Veneto",
  "benevento": "Campania",
  "bergamo": "Lombardia",
  "biella": "Piemonte",
  "bologna": "Emilia-Romagna",
  "bolzano": "Trentino-Alto Adige/Südtirol",
  "bolzano bozen": "Trentino-Alto Adige/Südtirol",
  "brescia": "Lombardia",
  "brindisi": "Puglia",
  "cagliari": "Sardegna",
  "caltanissetta": "Sicilia",
  "campobasso": "Molise",
  "carbonia iglesias": "Sardegna",
  "caserta": "Campania",
  "catania": "Sicilia",
  "catanzaro": "Calabria",
  "chieti": "Abruzzo",
  "como": "Lombardia",
  "cosenza": "Calabria",
  "cremona": "Lombardia",
  "crotone": "Calabria",
  "cuneo": "Piemonte",
  "enna": "Sicilia",
  "fermo": "Marche",
  "ferrara": "Emilia-Romagna",
  "firenze": "Toscana",
  "foggia": "Puglia",
  "forli cesena": "Emilia-Romagna",
  "frosinone": "Lazio",
  "gallura nord est sardegna": "Sardegna",
  "genova": "Liguria",
  "gorizia": "Friuli-Venezia Giulia",
  "grosseto": "Toscana",
  "imperia": "Liguria",
  "isernia": "Molise",
  "l aquila": "Abruzzo",
  "la spezia": "Liguria",
  "latina": "Lazio",
  "lecce": "Puglia",
  "lecco": "Lombardia",
  "livorno": "Toscana",
  "lodi": "Lombardia",
  "lucca": "Toscana",
  "macerata": "Marche",
  "mantova": "Lombardia",
  "massa carrara": "Toscana",
  "matera": "Basilicata",
  "medio campidano": "Sardegna",
  "messina": "Sicilia",
  "milano": "Lombardia",
  "modena": "Emilia-Romagna",
  "monza e brianza": "Lombardia",
  "monza e della brianza": "Lombardia",
  "napoli": "Campania",
  "novara": "Piemonte",
  "nuoro": "Sardegna",
  "ogliastra": "Sardegna",
  "olbia tempio": "Sardegna",
  "oristano": "Sardegna",
  "padova": "Veneto",
  "palermo": "Sicilia",
  "parma": "Emilia-Romagna",
  "pavia": "Lombardia",
  "perugia": "Umbria",
  "pesaro e urbino": "Marche",
  "pescara": "Abruzzo",
  "piacenza": "Emilia-Romagna",
  "pisa": "Toscana",
  "pistoia": "Toscana",
  "pordenone": "Friuli-Venezia Giulia",
  "potenza": "Basilicata",
  "prato": "Toscana",
  "ragusa": "Sicilia",
  "ravenna": "Emilia-Romagna",
  "reggio calabria": "Calabria",
  "reggio di calabria": "Calabria",
  "reggio nell emilia": "Emilia-Romagna",
  "rieti": "Lazio",
  "rimini": "Emilia-Romagna",
  "roma": "Lazio",
  "rovigo": "Veneto",
  "salerno": "Campania",
  "sassari": "Sardegna",
  "savona": "Liguria",
  "siena": "Toscana",
  "siracusa": "Sicilia",
  "sondrio": "Lombardia",
  "sud sardegna": "Sardegna",
  "sulcis iglesiente": "Sardegna",
  "taranto": "Puglia",
  "teramo": "Abruzzo",
  "terni": "Umbria",
  "torino": "Piemonte",
  "trapani": "Sicilia",
  "trento": "Trentino-Alto Adige/Südtirol",
  "treviso": "Veneto",
  "trieste": "Friuli-Venezia Giulia",
  "udine": "Friuli-Venezia Giulia",
  "valle d aosta vallee d aoste": "Valle d'Aosta/Vallée d'Aoste",
  "varese": "Lombardia",
  "venezia": "Veneto",
  "verbano cusio ossola": "Piemonte",
  "vercelli": "Piemonte",
  "verona": "Veneto",
  "vibo valentia": "Calabria",
  "vicenza": "Veneto",
  "viterbo": "Lazio",
};

// Regione di nascita dal nome della provincia (qualsiasi grafia ragionevole).
// Ritorna "" se non risolvibile (es. nato all'estero: usare birth_country).
export function regionFromProvince(province: string | undefined | null): string {
  if (!province) return "";
  return PROVINCE_REGION[normProvince(province)] ?? "";
}

// Nome canonico delle 20 regioni (i valori distinti della mappa) indicizzato per
// forma normalizzata, piu gli alias per gli slug bilingui usati dalla Camera
// (trentino-alto-adige, valle-d-aosta), che in SITUAS hanno il nome doppio.
const REGION_CANON: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const region of Array.from(new Set(Object.values(PROVINCE_REGION)))) {
    m[normProvince(region)] = region;
  }
  m["trentino alto adige"] = "Trentino-Alto Adige/Südtirol";
  m["valle d aosta"] = "Valle d'Aosta/Vallée d'Aoste";
  return m;
})();

// Nome canonico di regione da una forma qualsiasi (nome esteso o slug Camera).
// Ritorna "" se non e una regione italiana nota: utile, negli slug Camera a 2
// parti, per distinguere una regione mono-provinciale (Aosta, Trentino) da uno
// stato estero, e per allineare la regione della Camera a quella del Senato.
export function canonicalRegion(name: string | undefined | null): string {
  if (!name) return "";
  return REGION_CANON[normProvince(name)] ?? "";
}
