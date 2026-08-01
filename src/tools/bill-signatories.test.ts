import { describe, it, expect } from "vitest";
import { cameraPhasePattern, parseCameraActUri } from "./bill-signatories.js";

describe("parseCameraActUri", () => {
  it("estrae legislatura e numero dall'URI dell'atto Camera", () => {
    expect(
      parseCameraActUri("http://dati.camera.it/ocd/attocamera.rdf/ac19_2500"),
    ).toEqual({ legislature: 19, number: "2500" });
  });

  it("regge le legislature passate", () => {
    expect(
      parseCameraActUri("http://dati.camera.it/ocd/attocamera.rdf/ac18_2402"),
    ).toEqual({ legislature: 18, number: "2402" });
  });

  it("conserva il suffisso di lettura successiva, che è col trattino", () => {
    // Forma verificata sul grafo Camera: ac19_976-B, non ac19_976B.
    expect(
      parseCameraActUri("http://dati.camera.it/ocd/attocamera.rdf/ac19_976-B"),
    ).toEqual({ legislature: 19, number: "976-B" });
  });

  it("su un URI Senato non inventa nulla", () => {
    expect(parseCameraActUri("http://dati.senato.it/ddl/59059")).toBeUndefined();
  });
});

describe("cameraPhasePattern", () => {
  it("un numero semplice accetta anche le letture successive", () => {
    // Le fasi dello stesso DDL condividono osr:idDdl: partire da 2500 o da
    // 2500-B deve portare allo stesso identificativo.
    expect(cameraPhasePattern("2500")).toBe("2500(-[A-Z])?");
  });

  it("da una lettura successiva risale al numero base", () => {
    expect(cameraPhasePattern("976-B")).toBe("976(-[A-Z])?");
  });
});
