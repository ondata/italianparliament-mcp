---
type: Concept
title: Audizioni Camera (ocd:dibattito via dc:title)
description: Come il tool audizioni estrae le audizioni delle commissioni Camera dal LOD OCD — leg. 19 via titolo della discussione, leg. 14 via dc:type storico.
tags: [camera, ocd, audizioni, discussione, dibattito, commissioni]
timestamp: 2026-07-06
---

# Audizioni Camera

Il tool `audizioni list` estrae le audizioni delle commissioni Camera. Due modalità.

## Leg. 19: via titolo della discussione

Le audizioni non sono modellate come entità dedicate. La legislatura corrente (19) non ha `dc:type="Audizione"` sulle `ocd:discussione`. La discovery passa dal **testo del `dc:title`** della `ocd:discussione` collegata a un `ocd:dibattito`: il titolo contiene "Audizione di …". Una REGEX server-side esclude i falsi positivi d'agenda ("… allo svolgimento di un'audizione").

Cosa si ottiene per ogni audizione:
- `date` — dal pattern URI del dibattito
- `committee` — dal label del dibattito padre
- `title` — il `dc:title` della discussione (contiene nome e ruolo dell'audito)
- `bill_codes` / `bill_uris` — atti collegati (se presenti)
- `bulletin_url` — link al bollettino

## Leg. 14: via dc:type storico

La legislatura 14 ha `dc:type="Audizione"` strutturato sulle discussioni (619 record). La data si ricava dal suffisso URI.

## Limitazioni

- **Senato non coperto**: `osr:Procedura tipo="Audizioni"` esiste (1.833 leg.19) ma è orfano di data e commissione.
- **Matching `--committee-name` è letterale**: il parametro cerca una sottostringa nel label del dibattito ("Commissione parlamentare di inchiesta sulla gestione dell'emergenza sanitaria…"). "Covid" non matcha, "emergenza sanitaria" sì. Il label ufficiale è quello del `rdfs:label` del dibattito.
- **Nessun link video/YouTube** nel LOD (tutti i `dc:relation` → bollettino testuale).
