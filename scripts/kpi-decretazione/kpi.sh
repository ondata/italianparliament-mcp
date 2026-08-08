#!/usr/bin/env bash
#
# KPI sulla produzione legislativa della Camera: chi presenta le leggi, chi
# riesce a farle approvare, quanto ci mette, e quanto pesa la decretazione
# d'urgenza.
#
# Non introduce nuovi tool: orchestra la CLI del progetto (`sparql` e `votes`)
# e aggrega con duckdb. Ogni CSV in output è rigenerabile lanciando di nuovo
# questo script, così i numeri del report restano tracciabili alla query che
# li ha prodotti.
#
#   ./scripts/kpi-decretazione/kpi.sh            # legislature 17 18 19
#   ./scripts/kpi-decretazione/kpi.sh 19         # solo la 19
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="${ITALIANPARLIAMENT_CLI:-node $ROOT/dist/cli.js}"
OUT="$ROOT/docs/kpi-decretazione/data"
LEGS=("$@")
[ ${#LEGS[@]} -eq 0 ] && LEGS=(17 18 19)

mkdir -p "$OUT"

OCD="http://dati.camera.it/ocd"
DC="http://purl.org/dc/elements/1.1"

# Il tool sparql tronca a 25 righe se non gli si dice altro, e l'avviso di
# troncamento finisce su stdout insieme ai dati. Qui si alza il limite al
# massimo consentito (1000) e si ABORTISCE se l'avviso compare lo stesso:
# un CSV troncato in silenzio darebbe KPI sbagliati che sembrano giusti.
run_sparql() {
  local out
  # shellcheck disable=SC2086
  out="$($CLI sparql --endpoint camera --query "$1" --limit 1000 --format csv)"
  if grep -q '^AVVISO:' <<<"$out"; then
    echo "ERRORE: query troncata al limite di 1000 righe, il CSV sarebbe incompleto." >&2
    echo "        Serve paginare con LIMIT/OFFSET espliciti nella query." >&2
    exit 1
  fi
  printf '%s\n' "$out"
}

leg_uri() { echo "<$OCD/legislatura.rdf/repubblica_$1>"; }

for L in "${LEGS[@]}"; do
  LU="$(leg_uri "$L")"
  echo "== legislatura $L ==" >&2

  # --- Atti presentati per iniziativa -------------------------------------
  # Denominatore di ogni tasso. NB: si usa COUNT(DISTINCT ?s), non il
  # --count-only del tool bills, che senza filtro di legislatura gonfia del
  # 32% (un atto con più cofirmatari o più URL vale più righe).
  echo "  presentati per iniziativa" >&2
  run_sparql "SELECT ?iniziativa (COUNT(DISTINCT ?s) AS ?presentati) WHERE {
    ?s a <$OCD/atto> ; <$OCD/rif_leg> $LU .
    OPTIONAL { ?s <$OCD/iniziativa> ?iniziativa }
  } GROUP BY ?iniziativa ORDER BY DESC(?presentati)" > "$OUT/presentati-per-iniziativa-leg$L.csv"

  # --- Atti arrivati a legge, per iniziativa ------------------------------
  # "Approvato definitivamente" è uno stato TERMINALE dell'iter, quindi basta
  # la sua esistenza: non serve ricostruire l'ultimo stato per atto (rif_statoIter
  # è una storia — "Da assegnare" compare su tutti gli atti, nessuno escluso).
  # Il match copre sia "Approvato definitivamente. Legge" sia "Approvato
  # definitivamente, non ancora pubblicato" sia la variante "dal Senato".
  echo "  leggi per iniziativa" >&2
  run_sparql "SELECT ?iniziativa (COUNT(DISTINCT ?s) AS ?leggi) WHERE {
    ?s a <$OCD/atto> ; <$OCD/rif_leg> $LU ; <$OCD/rif_statoIter> ?si .
    ?si <$DC/title> ?t .
    FILTER(CONTAINS(STR(?t), \"Approvato definitivamente\"))
    OPTIONAL { ?s <$OCD/iniziativa> ?iniziativa }
  } GROUP BY ?iniziativa ORDER BY DESC(?leggi)" > "$OUT/leggi-per-iniziativa-leg$L.csv"

  # --- Tempi: presentazione -> approvazione definitiva --------------------
  # MIN sulla data di approvazione perché un atto può avere più stati
  # "Approvato definitivamente" (prima "non ancora pubblicato", poi "Legge").
  # Le mediane si calcolano a valle: SPARQL non le sa fare.
  echo "  tempi per atto" >&2
  run_sparql "SELECT ?s ?iniziativa ?presentazione (MIN(?d) AS ?approvazione) WHERE {
    ?s a <$OCD/atto> ; <$OCD/rif_leg> $LU ;
       <$DC/date> ?presentazione ; <$OCD/rif_statoIter> ?si .
    ?si <$DC/title> ?t ; <$DC/date> ?d .
    FILTER(CONTAINS(STR(?t), \"Approvato definitivamente\"))
    OPTIONAL { ?s <$OCD/iniziativa> ?iniziativa }
  } GROUP BY ?s ?iniziativa ?presentazione" > "$OUT/tempi-per-atto-leg$L.csv"

  # --- Conversioni di decreto-legge ---------------------------------------
  # ATTENZIONE, punto più fragile di tutta l'analisi: i decreti-legge NON hanno
  # una natura propria nel grafo (rif_natura ha 4 soli valori, tutti
  # disegno/proposta × ordinario/costituzionale), quindi l'unico modo di
  # isolarli è il titolo. "Conversione in legge" è la formula di rito e non
  # compare nelle proposte che si limitano a citare un DL: cercare solo
  # "decreto-legge" gonfierebbe il conto di ~60% (in leg. 19: 218 contro 134).
  echo "  conversioni DL" >&2
  run_sparql "SELECT (COUNT(DISTINCT ?s) AS ?dl_presentati) WHERE {
    ?s a <$OCD/atto> ; <$OCD/rif_leg> $LU ; rdfs:label ?l .
    FILTER(CONTAINS(LCASE(STR(?l)), \"conversione in legge\"))
  }" > "$OUT/dl-presentati-leg$L.csv"

  run_sparql "SELECT (COUNT(DISTINCT ?s) AS ?dl_convertiti) WHERE {
    ?s a <$OCD/atto> ; <$OCD/rif_leg> $LU ; rdfs:label ?l ;
       <$OCD/rif_statoIter> ?si .
    ?si <$DC/title> ?t .
    FILTER(CONTAINS(LCASE(STR(?l)), \"conversione in legge\"))
    FILTER(CONTAINS(STR(?t), \"Approvato definitivamente\"))
  }" > "$OUT/dl-convertiti-leg$L.csv"

  # Decreti decaduti: l'unico appiglio STRUTTURALE ai DL in tutto il grafo,
  # ma marca solo i falliti — non serve a contarli, serve a misurarli.
  run_sparql "SELECT (COUNT(DISTINCT ?s) AS ?dl_decaduti) WHERE {
    ?s a <$OCD/atto> ; <$OCD/rif_leg> $LU ; <$OCD/rif_statoIter> ?si .
    ?si <$DC/title> \"Decreto-legge decaduto\" .
  }" > "$OUT/dl-decaduti-leg$L.csv"

  # --- Voti di fiducia ------------------------------------------------------
  # Via il tool votes, che conosce già la proprietà richiestaFiducia.
  # Il valore del flag è obbligatorio: `--confidence-vote` nudo viene ignorato
  # in silenzio e restituisce TUTTE le votazioni.
  echo "  fiducie" >&2
  # shellcheck disable=SC2086
  $CLI votes list --legislature "$L" --confidence-vote true --count-only --format csv \
    | grep -v '^AVVISO:' > "$OUT/fiducie-leg$L.csv" || true
done

echo "== dati grezzi in $OUT ==" >&2
