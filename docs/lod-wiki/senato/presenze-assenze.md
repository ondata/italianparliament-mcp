# Presenze e assenze di un senatore: l'assenza non è nel dato, si ricava

Il LOD Senato registra, per ogni votazione, come si è comportato ciascun senatore, con cinque proprietà inverse (voto → senatore):

`osr:favorevole`, `osr:contrario`, `osr:astenuto`, `osr:presenteNonVotante`, `osr:inCongedoMissione`.

Manca la sesta categoria, quella che il lettore cerca: **l'assente semplice non è registrato**. Chi non era in Aula e non era in missione non compare in nessuna delle cinque, quindi sommare ciò che c'è dà la partecipazione, mai l'assenza.

## La formula (quella di Openpolis)

```
presenze  = favorevole + contrario + astenuto + presenteNonVotante
missioni  = inCongedoMissione
assenze   = denominatore − presenze − missioni
```

Le **missioni non sono assenze**: il senatore è impegnato per incarico istituzionale, e Openpolis le pubblica come terza quota accanto a presenze e assenze. Confonderle produce l'errore più vistoso possibile su un caso reale: Liliana Segre in leg. 19 ha 8.043 congedi/missioni su 8.102 votazioni, cioè il **99,27%** — chi le contasse come assenze la descriverebbe come la più assente del Senato, mentre le assenze vere sono **1** (0,01%).

## Il denominatore è il pezzo difficile

Non è il numero di votazioni della legislatura, ma quelle **cadute dentro il mandato di quel senatore**. Il mandato è in `osr:mandato`, con `osr:inizio` e `osr:fine` (assente per chi è ancora in carica) e la sua `osr:legislatura`; le votazioni si datano attraverso la seduta:

```sparql
SELECT (COUNT(DISTINCT ?v) AS ?n) WHERE {
  <http://dati.senato.it/senatore/32640> osr:mandato ?m .
  ?m osr:legislatura 19 ; osr:inizio ?i .
  OPTIONAL { ?m osr:fine ?f }
  ?v a osr:Votazione ; osr:legislatura 19 ; osr:seduta ?s .
  ?s osr:dataSeduta ?d .
  FILTER(?d >= ?i && (!BOUND(?f) || ?d <= ?f))
}
```

Senza il vincolo di periodo, chi subentra a legislatura iniziata risulta assente per i mesi in cui non sedeva in Senato. Felicia Gaudiano, in carica dall'8 gennaio 2025: denominatore **1.731** invece di 8.102, e una presenza del **96,24%** invece di circa il 20%.

Tre dettagli che evitano altrettanti errori:

- `COUNT(DISTINCT ?v)` e non `COUNT(?v)`: chi decade e rientra ha **più di un mandato** nella stessa legislatura, e i periodi si sovrappongono al join.
- `osr:fine` va reso opzionale: chi è in carica non ce l'ha, e un `FILTER` che la pretende svuota il risultato.
- il mandato dei **senatori a vita** porta `osr:legislatura` esattamente come quello degli elettivi (verificato su Segre): non serve un ramo a parte.

## Quanto è confrontabile con Openpolis

Confronto in legislatura 19 (10 agosto 2026), percentuali presenze / missioni / assenze:

| senatore | calcolato | Openparlamento |
|---|---|---|
| Marcello Pera | 41,1 / 22,7 / 36,2 | 41,5 / 22,6 / 35,8 |
| Matteo Renzi | 51,3 / 16,5 / 32,2 | 52,5 / 16,3 / 31,3 |

Gli scarti (0,1-1,2 punti) hanno due cause: Openpolis **scarta alcune votazioni** dal denominatore — [conta le sole votazioni elettroniche](https://www.openpolis.it/parole/come-si-contano-assenze-presenze-e-missioni-parlamentari/), mentre le 8.102 della legislatura comprendono anche controprove, verifiche del numero legale, votazioni nominali con appello e segrete — e fotografa i dati in un momento diverso dal nostro.

Le percentuali sono quindi **confrontabili entro circa un punto**, non identiche: vanno presentate come ricalcolate sul dato ufficiale, non come le cifre di Openpolis.

## `osr:presenti` NON è la presenza di cui parla Openpolis

La votazione porta dei contatori già pronti (`osr:presenti`, `osr:votanti`, `osr:favorevoli`, `osr:contrari`, `osr:astenuti`, `osr:congedoMissione`), e la scorciatoia viene naturale: se c'è `osr:presenti`, perché sommare cinque proprietà? Perché quel contatore misura un'altra cosa. Aggregato su tutte le 8.102 votazioni della legislatura 19:

| grandezza | totale |
|---|---:|
| `osr:presenti` | 1.203.182 |
| `osr:votanti` | 1.192.670 |
| `osr:favorevoli` + `osr:contrari` + `osr:astenuti` | 1.184.960 |
| coppie `osr:presenteNonVotante` | 61.529 |
| presenze secondo Openpolis (espressi + pnv) | **1.246.489** |

`osr:presenti` eccede i votanti di appena 10.512 su tutta la legislatura, mentre i presenti non votanti registrati sono **61.529**: il contatore ne include quindi solo una piccola parte, e resta 43.307 sotto la presenza in senso Openpolis. Sulla singola votazione la differenza si vede a occhio nudo: la `19-447-2` ha `presenti` 161 e `votanti` 160, ma i senatori con `osr:presenteNonVotante` sono **5**.

**Regola: le presenze si contano dalle cinque proprietà per-senatore, non da `osr:presenti`.** Il contatore serve a leggere il singolo voto (quorum, esito), non a costruire statistiche di presenza.

I contatori non sono però inaffidabili in generale: `osr:congedoMissione` sommato su tutta la legislatura fa **281.283**, esattamente il numero di relazioni `osr:inCongedoMissione` registrate. È proprio la coincidenza perfetta sulle missioni a rendere più insidioso lo scarto sui presenti — chi verificasse la coerenza dei contatori su quello sbagliato ne concluderebbe che può fidarsi anche degli altri.

## Punto aperto

Resta da capire quale sottoinsieme esatto di votazioni usi Openpolis come denominatore: la scomposizione della legislatura 19 è elettronica 7.860, verifica del numero legale 91, controprova 79, nominale con appello 59, segreta 13 (totale 8.102), e nessuna combinazione ovvia riproduce il ~7.890-7.897 che Openparlamento mostra per un senatore a mandato pieno.

Implementato in `senato-attendance` (colonne `presenze`, `assenze`, `votazioni_periodo`, `presenze_pct`, `missioni_pct`, `assenze_pct`), che lascia le percentuali **vuote** se il periodo di mandato non spiega tutti i voti registrati, invece di pubblicarne una sopra il 100%.
