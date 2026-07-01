---
type: Reverse Engineering
title: API HTML nascosta per cercare votazioni per provvedimento (Camera)
description: Endpoint POST non documentato dietro il form di ricerca votazioni; risolve il link voto→DDL che manca nel LOD, ma solo su TestoContenuto, non su CDDNUMEROATTO.
resource: https://documenti.camera.it/apps/votazioni/votazionitutte/formVotazioni.asp
tags: [camera, html, scraping, votazione, ddl, link, reverse-engineering]
timestamp: 2026-07-01
---

Il portale umano delle votazioni elettroniche (`documenti.camera.it/apps/votazioni/votazionitutte/`) ha un form di ricerca (`formVotazioni.asp?Legislatura=19`) che internamente fa una POST verso un endpoint non documentato. Intercettato il traffico con agent-browser (nessuna chiamata XHR/JSON: tutto HTML server-side).

# Endpoint

```
POST https://documenti.camera.it/apps/votazioni/votazionitutte/risultatiDB.asp
Content-Type: application/x-www-form-urlencoded
```

Body (nomi campo dal form HTML):

```
action=Votazioni
PagCorr=<pagina, 1-based>
Legislatura=XIX
CDDGIORNO=&CDDMESE=&CDDANNO=       # filtro data seduta (gg/mm/aaaa separati)
PAGESIZE=10                        # IGNORATO dal server: sempre 10 risultati/pagina
progrID=formVotazioni
CDDNATURA=                         # tipo voto: FINALE|EMENDAMENTO|ARTICOLO|MOZIONE|ODG|RISOLUZIONE|DOC|PREGIUDIZIALE|DIMISSIONI|SEGRETA|FIDUCIA
TestoContenuto=                    # parole nel titolo del provvedimento
TipoRicerca=t                      # t=tutte le parole, z=almeno una, f=frase esatta
CDDNUMEROATTO=                     # numero provvedimento — vedi trappola sotto
Nominativo=                        # cognome+nome deputato (dal <select>)
TipoVoto=                          # FAVOREVOLE|CONTRARIO|ASTENUTO|NON HA PARTECIPATO|IN MISSIONE|HA VOTATO|PRESIDENTE DI TURNO
```

Nessuna sessione/cookie richiesta: una POST `curl` stateless, senza aver mai visitato il form prima, funziona identica al browser.

# Trappola: `CDDNUMEROATTO` è una whitelist statica, non un filtro libero

Il `<select id="CDDNUMEROATTO">` nel form è precompilato con **217 opzioni**, dal DDL più vecchio fino a `DDL n. 2488-B`. **Il DDL 2920 (Piano Casa, votato 22-23/6/2026) non c'è**, pur avendo 62 votazioni reali e verificate. Passare `CDDNUMEROATTO=2920` a mano (bypassando il `<select>`) restituisce **0 risultati** — il server valida contro la stessa whitelist, non accetta numeri arbitrari. La whitelist sembra ferma a un certo periodo e non viene aggiornata in tempo reale con l'avanzare della legislatura.

# Soluzione: cercare per testo libero

`TestoContenuto` **non** ha questa limitazione: è un full-text sul titolo del provvedimento (lo stesso testo che finisce in `dc:description` nel LOD, es. "DDL 2920-A - VOTO FINALE", "ODG 9/2920/46"). Cercare `TestoContenuto=2920&TipoRicerca=t` restituisce **"Trovate 62 schede di votazioni"** — combacia esattamente con il conteggio già noto da `votes list --bill-code 2920`.

Ogni risultato ha un link diretto alla scheda:

```html
<a class="btn-scheda voto" href="schedaVotazione.asp?...&RifVotazione=680_31&tipo=dettaglio">SCHEDA</a>
```

`RifVotazione` è lo stesso identificatore (`<seduta>_<numero>`) già esposto dal campo `url` della CLI (`votes list`). Paginazione fissa a 10/pagina: per 62 risultati servono le pagine `PagCorr=1..7`.

# Verifica per data (alternativa)

Il filtro data (`CDDGIORNO`/`CDDMESE`/`CDDANNO`) funziona senza limiti di whitelist ed è la via naturale quando si parte da una notizia con data certa: `CDDANNO=2026&CDDMESE=06&CDDGIORNO=23` → "Trovata 1 scheda" (il voto finale `681_1`, titolo "DDL 2920-A - VOTO FINALE").

# Esempio JavaScript (Node, fetch nativo)

Cerca tutte le votazioni per numero di provvedimento, pagina automaticamente, estrae `RifVotazione` e titolo dall'HTML (nessuna dipendenza da parser HTML: due regex bastano per questa struttura fissa).

```javascript
const BASE = "https://documenti.camera.it/apps/votazioni/votazionitutte/risultatiDB.asp";

async function fetchPage(numeroAtto, pagCorr) {
  const body = new URLSearchParams({
    action: "Votazioni",
    PagCorr: String(pagCorr),
    Legislatura: "XIX",
    PAGESIZE: "10", // ignorato dal server, sempre 10/pagina
    progrID: "formVotazioni",
    TestoContenuto: numeroAtto, // NON usare CDDNUMEROATTO: whitelist statica, vedi nota
    TipoRicerca: "t",
  });
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return res.text();
}

function parseResults(html) {
  const totalMatch = html.match(/Trovat[ae]\s+(\d+)\s+sched/i);
  const total = totalMatch ? Number(totalMatch[1]) : 0;
  const votes = [...html.matchAll(
    /schedaVotazione\.asp\?[^"]*RifVotazione=(\d+_\d+)[^"]*tipo=dettaglio/g
  )].map((m) => m[1]);
  return { total, votes: [...new Set(votes)] };
}

export async function searchVotazioniByProvvedimento(numeroAtto) {
  const first = parseResults(await fetchPage(numeroAtto, 1));
  const pages = Math.ceil(first.total / 10);
  const allVotes = new Set(first.votes);
  for (let p = 2; p <= pages; p++) {
    const page = parseResults(await fetchPage(numeroAtto, p));
    page.votes.forEach((v) => allVotes.add(v));
  }
  return {
    total: first.total,
    rifVotazioni: [...allVotes],
    urls: [...allVotes].map(
      (rif) =>
        `https://documenti.camera.it/apps/votazioni/votazionitutte/schedavotazione.asp?Legislatura=XIX&RifVotazione=${rif}&tipo=dettaglio`
    ),
  };
}

// searchVotazioniByProvvedimento("2920").then(r => console.log(r.total, r.rifVotazioni));
```

Verificato manualmente il 1° luglio 2026: `searchVotazioniByProvvedimento("2920")` → `total: 62`, stesso identico set di `RifVotazione` già ottenuto da `votes list --legislature 19 --bill-code 2920`.

# Valutazione

Non integrato nel progetto: è scraping HTML di un endpoint non documentato (fragile a cambi di markup, fuori dal perimetro LOD/SPARQL su cui è costruito il resto del progetto). Utile però come:

1. **Prova indipendente** che il gap `ocd:rif_attoCamera` (issue #21) è puramente un problema del LOD e non di dato mancante a monte — anche questo canale "ufficiale ma non documentato" conferma lo stesso numero (62).
2. **Fallback pratico** se in futuro servisse risolvere un DDL non ancora coperto dal parsing di `dc:description` (es. formati di titolo imprevisti): la ricerca full-text qui è fatta dal motore stesso della Camera, non da un regex nostro.

# Citations

[1] Intercettazione traffico con agent-browser (`network requests`) il 2026-07-01: nessuna chiamata XHR, singola POST server-rendered.
[2] Verifica CDDNUMEROATTO whitelist: `document.getElementById('CDDNUMEROATTO').options` → 217 elementi, ultimo "DDL n. 2488-B".
[3] https://github.com/aborruso/italianparliament-mcp/issues/21
