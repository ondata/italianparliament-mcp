// Catalogo delle capacità per il comando `which`: una voce per comando
// (mai forme combinate "a / b": devono essere copia-incollabili) e un
// esempio pronto da eseguire per ciascuna. Estratto in un modulo separato
// per essere testabile (cli.ts esegue runMain all'import).

export type Capability = { cmd: string; terms: string[]; desc: string; example: string };

export const CAPABILITIES: Capability[] = [
  { cmd: "search find", terms: ["cerca", "nome", "parlamentare", "trova persona", "search"], desc: "Cerca un parlamentare per nome (Camera+Senato)", example: 'italianparliament search find --name "rossi"' },
  { cmd: "person-career show", terms: ["carriera", "governo", "ministro", "doppio incarico", "legislature", "wikidata"], desc: "Carriera unificata di una persona (mandati + governo)", example: "italianparliament person-career show --uri http://dati.camera.it/ocd/persona.rdf/p302103" },
  { cmd: "deputy show", terms: ["scheda", "deputato", "anagrafica", "nascita"], desc: "Scheda di un deputato", example: "italianparliament deputy show --uri http://dati.camera.it/ocd/deputato.rdf/d306921_17" },
  { cmd: "senator show", terms: ["scheda", "senatore", "anagrafica", "nascita"], desc: "Scheda di un senatore", example: "italianparliament senator show --uri http://dati.senato.it/senatore/29110" },
  { cmd: "bills list", terms: ["disegno di legge", "ddl camera", "proposta di legge", "atti"], desc: "Disegni di legge Camera (filtri per data, iniziativa, keyword)", example: "italianparliament bills list --legislature 19 --keyword autonomia --limit 50" },
  { cmd: "bill show", terms: ["scheda atto", "ddl camera", "atto camera"], desc: "Scheda di un atto Camera", example: "italianparliament bill show --uri http://dati.camera.it/ocd/attocamera.rdf/ac19_1234" },
  { cmd: "people resolve", terms: ["nome", "nomi", "risolvi uri", "chi è", "uri persona", "nominativo", "batch"], desc: "Risolve URI persona (Camera+Senato) ai nomi, in batch", example: "italianparliament people resolve --uris http://dati.senato.it/senatore/32,http://dati.camera.it/ocd/deputato.rdf/d308917_19" },
  { cmd: "bill-progress list", terms: ["iter", "ddl senato", "stato ddl", "iter camera", "timeline atto"], desc: "Iter dei DDL al Senato; con --uri <atto Camera> la timeline iter della Camera", example: "italianparliament bill-progress list --legislature 19 --keyword autonomia --limit 20" },
  { cmd: "bill-rapporteurs list", terms: ["relatore", "relatori", "relatrice", "chi relaziona"], desc: "Relatori di un DDL (Camera o Senato, dall'URI)", example: "italianparliament bill-rapporteurs list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2807" },
  { cmd: "bill-committees list", terms: ["commissione", "commissioni", "assegnazione", "assegnato", "sede referente", "sede consultiva"], desc: "Commissioni a cui un DDL/atto è assegnato (Camera o Senato, dall'URI)", example: "italianparliament bill-committees list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2822" },
  { cmd: "bill-text links", terms: ["testo", "articolato", "pdf", "testo ddl", "contenuto legge"], desc: "Link al testo di un DDL (Camera o Senato)", example: "italianparliament bill-text links --uri http://dati.senato.it/ddl/55479" },
  { cmd: "bill-text fetch", terms: ["testo", "scarica testo", "markdown", "testo ddl", "waf"], desc: "Scarica e converte il testo di un DDL Senato (solo CLI locale: supera il WAF con un browser reale)", example: "italianparliament bill-text fetch --did 56784" },
  { cmd: "amendments list", terms: ["emendamenti", "ostruzionismo", "firmatari emendamento", "proponente"], desc: "Emendamenti Senato (--ddl-uri per un DDL; --with-proponents per i firmatari)", example: "italianparliament amendments list --ddl-uri http://dati.senato.it/ddl/60233 --with-proponents --limit 20" },
  { cmd: "camera-amendments list", terms: ["emendamenti camera", "proposte emendative"], desc: "Emendamenti a un atto Camera, per sede (fonte HTML, non LOD)", example: "italianparliament camera-amendments list --bill-uri http://dati.camera.it/ocd/attocamera.rdf/ac19_2696 --count-only" },
  { cmd: "committee-sessions list", terms: ["commissione", "sedute", "lavori commissione", "attività commissione", "follow commissione", "bollettini commissione"], desc: "Attività delle commissioni: iter di un DDL (--ddl-uri) o sedute per data (--committee-name + --chamber)", example: "italianparliament committee-sessions list --committee-name giustizia --chamber both --legislature 19" },
  { cmd: "audizioni list", terms: ["audizione", "audizioni", "auditi", "indagine conoscitiva"], desc: "Audizioni delle commissioni Camera (nome/ruolo dell'audito nel titolo)", example: "italianparliament audizioni list --legislature 19 --committee-name femminicidio" },
  { cmd: "votes list", terms: ["votazione", "voto", "fiducia", "camera", "votazioni camera"], desc: "Votazioni Camera con contatori", example: "italianparliament votes list --legislature 19 --keyword bilancio --limit 50" },
  { cmd: "vote-detail show", terms: ["come ha votato", "voto individuale", "voto deputato", "ribelli"], desc: "Come ha votato ogni deputato in una votazione", example: "italianparliament vote-detail show --vote-uri http://dati.camera.it/ocd/votazione.rdf/vs19_047_005" },
  { cmd: "senato-votes list", terms: ["votazione senato", "votazioni senato", "fiducia senato"], desc: "Votazioni Senato con esito e contatori", example: "italianparliament senato-votes list --legislature 19 --confidence-vote true" },
  { cmd: "senato-vote-detail show", terms: ["voto senatore", "come ha votato senato", "ribelli senato"], desc: "Come ha votato ogni senatore in una votazione", example: "italianparliament senato-vote-detail show --vote-uri http://dati.senato.it/votazione/19-167-42" },
  { cmd: "attendance show", terms: ["presenze", "assenze", "quante volte non ha votato", "attivismo deputato"], desc: "Conteggio aggregato voti di un deputato per legislatura", example: "italianparliament attendance show --uri http://dati.camera.it/ocd/deputato.rdf/d302103_19" },
  { cmd: "senato-attendance show", terms: ["presenze senato", "assenze senatore", "in missione", "attivismo senatore"], desc: "Conteggio aggregato voti di un senatore per legislatura", example: "italianparliament senato-attendance show --senator-uri http://dati.senato.it/senatore/3900 --legislature 19" },
  { cmd: "aic list", terms: ["interrogazione", "interpellanza", "mozione", "sindacato ispettivo camera", "tema"], desc: "Atti di indirizzo e controllo Camera (--keyword)", example: "italianparliament aic list --legislature 19 --keyword xylella" },
  { cmd: "sindacato-ispettivo list", terms: ["interrogazione senato", "interpellanza senato"], desc: "Sindacato ispettivo Senato", example: "italianparliament sindacato-ispettivo list --legislature 19 --keyword xylella" },
  { cmd: "groups list", terms: ["gruppo", "gruppi", "gruppi parlamentari"], desc: "Gruppi parlamentari Camera", example: "italianparliament groups list --legislature 19" },
  { cmd: "group-members list", terms: ["composizione gruppo", "membri gruppo", "iscritti gruppo"], desc: "Composizione di un gruppo Camera", example: "italianparliament group-members list --group-uri http://dati.camera.it/ocd/gruppoParlamentare.rdf/gp19_1" },
  { cmd: "rank list", terms: ["classifica", "ranking", "più attivi", "top"], desc: "Classifiche per parlamentare (aic, bills, speeches, ...)", example: "italianparliament rank list --rank-by speeches --legislature 19 --limit 10" },
  { cmd: "group-rank list", terms: ["classifica gruppi", "per gruppo", "gruppi più attivi"], desc: "Classifiche per gruppo con media per membro", example: "italianparliament group-rank list --rank-by aic --legislature 19" },
  { cmd: "gov-members list", terms: ["ministro", "governo", "sottosegretario", "rimpasto"], desc: "Membri del governo", example: "italianparliament gov-members list --legislature 19" },
  { cmd: "committees list", terms: ["commissioni", "elenco commissioni"], desc: "Commissioni Camera+Senato", example: "italianparliament committees list --chamber both --legislature 19" },
  { cmd: "committee-members list", terms: ["membri commissione", "composizione commissione"], desc: "Membri di una commissione con ruoli", example: "italianparliament committee-members list --committee-uri http://dati.senato.it/commissione/0-2 --chamber senato" },
  { cmd: "speeches list", terms: ["intervento", "discorso", "aula"], desc: "Interventi in aula (Camera+Senato)", example: "italianparliament speeches list --deputy-uri http://dati.camera.it/ocd/deputato.rdf/d306921_17 --count-only" },
  { cmd: "sparql query", terms: ["sparql", "query libera", "dato non coperto"], desc: "Query SPARQL libera (ultima risorsa)", example: 'italianparliament sparql query --endpoint senato --query "PREFIX osr: <http://dati.senato.it/osr/> SELECT DISTINCT ?type WHERE { ?s a ?type } LIMIT 20"' },
];


// Normalizza e valida la query internamente: la funzione è esportata e deve
// difendersi da sola — con q vuota `t.includes("")` sarebbe sempre vero e
// ogni capability otterrebbe punteggio. Match case-insensitive sui terms.
export function capabilityScore(cap: Capability, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let s = 0;
  for (const term of cap.terms) {
    const t = term.toLowerCase();
    if (t === q) s = Math.max(s, 100);
    else if (t.includes(q)) s = Math.max(s, 70);
    else if (q.includes(t)) s = Math.max(s, 60);
  }
  if (cap.cmd.toLowerCase().includes(q)) s = Math.max(s, 50);
  if (cap.desc.toLowerCase().includes(q)) s = Math.max(s, 40);
  return s;
}
