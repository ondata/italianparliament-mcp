# Data di un intervento in aula (Camera)

L'intervento (`ocd:intervento`) **non porta la propria data**: l'unica proprietà temporale sull'istanza è `ods:modified`, che è il timestamp di modifica del record, non il giorno in cui l'intervento è stato pronunciato. La data reale vive sulla `ocd:discussione` che raggruppa l'intervento: la discussione lo referenzia con `ocd:rif_intervento` e porta `dc:date`.

```sparql
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?date WHERE {
  ?disc ocd:rif_intervento <http://dati.camera.it/ocd/intervento.rdf/in19_824755> ; dc:date ?date .
}
```

`dc:date` è una stringa semplice `AAAAMMGG` (es. `20260617`), confrontabile lessicograficamente per un filtro a intervallo. La copertura è verificata su **entrambe** le sedi: interventi d'Aula (documento stenografico, `dc:relation` con `sezione=assemblea`) e interventi di commissione (bollettino, `sezione=bollettini`) hanno tutti la discussione con `dc:date`, con cardinalità 1 per intervento.

## Filtrare per data in modo performante

Gli interventi Camera non hanno `ocd:rif_leg`: la legislatura è solo nel pattern URI (`in<leg>_<id>`). Un filtro data va perciò abbinato al range filter sul soggetto (`FILTER(?s >= <…in19_> && ?s < <…in19_z>)`), che àncora l'indice Virtuoso; il join sulla discussione con il `FILTER` sulle date va **dentro** la subquery che seleziona/ordina/limita i soli `?s`, così il filtro precede il `LIMIT`. Senza il vincolo di legislatura la query perde l'àncora ed è molto più lenta. Questo è esattamente ciò che fa il tool `speeches` con `--date-from`/`--date-to`.
