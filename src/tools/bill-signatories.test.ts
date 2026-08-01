import { describe, it, expect } from "vitest";
import { parseCameraActUri } from "./bill-signatories.js";

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

  it("conserva il suffisso di lettura successiva (ac19_1511B)", () => {
    expect(
      parseCameraActUri("http://dati.camera.it/ocd/attocamera.rdf/ac19_1511B"),
    ).toEqual({ legislature: 19, number: "1511B" });
  });

  it("su un URI Senato non inventa nulla", () => {
    expect(parseCameraActUri("http://dati.senato.it/ddl/59059")).toBeUndefined();
  });
});
