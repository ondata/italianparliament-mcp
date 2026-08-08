# Obiettivi giornalistici — ricette derivabili dai tool esistenti

Documento condiviso tra la skill **CLI** (`italian-parliament-cli`) e la skill **MCP** (`italian-parliament-mcp`).

Catalogo di analisi giornalistiche ricorrenti che **non richiedono un tool dedicato**: si ottengono combinando i tool già disponibili. Regola del progetto: se il risultato è derivabile combinando i tool esistenti, non si crea un nuovo tool — si documenta qui la ricetta.

Due modi di applicare la stessa ricetta, a seconda del contesto:

- **CLI**: pipeline shell (`italianparliament <tool> ... --format jsonl | jq ...`), come negli esempi. Prerequisiti: `jq` ≥ 1.6 (i cloni non sono equivalenti: `jaq` cambia i messaggi d'errore e non tollera tutto ciò che jq tollera — se `jq --version` non risponde `jq-1.x`, non è jq); per i volumi grossi conviene `duckdb` sul CSV, più veloce e tipizzato.
- **MCP** (Claude Desktop / Claude Code): si chiama lo stesso tool e si esegue l'aggregazione **nel ragionamento** (o generando ed eseguendo lo snippet). Gli ingredienti — quali tool e quali campi — sono identici; cambia solo chi calcola la moda/aggregazione.

Ogni voce dichiara: cosa produce, gli ingredienti (quali tool/campi), la ricetta, le scelte analitiche da fare e i limiti di scope.

## Dissidenti / ribelli (voto difforme dalla linea di gruppo)

Chi, in una votazione, ha votato diversamente dalla posizione maggioritaria del proprio gruppo parlamentare. È una delle storie più frequenti (fiducia, leggi chiave, voti di coscienza).

Concetto giornalistico reso popolare da **openpolis** e dal progetto **openparlamento** (parlamento19.openpolis.it): a loro va il credito e il ringraziamento per aver diffuso le analisi sulla disciplina di gruppo e sui "ribelli". Questa ricetta ne rende autonomo il calcolo sui dati LOD ufficiali di Camera e Senato.

### Ingredienti (già esposti dai tool)

Per una votazione servono, per ogni parlamentare: **nome**, **voto**, **gruppo**.

- Camera: `vote-detail show --vote-uri <V>` → `deputy_name`, `vote`, `group_acronym`
- Senato: `senato-vote-detail show --vote-uri <V>` → `senator_name`, `vote`, `group_label`

L'URI della votazione si ottiene da `votes list` (Camera) / `senato-votes list` (Senato).

### Ricetta — Camera

```bash
italianparliament vote-detail show --vote-uri <V> --limit 1000 --format jsonl | jq -s '
  def expressed: ["Favorevole","Contrario","Astensione"];   # l'\''assenza non è dissenso
  group_by(.group_acronym)
  | map(
      (map(select(.vote as $v | expressed | index($v)))) as $exp
      | select(($exp | length) > 0)                                     # gruppo senza voti espressi: nessuna linea, nessun dissidente
      | ($exp | group_by(.vote) | max_by(length) | .[0].vote) as $maj   # linea del gruppo = moda dei voti espressi
      | $exp | map(select(.vote != $maj)
          | {deputy_name, group: .group_acronym, group_majority_vote: $maj, actual_vote: .vote})
    )
  | add // []'
```

### Ricetta — Senato

Identica, cambiano il tool e i nomi dei campi (`group_label`, `senator_name`) e il lessico dei voti espressi (`Astenuto`, non `Astensione`):

```bash
italianparliament senato-vote-detail show --vote-uri <V> --format jsonl | jq -s '
  def expressed: ["Favorevole","Contrario","Astenuto"];
  group_by(.group_label)
  | map(
      (map(select(.vote as $v | expressed | index($v)))) as $exp
      | select(($exp | length) > 0)
      | ($exp | group_by(.vote) | max_by(length) | .[0].vote) as $maj
      | $exp | map(select(.vote != $maj)
          | {senator_name, group: .group_label, group_majority_vote: $maj, actual_vote: .vote})
    )
  | add // []'
```

Nota sul lessico dei voti (diverso tra le camere): Camera = `Favorevole` / `Contrario` / `Astensione` / `Non ha votato`; Senato = `Favorevole` / `Contrario` / `Astenuto` / `Presente non votante` / `In congedo/missione`.

### Via MCP (senza shell)

Stessa logica senza pipeline: chiama `vote-detail` (o `senato-vote-detail`) con l'URI della votazione, poi calcola nel ragionamento — per ogni gruppo, la moda dei voti espressi = linea del gruppo; elenca i membri il cui voto espresso diverge. Ingredienti e scelte analitiche identici a sopra.

### Scelte analitiche (il dato le regge tutte)

- **L'astensione conta come dissenso?** Nella ricetta sì: se il gruppo vota Favorevole e un membro si astiene, è un divergente. Per escluderla, togli l'astensione da `expressed`.
- **Assenze** (`Non ha votato`, `In congedo/missione`, `Presente non votante`): escluse sia dal calcolo della maggioranza sia dai dissidenti (un assente non dissente).
- **Pareggio in gruppi piccoli**: `max_by(length)` sceglie deterministicamente una delle mode; per i gruppi molto piccoli o spaccati la "linea" è ambigua — valutare caso per caso.
- **Gruppo con zero voti espressi** (tutti assenti o in missione: capita ai gruppi piccoli, es. `M-+E-S` sul voto finale del DDL 2957): non ha una linea, quindi la ricetta lo salta con `select(($exp|length) > 0)`. Senza quella guardia jq restituisce comunque il risultato giusto — `max_by(length)` su lista vuota dà `null` e il gruppo contribuisce zero righe — ma un clone come `jaq` si ferma con un errore.

### Limite di scope

La ricetta è banale per **una** votazione o poche. L'aggregato "chi è il parlamentare più ribelle della legislatura" richiede di iterare su **migliaia** di votazioni (una chiamata SPARQL ciascuna): è un problema di **volume**, non di disponibilità del dato. In quel caso conviene un export bulk o un'aggregazione dedicata, non questa pipeline riga per riga.
