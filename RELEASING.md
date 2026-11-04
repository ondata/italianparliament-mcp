# Processo di release

Release manuale, senza CI. Distribuzione: **CLI/MCP su npm** come
[`@aborruso/italianparliament-mcp`](https://www.npmjs.com/package/@aborruso/italianparliament-mcp),
più server MCP HTTP su Cloudflare Worker, skill e pacchetto `.dxt`.

## Passi per una nuova versione `X.Y.Z`

1. **Allinea la versione in 5 punti** (devono restare identici):
   - `package.json` → campo `version`
   - `src/server.ts` → `version:` passato a `new McpServer(...)`
   - `src/worker.ts` → campo `version` dell'info endpoint **e** il contatore `tools:` (numero di tool registrati)
   - `src/core/client.ts` → stringa `User-Agent` (`italianparliament-mcp/X.Y.Z`)
   - `manifest.json` → campo `version` del pacchetto DXT

2. **Build e type-check** (il type-check del MCP SDK richiede heap maggiorato):

   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
   npm run build         # CLI + MCP stdio (dist/cli.js, dist/index.js)
   npm run build:worker  # Cloudflare Worker (dist/worker.js)
   npm test -- --run     # vitest (senza --run resta in watch e blocca)
   npm run test:fails    # quali test sono rossi, dal report dell'ultima run
   ```

   La suite interroga i due endpoint SPARQL reali e dura ~5 minuti: **non
   rilanciarla per scoprire quale test è rosso**. Ogni run avvicina il `403`
   per volume del Senato, che non decade aspettando. `npm test` scrive il
   report in `tmp/test-report.json` (non versionato, sovrascritto a ogni run) e
   `npm run test:fails` ne estrae i falliti con le prime righe di errore.

   **La suite completa è un passaggio della release, non della PR.** Durante
   lo sviluppo si lanciano solo i test del codice toccato:

   ```bash
   npm run test:unit                              # deterministici, zero rete (gli stessi della CI)
   npm run test:tool -- "bill-progress|bill-text" # i test live dei soli tool toccati (regex sul nome)
   npm run test:requests                          # quante richieste ha mandato l'ultima run, per endpoint
   ```

   Il contatore (`tmp/sparql-requests.json`, scritto a fine run) conta le
   richieste HTTP **viste dagli endpoint**, tentativi compresi: è il numero da
   tenere d'occhio sul Senato, che blocca per volume totale e non per
   frequenza. Annotare qui sotto il costo della suite completa a ogni release,
   così si vede se cresce.

   | Release | Test | Camera | Senato | Durata |
   |---|---|---|---|---|
   | v0.37.0 (2026-11-04) | 397/397 | 110 | 156 | 6 min |

3. **Aggiorna la documentazione**: `LOG.md` (voce in cima, data `YYYY-MM-DD`),
   `README.md`, e le skill in `skills/` se sono cambiati comandi/tool.

4. **Commit e push** su `main`:

   ```bash
   git add -A
   git commit -m "feat(...): ..."
   git push origin main
   ```

5. **Tag annotato** e push del tag:

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z — <sintesi>"
   git push origin vX.Y.Z
   ```

6. **GitHub Release** con note:

   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z — <titolo>" --notes "..."
   ```

7. **Pubblicazione su npm** (CLI + MCP installabili globalmente):

   ```bash
   npm whoami                      # deve essere loggato (aborruso); altrimenti: npm login
   npm publish --access public     # scoped package → serve --access public
   ```

   **Il publish va lanciato dal terminale dell'utente, non dall'agente.** Dal
   2026 npm chiede la 2FA (chiave di sicurezza nel browser) a ogni `npm publish`:
   il CLI stampa un link da aprire e lo mostra solo nel terminale in cui gira. Se
   `npm whoami` dà `401`, prima `npm login` (anch'esso interattivo).

   **Un `409 Cannot publish over previously staged version "X.Y.Z"` non è un
   fallimento.** Visto in v0.37.0 (2026-11-04): un primo tentativo fermo
   all'`EOTP`, poi il publish dal terminale dell'utente ha risposto 409, e un
   minuto dopo il registry aveva la versione (`time.modified` successivo al
   409), con la scheda **Staged Packages** su npmjs.com vuota. È un ritardo di
   lettura dopo scrittura del registry, non una versione staged da approvare.
   Prima di rilanciare o di bumpare la versione, controllare senza cache:

   ```bash
   curl -s "https://registry.npmjs.org/@aborruso%2Fitalianparliament-mcp" | jq '{latest: .["dist-tags"].latest, has: (.versions | has("X.Y.Z")), modified: .time.modified}'
   ```

   Se la versione c'è, proseguire. Se non c'è e `npm stage list` la mostra,
   `npm stage approve <stage-id>` (chiede la 2FA).

   `prepublishOnly` (in `package.json`) ricostruisce `dist/` prima della
   pubblicazione. Il campo `files` include `dist`, `README.md`, `LICENSE`
   (così `dist/`, pur gitignored, finisce nel tarball). Verifica del contenuto
   prima di pubblicare: `npm pack --dry-run`.

   **Aggiorna la CLI locale** (l'install globale resta alla versione vecchia
   finché non lo rifai). **Pinna la versione esatta e usa `--force`**: subito
   dopo il publish npm può servire metadati stale dalla cache, e
   `npm install -g <pkg>` senza versione reinstalla la precedente (visto con
   0.19.0 → 0.20.0).

   ```bash
   npm install -g @aborruso/italianparliament-mcp@X.Y.Z --force   # pin versione + bypass cache
   hash -r; italianparliament --version 2>/dev/null   # verifica (deve stampare X.Y.Z)
   ```

8. **Deploy del Worker** su Cloudflare:

   ```bash
   npm run deploy        # = build:worker + wrangler deploy
   ```

   Verifica del deploy:

   ```bash
   curl -s -H "Cache-Control: no-cache" \
     "https://italianparliament-mcp.andy-pr.workers.dev/?t=$(date +%s)"   # version + tools
   ```

   **Il cache-buster serve, e non basta**: subito dopo il deploy l'info endpoint
   può rispondere con la versione *precedente* — sia per la cache CDN sia perché
   la nuova versione non è ancora propagata. Visto due volte di fila (0.29.0 →
   0.30.0 e 0.30.0 → 0.30.1): `wrangler` confermava l'upload, l'endpoint dava
   ancora la vecchia, e con il cache-buster la nuova compariva dopo **~20
   secondi**. Regola: prima di sospettare il deploy, verifica che il bundle
   locale sia giusto e poi riprova dopo mezzo minuto.

   **Una sola risposta giusta non basta**: in 0.32.1 la propagazione è stata *a
   chiazze*, non a gradino — richieste consecutive alternavano nuova e vecchia
   versione per circa un minuto (1 risposta su 8 ancora alla precedente), quindi
   fermarsi al primo `X.Y.Z` che compare porta a dire "propagato" troppo presto.
   Campiona più volte finché non sono tutte uguali:

   ```bash
   for i in $(seq 1 6); do
     curl -s -H 'Cache-Control: no-cache' \
       "https://italianparliament-mcp.andy-pr.workers.dev/?t=$(date +%s%N)" \
       | jq -r '.version'
     sleep 6
   done | sort | uniq -c
   ```

   ```bash
   grep -o '"0\.[0-9]*\.[0-9]*"' dist/worker.js | sort -u   # deve essere X.Y.Z
   ```

## Note

- `dist/` è in `.gitignore` ma è incluso nel pacchetto npm via il campo `files`; per il repo gli artefatti sono ricostruiti, non versionati.
- Il comando CLI `bill-text fetch` è **solo locale** (usa `node:child_process`
  e un browser via `agent-browser`): non entra nel bundle del Worker, che
  espone solo i tool basati su SPARQL/URL.
- Convenzione versioni: pre-1.0. Bump *minor* (`0.X.0`) per nuove capacità
  utente, *patch* (`0.0.Z`) per fix.
