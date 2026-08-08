-- Aggregazione dei CSV grezzi prodotti da kpi.sh nei KPI finali.
--   duckdb -c ".read scripts/kpi-decretazione/aggrega.sql"
-- Va lanciato dalla radice del repo. Output in markdown, pronto da incollare
-- nel report.

.mode markdown

-- La legislatura sta nel nome del file, non dentro i dati.
CREATE OR REPLACE MACRO leg(f) AS
  CAST(regexp_extract(f, 'leg(\d+)\.csv$', 1) AS INTEGER);

CREATE OR REPLACE VIEW presentati AS
  SELECT leg(filename) AS legislatura, iniziativa, presentati
  FROM read_csv_auto('docs/kpi-decretazione/data/presentati-per-iniziativa-leg*.csv',
                     filename = true, union_by_name = true);

CREATE OR REPLACE VIEW leggi AS
  SELECT leg(filename) AS legislatura, iniziativa, leggi
  FROM read_csv_auto('docs/kpi-decretazione/data/leggi-per-iniziativa-leg*.csv',
                     filename = true, union_by_name = true);

CREATE OR REPLACE VIEW tempi AS
  SELECT leg(filename) AS legislatura,
         coalesce(iniziativa, '(non indicata)') AS iniziativa,
         date_diff('day',
                   strptime(CAST(presentazione AS VARCHAR), '%Y%m%d'),
                   strptime(CAST(approvazione  AS VARCHAR), '%Y%m%d')) AS giorni
  FROM read_csv_auto('docs/kpi-decretazione/data/tempi-per-atto-leg*.csv',
                     filename = true, union_by_name = true);

CREATE OR REPLACE VIEW decreti AS
  SELECT leg(filename) AS legislatura, dl_presentati
  FROM read_csv_auto('docs/kpi-decretazione/data/dl-presentati-leg*.csv',
                     filename = true, union_by_name = true);

CREATE OR REPLACE VIEW convertiti AS
  SELECT leg(filename) AS legislatura, dl_convertiti
  FROM read_csv_auto('docs/kpi-decretazione/data/dl-convertiti-leg*.csv',
                     filename = true, union_by_name = true);

CREATE OR REPLACE VIEW decaduti AS
  SELECT leg(filename) AS legislatura, dl_decaduti
  FROM read_csv_auto('docs/kpi-decretazione/data/dl-decaduti-leg*.csv',
                     filename = true, union_by_name = true);

CREATE OR REPLACE VIEW fiducie AS
  SELECT leg(filename) AS legislatura, count AS fiducie
  FROM read_csv_auto('docs/kpi-decretazione/data/fiducie-leg*.csv',
                     filename = true, union_by_name = true);

-- KPI 1 — Tasso di successo per iniziativa -----------------------------------
SELECT p.legislatura,
       coalesce(p.iniziativa, '(non indicata)') AS iniziativa,
       p.presentati,
       coalesce(l.leggi, 0) AS leggi,
       round(100.0 * coalesce(l.leggi, 0) / p.presentati, 1) AS "successo_%"
FROM presentati p LEFT JOIN leggi l USING (legislatura, iniziativa)
WHERE p.presentati >= 10          -- sotto la decina il tasso è rumore, non segnale
ORDER BY p.legislatura, p.presentati DESC;

-- KPI 2 — Composizione: chi ha scritto le leggi approvate ---------------------
SELECT legislatura,
       coalesce(iniziativa, '(non indicata)') AS iniziativa,
       leggi,
       round(100.0 * leggi / sum(leggi) OVER (PARTITION BY legislatura), 1) AS "quota_%"
FROM leggi
WHERE leggi >= 5
ORDER BY legislatura, leggi DESC;

-- KPI 3 — Durata dell'iter, in giorni ----------------------------------------
SELECT legislatura, iniziativa,
       count(*) AS leggi,
       CAST(median(giorni) AS INTEGER) AS mediana_giorni,
       min(giorni) AS min_giorni,
       max(giorni) AS max_giorni
FROM tempi
GROUP BY ALL
HAVING count(*) >= 5
ORDER BY legislatura, leggi DESC;

-- KPI 4 — Decretazione d'urgenza e fiducie -----------------------------------
SELECT d.legislatura,
       d.dl_presentati,
       c.dl_convertiti,
       x.dl_decaduti,
       f.fiducie,
       (SELECT sum(leggi) FROM leggi WHERE legislatura = d.legislatura) AS leggi_totali,
       round(100.0 * c.dl_convertiti
             / (SELECT sum(leggi) FROM leggi WHERE legislatura = d.legislatura), 1) AS "quota_leggi_da_DL_%"
FROM decreti d
JOIN convertiti c USING (legislatura)
JOIN decaduti   x USING (legislatura)
JOIN fiducie    f USING (legislatura)
ORDER BY d.legislatura;
