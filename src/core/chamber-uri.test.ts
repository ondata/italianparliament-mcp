import { describe, it, expect } from "vitest";
import { chamberFromUri } from "./chamber-uri.js";

describe("chamberFromUri", () => {
  it("riconosce gli URI reali dei due grafi", () => {
    expect(chamberFromUri("http://dati.camera.it/ocd/attocamera.rdf/ac19_302")).toBe("camera");
    expect(chamberFromUri("http://dati.senato.it/ddl/60214")).toBe("senato");
    expect(chamberFromUri("https://dati.senato.it/ddl/60214")).toBe("senato");
  });

  it("non si fa ingannare da host che contengono il dominio senza esserlo", () => {
    // Il match per sottostringa li accetterebbe tutti, instradandoli verso un
    // endpoint che non li conosce: il vuoto che ne segue si legge come
    // "l'atto non esiste" invece che "l'URI non è di questo grafo".
    expect(chamberFromUri("https://dati.camera.it.example.org/ocd/attocamera.rdf/ac19_302")).toBeUndefined();
    expect(chamberFromUri("https://example.org/x?ref=http://dati.senato.it/ddl/123")).toBeUndefined();
    expect(chamberFromUri("https://example.org/dati.camera.it/ac19_302")).toBeUndefined();
    expect(chamberFromUri("https://dati.senato.it@example.org/ddl/1")).toBeUndefined();
  });

  it("undefined su input assente o non-URL", () => {
    expect(chamberFromUri(undefined)).toBeUndefined();
    expect(chamberFromUri("")).toBeUndefined();
    expect(chamberFromUri("dati.senato.it/ddl/1")).toBeUndefined();
  });
});
