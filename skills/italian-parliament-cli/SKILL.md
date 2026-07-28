---
name: italian-parliament-cli
description: Query Italian Parliament open data from the command line (italianparliament CLI). Use when the user wants to run shell pipelines, export CSV/JSONL, or script analysis over deputies, senators, bills, votes, speeches, and groups.
compatibility: Requires the @aborruso/italianparliament-mcp npm package installed globally (provides the `italianparliament` command)
metadata:
  author: aborruso
  version: "1.4"
---

# Italian Parliament CLI Skill

Use the `italianparliament` CLI to query Camera dei Deputati and Senato della Repubblica open data from the shell.

## Installation

```bash
npm install -g @aborruso/italianparliament-mcp
# provides the `italianparliament` command
```

## Discovery (orchestration)

```bash
italianparliament guide                  # typical workflow (discover → URI → detail)
italianparliament which "testo ddl"      # capability → command (exit 0 match, 2 no-match); add --json for ranked output
italianparliament <command> --help       # options + examples
```

## General syntax

```
italianparliament <resource> <action> [--option value ...]
```

Default output: **CSV** (for spreadsheets, `duckdb`, `mlr`). Add `--format jsonl` for `jq`/streaming.

## Default legislature

Current legislature is **19**. Most commands default to 19 when `--legislature` is omitted.

## Command reference

See [full command reference](references/commands.md).

## Common patterns

**Count deputies in a legislature**
```bash
italianparliament deputies list --legislature 19 --format csv | wc -l
```

**Export all bills as CSV**
```bash
italianparliament bills list --legislature 19 --format csv > bills-19.csv
```

**Find an MP by name**
```bash
italianparliament search find --name meloni
```

**Top 20 MPs by interrogations (AIC)**
```bash
italianparliament rank list --rank-by aic-primo-firmatario --legislature 19 --limit 20
```

**Who voted against in a vote**
```bash
italianparliament vote-detail show --vote-uri <vote-uri> --format jsonl | \
  jq 'select(.vote=="Contrario")'
```

**Dissidenti, e altri obiettivi giornalistici derivabili senza tool dedicato**
Vedi [obiettivi giornalistici](references/obiettivi-giornalistici.md): ricette pronte (es. i "ribelli" che votano contro la linea di gruppo) combinando i tool esistenti.

**A person's full career (legislatures + government)**
```bash
italianparliament person-career show --uri http://dati.camera.it/ocd/deputato.rdf/d302103_19
```

**Government members filtered by name**
```bash
italianparliament gov-members list --name draghi
```

**Group ranking by AIC, also per member**
```bash
italianparliament group-rank list --rank-by aic --legislature 19   # colonna count_per_member già calcolata
```

**Iter completo di una legge (Camera → Senato → pubblicazione)**
Non generare la timeline a memoria: costruiscila dai tool, passo per passo. `bill-progress` è la spina dorsale.
```bash
# 1. individua l'atto Camera
italianparliament bills list --keyword "salario giusto" --legislature 19        # → URI atto, es. ac19_2911
# 2. iter Camera con le date reali di ogni fase (assegnazione, esame, approvazione/trasmissione, legge)
italianparliament bill-progress list --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2911
# 3. aggancia il DDL Senato per NUMERO, mai per keyword (evita di pescare un DDL omonimo diverso)
italianparliament bill-progress list --number 1933 --branch S --legislature 19  # → ddl_uri, es. dati.senato.it/ddl/60201
# 4. voti Senato sul DDL corretto (+ caveat fiducia più sotto)
italianparliament senato-votes list --ddl-uri http://dati.senato.it/ddl/60201
# 5. contenuto: il testo NON è nei metadati; se non lo scarichi, non descrivere il contenuto
italianparliament bill-text links --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2911
italianparliament bill-text fetch --did 60201 --out testo.md
```
Nota voti Camera: se `--keyword`/numero non trova il **voto finale** o la **fiducia**, filtra per intervallo di date attorno alla data di trasmissione (`votes list --date-from … --date-to …`) e leggi il dettaglio con `vote-detail`, invece di dedurre o inventare il conteggio.

## Ricerca testuale (`--keyword`)

`--keyword` (su `bills`, `aic`, `committee-sessions`, ecc.) è un **match letterale** sul **titolo formale** dell'atto, non una ricerca semantica: cerca la stringa così com'è nel testo ufficiale. Il lessico giornalistico spesso **non coincide** con quello normativo, quindi un risultato vuoto è quasi sempre un mismatch di parole, **non** un dato assente.

Regole d'oro:

- **Usa il termine normativo, non quello giornalistico.** Es. `elezione` (non `elettorale`), `disabilità`/`portatori di handicap`, `sostegno` (non `fuorisede`/`fuori sede`). In dubbio, prova entrambi.
- **Conversioni di decreto-legge: cerca col numero del decreto.** Il titolo formale inizia sempre con «Conversione in legge del decreto-legge <data>, n. <numero>…», quindi il numero (es. `--keyword "127"`, meglio con un intervallo di date attorno alla presentazione) è un aggancio più affidabile di qualunque sinonimo tematico: il nome giornalistico del provvedimento ("riforma della Maturità", "DL Semplificazioni") nel titolo spesso non compare.
- **Prova più sinonimi e radici di parola** prima di concludere. Preferisci la **radice** breve che copre più forme: `elett` → elettorale/elettori, `elez` → elezione/elezioni (occhio: `elezioni` al plurale non matcha un titolo con `elezione` al singolare — la radice sì); `ambient` → ambiente/ambientale. Se il tool matcha a confini di parola (es. `aic --keyword`), usa più keyword separate.
- **Vuoto ≠ assente.** Se non trovi nulla, riformula con un sinonimo o una radice prima di dire all'utente che il dato non c'è. Solo dopo 2-3 varianti fallite l'assenza è credibile.
- **Per dati di una commissione, prima risolvi il nome ufficiale.** `--committee-name` (su `audizioni`, `committee-sessions`) è un match letterale sul label ufficiale dell'organo, e il nome giornalistico spesso non coincide: la "commissione Covid" nel LOD è «…SARS-CoV-2», la stringa "covid" non compare mai. L'elenco è piccolo (~85 organi per la Camera in leg. 19), quindi la ricetta è: `committees list --chamber camera --legislature 19 --format csv | grep -i <radice>` (es. `sars`, `cov`, `inchiesta`), poi passa il nome esatto o l'URI a `audizioni`/`committee-sessions`/`committee-members`.
- **Sindacato ispettivo (Senato) non è ricercabile per argomento**: `sindacato-ispettivo --keyword` non filtra sull'oggetto perché il LOD Senato non espone l'oggetto/testo dell'atto (solo tipo, numero, data, firmatari). Il testo vive solo nella pagina HTML esterna. Non promettere ricerche tematiche su questo tool.
- **Sul Senato la keyword corta conviene due volte.** Oltre a matchare più forme, evita di sbattere contro il limite di dimensione delle richieste (vedi Tips): sui tool Senato la keyword entra tre volte nella query, quindi una frase lunga la fa crescere in fretta.

## Grounding (non inventare)

Quando ricostruisci iter, voti o schede, il rischio è la **confabulazione su scheletro reale**: partire da un dato giusto e riempire i buchi con valori plausibili ma falsi (voti, date, firmatari, contenuti). Regole:

- **Riporta solo ciò che un comando ha restituito.** Se un voto, un firmatario, una data o un contenuto non è nell'output, scrivi "non disponibile" — non completare con numeri o nomi verosimili.
- **Aggancia gli atti per identificatore, non per keyword.** Il DDL Senato di un atto Camera va risolto per numero (`bill-progress --number … --branch S`), così non si confondono atti omonimi.
- **Distingui "Dato" (da tool) da "Sintesi/interpretazione" (tua).** Le deduzioni (es. data di entrata in vigore calcolata, sigle di gruppo espanse) vanno dichiarate come tali.
- **Cita per riga**: l'URL della votazione/atto/scheda accanto al dato, non un'unica fonte cumulativa in fondo.

## Tips

- Pipe CSV into `duckdb -c "SELECT ... FROM read_csv_auto('/dev/stdin')"` for SQL analysis
- Use `--limit` to cap results during exploration
- URIs from `list` commands can be passed to `show` commands
- **Senato confidence votes have empty `ddl_uri` at the source**, but `senato-votes list --ddl-uri <uri>` **now returns the *fiducia* anyway** (it resolves the DDL's seduta dates and re-links the confidence vote of that day). Still check `ddl_uri` on any "final" vote found by date: it may belong to a different act (unified text). `--ddl-uri` **derives the legislature from the DDL**, so a historical DDL (e.g. leg.18 `http://dati.senato.it/ddl/52988`) works without passing `--legislature`.
- **Senato — quando c'è il voto individuale**: `senato-vote-detail` dà il sì/no del singolo senatore solo per i voti di **merito** (`type` = `elettronica`, `nominale con appello`, `controprova`). Per `segreta` (voto segreto) e `verifica numero legale` (conteggio del quorum) restituisce solo le presenze (`Presente non votante`, `In congedo/missione`), **mai** una scelta espressa (né `Favorevole`, né `Contrario`, né `Astenuto`): la scelta non è nel dato. Non dedurre il voto individuale su queste due modalità.
- **Question time Camera per sede**: le interrogazioni a risposta immediata hanno la sede nel label in modo regolare, e `aic --type` matcha anche sul label. Quindi la sede è già filtrabile senza campo dedicato: `aic list --type "immediata in assemblea"` = question time in Aula, `aic list --type "immediata in commissione"` = in commissione (combinabile con `--keyword <tema>`).
- **Senato: due errori diversi si presentano allo stesso modo.** L'endpoint del Senato accetta richieste fino a **2047 byte** di URL e rifiuta le più lunghe, ma risponde `403` sia in quel caso sia quando le richieste sono troppo ravvicinate — e la pagina di errore è identica. Regola pratica:
  - **"Query troppo lunga per l'endpoint del Senato"** (errore della CLI, prima di uscire in rete): accorcia la keyword — una radice breve basta, il match è per sottostringa — oppure restringi l'intervallo di date. Ritentare identico non serve a nulla.
  - **`403` restituito dall'endpoint**: sono troppe richieste ravvicinate. Aspetta qualche minuto, non ritentare a raffica. La CLI già distanzia di 2 secondi le proprie chiamate al Senato: il blocco arriva quando si sommano più comandi o test in sequenza.
  - Nota: il limite riguarda **solo il Senato**. La Camera accetta richieste molto più grandi.
