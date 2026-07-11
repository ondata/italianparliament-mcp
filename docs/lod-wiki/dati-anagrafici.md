Dati anagrafici dei parlamentari (nascita, genere, luogo)

Cosa espone il LOD su nascita, genere e luogo di un parlamentare, e le trappole per interrogarli in massa. Verificato il 2026-07-03 su Schlein (Camera, `308930`) e La Russa/altri (Senato, `senatore/1275`, `senatore/32`); copertura geografica Senato ri-verificata il 2026-07-11 con `COUNT` sull'intera leg.19.

## Camera

Due nodi distinti con lo stesso id numerico:

- `ocd:deputato.rdf/d{id}_{leg}` = **ruolo nella legislatura** (gruppo, commissioni, mandato, elezione).
- `ocd:persona.rdf/p{id}` = **anagrafica** (`foaf:Person`): qui stanno nascita, account social, bio testuale.

Join tra i due: passano entrambi dal mandato — `?dep ocd:rif_mandatoCamera ?m . ?pers ocd:rif_mandatoCamera ?m`.

Proprietà anagrafiche (sul nodo persona):

- **Genere**: `foaf:gender`, valori `female` / `male`.
- **Nascita**: `?pers bio:Birth ?b . ?b bio:date ?d ; ocd:rif_luogo ?luogo`.
  - `bio:date` = stringa `YYYYMMDD` (es. `19850504`).
  - `ocd:rif_luogo` = URI `luogo.rdf/{comune}_{provincia}_{regione}` (es. `catania_catania_sicilia`); per l'estero `{citta}_{stato}` (es. `lugano_svizzera`).
  - **La gerarchia geografica È presente ma NON è strutturata**: vive solo dentro la stringa dell'URI, non come triple/entità RDF (non esiste `osr:provinciaNascita`/`nazioneNascita` come alla Camera, né un nodo "Regione Sicilia"). Filtrabile per comune / provincia / regione via `STRENDS`/`CONTAINS` sull'URI. Es.: donne nate in Sicilia = `FILTER(STRENDS(STR(?luogo),'_sicilia'))` → 10 deputate leg.19.
  - **Trappole di parsing dell'URI** (chi decompone lo slug `comune_provincia_regione`): (1) le regioni mono/bi-provinciali (Valle d'Aosta, Trentino-Alto Adige) compaiono a **2 parti** `comune_regione`, identiche nella forma ai nati all'estero `comune_stato` → la 2ª parte va disambiguata contro l'elenco delle regioni note; (2) i nomi-provincia dello slug divergono dallo standard ISTAT (es. `reggio-emilia` vs "Reggio nell'Emilia", `pesaro-urbino` vs "Pesaro e Urbino") → la regione va letta dallo slug stesso (parte 3), non ri-derivata dalla provincia. Il fatto che la geografia non sia esposta come triple è un limite di modellazione **segnalato ai gestori Camera**.
- **Bio testuale**: `dc:description` (titolo di studio + carriera, testo libero non strutturato).

Trappola: **serve `DISTINCT`** — il doppio `rdf:type` genera righe duplicate.

## Senato

Nodo unico `osr:Senatore`. La nascita è esposta in due forme ridondanti, entrambe presenti (verificato: `COUNT` = 1 per ciascuna):

- `osr:dataNascita` (stringa `YYYY-MM-DD`, es. `1946-08-12`) e `osr:cittaNascita` (stringa città nuda, es. `Rovigo`, `Varese`).
- `bio:birth ?b . ?b bio:date ?d ; bio:place ?p . ?p rdfs:label ?citta`.

- **Genere**: `foaf:gender`, valori `F` / `M`.

**Geografia di nascita — a differenza di quanto si credeva, il Senato la espone strutturata** (predicati diretti, non solo la città). Ri-verificato il 2026-07-11 con `COUNT(DISTINCT ?s)` sull'intera leg.19 (254 senatori):

| predicato | valore | copertura leg.19 |
|---|---|---|
| `osr:cittaNascita` | città nuda (`Rovigo`) | 254 / 254 |
| `osr:provinciaNascita` | provincia nuda (`Rovigo`, `Potenza`) | 250 / 254 |
| `osr:nazioneNascita` | nazione (`Italia`, o stato estero) | 254 / 254 |

I 4 senza `provinciaNascita` sono i **nati all'estero**: hanno `nazioneNascita` ≠ `Italia` (es. Argentina, Libia, Canada, Regno Unito) e nessuna provincia. `nazioneNascita` è valorizzata anche per i nati in Italia (`Italia`), quindi è il campo giusto per distinguere italiani da nati all'estero. Il tool `senators list` restituisce `birth_city`, `birth_province`, `birth_country` e `birth_region` (quest'ultima derivata, vedi sotto). `osr:regioneElezione` esiste ma è la regione di **elezione**, non di nascita.

Trappola filtro legislatura: usare `?s osr:mandato ?m . ?m osr:legislatura ?leg . FILTER(?leg={n})`. **NON** funziona `?m osr:legislatura {n}` come triple diretto (il letterale tipizzato non matcha in quella posizione → risultato vuoto).

## Conseguenze per i filtri demografici

| Filtro | Camera | Senato |
|---|---|---|
| genere | ✅ `foaf:gender` (`female`/`male`) | ✅ `foaf:gender` (`F`/`M`) |
| intervallo data di nascita | ✅ `bio:date` `YYYYMMDD` | ✅ `osr:dataNascita` `YYYY-MM-DD` |
| luogo nascita — città | ✅ (dall'URI luogo) | ✅ `osr:cittaNascita` |
| luogo nascita — provincia | ✅ (nell'URI luogo, non strutturata) | ✅ `osr:provinciaNascita` |
| luogo nascita — nazione | ✅ (nell'URI luogo, per l'estero) | ✅ `osr:nazioneNascita` |
| luogo nascita — regione | ✅ (nell'URI luogo) | ⚙️ derivata da provincia (vedi sotto) |

Note operative:
- **Formati data diversi** (Camera `YYYYMMDD`, Senato `YYYY-MM-DD`): i filtri per intervallo vanno costruiti per-endpoint.
- **Valori genere diversi** (`female`/`male` vs `F`/`M`): normalizzare l'input utente prima del filtro.
- **"Nato/a in regione X"**: entrambe le camere lo permettono, ma per vie diverse. Camera: la regione è già nello slug dell'URI luogo (parte 3). Senato: la regione **non** è esposta, si deriva da `osr:provinciaNascita` con una tabella provincia→regione (vedi sotto). Le due camere convergono sulla **stessa** stringa-regione canonica (`birth_region`), così un dataset che unisce Camera+Senato può raggruppare per regione di nascita senza riconciliazioni.
- **Solo `birth_region` è unificata cross-camera.** `birth_city`, `birth_province` e `birth_country` restano nella forma **nativa** di ciascuna fonte e possono differire per grafia/maiuscole tra le due camere (es. nato all'estero: Senato `Argentina`, Camera `argentina`; provincia: Senato `Torino`, Camera `torino`). Per aggregazioni cross-camera usare `birth_region`; per città/provincia/nazione normalizzare a valle se serve confrontarle.

## Da provincia a regione: risorsa derivata da SITUAS/ISTAT

La regione di nascita non è un dato di fonte (il Senato dà la provincia, la Camera la annega nell'URI). La materializziamo una volta sola in `src/core/province-region.ts` (modulo TS, bundle-safe per il Worker), con questa provenienza:

- **Fonte**: SITUAS/ISTAT, report 64 *"Elenco Province/Uts"*, via la CLI `opensituas` (`opensituas get 64 -o json`). Dà `DEN_UTS` (nome provincia/UTS) → `DEN_REG` (nome regione).
- **Snapshot a più date**: SITUAS è **date-accurate** — `opensituas get 64 --date DD/MM/YYYY` dà la divisione in vigore a quella data (senza `--date` restituisce il *dato più recente / fine validità*, quindi una data anche futura). Uniamo tre snapshot per coprire ogni grafia che compare nei dati anagrafici (parlamentari nati sotto province poi soppresse o rinominate): **2010** (province sarde storiche Olbia-Tempio, Carbonia-Iglesias), **2020** (era *Sud Sardegna*, le 5 province ISTAT sarde nazionali attuali), **snapshot più recente** (in Sardegna riflette la riorganizzazione **regionale**: Sulcis Iglesiente, Gallura Nord-Est Sardegna, Ogliastra, Medio Campidano). Tutte le varianti sarde ricadono comunque in `Sardegna`.
- **Normalizzazione**: chiavi confrontate senza accenti, minuscole, con apostrofi/trattini/slash resi spazio (`normProvince`), così `Forlì-Cesena`, `forli cesena`, `FORLI'-CESENA` collassano sulla stessa chiave.
- **Alias** — solo le forme brevi che il Senato usa e che SITUAS non ha a **nessuna** data (SITUAS usa i nomi estesi/bilingui): `Aosta`→Valle d'Aosta, `Bolzano`→Trentino-Alto Adige, `Monza e Brianza`→Lombardia. (`Sud Sardegna` **non** è più un alias: è nativa nello snapshot 2020.)
- **Copertura verificata**: 100% delle province di nascita distinte presenti nei dati del Senato risolvono a una regione (0 non risolte).
- **Le label Senato NON sono aggiornate/allineate all'ISTAT corrente** — non è SITUAS a sbagliare (è date-accurate), è il Senato che espone nomi non normalizzati. Su 110 province distinte, 104 combaciano esattamente con la nomenclatura UTS ISTAT; le 6 differenze sono gestite da `normProvince`+alias e sono di due tipi: **refusi ortografici** (`Forli'-Cesena` con apostrofo invece dell'accento ì, `Verbano Cusio Ossola` senza trattini) e **forme non ufficiali/datate** (`Monza e Brianza` per "Monza e della Brianza"; forme brevi non bilingui `Aosta`/`Bolzano`). `Sud Sardegna` è invece **corretta** (è il nome ISTAT nazionale in vigore fino alla riorganizzazione regionale sarda). Segnalato ai gestori Senato come miglioramento: esporre i **codici** ISTAT dei luoghi (non solo le label) renderebbe i join robusti a grafia e cambi amministrativi. Nota: il Senato espone solo le **label**, non i codici ISTAT — segnalato ai gestori come miglioramento (i codici renderebbero i join robusti alla grafia).

Quando cambiano le circoscrizioni provinciali, **non** si edita la mappa a mano: si rigenera da SITUAS con `opensituas`.
