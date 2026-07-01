# LOD wiki — log

## 2026-07-01

* **Initialization**: creata struttura del bundle OKF (`index.md`, `camera/`, `senato/`).
* **Creation**: prima concept page verificata — [emendamenti Camera assenti dal LOD](/camera/assenti.md), esito del sondaggio endpoint del 2026-07-01 (issue #19).
* **Creation**: [trappole Virtuoso — Senato](/senato/trappole.md) (Gotcha), con il quirk di matching nomi fn/ln separati verificato oggi (issue #20).
* **Creation**: [collegare Votazione al DDL](/senato/votazione-ddl-link.md) (Query Template) — link parziale + resolver `osr:fase="S.<num>"`, da indagine LOD (issue #21).
* **Update**: resolver #21 **implementato** nei tool `senato-votes`/`votes` (colonna `bill_number` + fallback `ddl_uri`/`bill_uri`); Camera via verifica `dc:identifier`, non URI fabbricato (v0.8.0).
