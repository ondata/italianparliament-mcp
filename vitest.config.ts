import { defineConfig } from "vitest/config";

/**
 * Un solo processo per l'intera suite, moduli condivisi tra i file.
 *
 * Il throttle dell'endpoint Senato (`src/core/client.ts`) è stato di modulo:
 * una catena che tiene almeno 2s tra due richieste. Con i default di vitest
 * (pool `forks`, `fileParallelism: true`) ogni worker importa la propria copia
 * del modulo, quindi ogni file di test ha la SUA catena: due file che
 * interrogano il Senato in parallelo fanno due richieste ogni 2s invece di una,
 * e il throttle non protegge più nulla. È così che `npm test` ha già fatto
 * scattare il 403 per frequenza.
 *
 * `singleFork` da solo non basta: con `isolate: true` (default) vitest ricarica
 * i moduli a ogni file e il contatore riparte da zero. Serve la coppia. Effetto
 * collaterale desiderabile: anche le cache in-process (freschezza, legislature)
 * si condividono, quindi meno query ripetute.
 *
 * Costo: la suite gira in sequenza. Accettabile, perché la parte lenta
 * (`tools.test.ts`) era già serializzata dal throttle.
 */
export default defineConfig({
  test: {
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
  },
});
