# LOD wiki — schema Camera (OCD) e Senato (OSR)

Bundle [OKF](https://github.com/google/open-knowledge-format) (Open Knowledge Format): mappa curata e verificata dello schema Linked Open Data del Parlamento italiano, pensata per orientare un orchestratore AI *prima* di interrogare gli endpoint SPARQL ("compile, don't retrieve").

Il differenziale rispetto a una semplice descrizione dell'ontologia sono le **trappole** operative e gli **assenti verificati**: ciò che nel dato non esiste, per impedire relazioni plausibili ma inesistenti (schema hallucination).

# Camera (OCD)

* [Camera](camera/) - endpoint `dati.camera.it/sparql`, ontologia OCD; entità, trappole e assenti.

# Senato (OSR)

* [Senato](senato/) - endpoint `dati.senato.it/sparql`, ontologia OSR; entità, trappole e assenti.

# Trasversali

* [Trappole Virtuoso — funzioni stringa e confronti](trappole-virtuoso-funzioni-stringa.md) - due comportamenti non standard del motore Virtuoso (entrambi gli endpoint): `SUBSTR` fuori range aborta la query senza short-circuit; `>=`/`<=` sul risultato di funzioni stringa fa un confronto numerico che dà 0 righe se non avvolto in `STR()`. Causa frequente di SPARQL "corretto" ma non funzionante.
* [Freschezza del dato e cosa fa fede sull'approvazione](freschezza-e-autorevolezza.md) - il LOD non espone un "as-of" affidabile; per l'esito (approvato/respinto/promulgato) la fonte di verità è resoconto/scheda iter/GU. Distinzione "approvato da un ramo" ≠ "legge".
* [Dati anagrafici dei parlamentari](dati-anagrafici.md) - nascita, genere, luogo: due nodi alla Camera (persona vs deputato), doppia forma al Senato; geografia di nascita strutturata al Senato (`cittaNascita`/`provinciaNascita`/`nazioneNascita`) ma solo dentro l'URI luogo alla Camera; regione derivata da provincia con tabella SITUAS/ISTAT; trappole su formati data, filtro legislatura e parsing dello slug Camera.
