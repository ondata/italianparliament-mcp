import { describe, it, expect } from "vitest";
import { decodeHtml } from "./decode-html.js";

describe("decodeHtml", () => {
  it("decodifica entità con nome", () => {
    expect(decodeHtml("l&rsquo;assistenza")).toBe("l’assistenza");
    expect(decodeHtml("criminalit&agrave; organizzata")).toBe(
      "criminalità organizzata",
    );
  });

  it("decodifica entità numeriche decimali (&#39;)", () => {
    expect(decodeHtml("all&#39;articolo 15")).toBe("all'articolo 15");
    expect(decodeHtml("nell&#039;area")).toBe("nell'area");
  });

  it("decodifica entità numeriche esadecimali (&#x27;)", () => {
    expect(decodeHtml("dell&#x27;Unione")).toBe("dell'Unione");
  });

  it("rimuove i tag HTML dopo aver decodificato le entità", () => {
    expect(decodeHtml("articolo 13-&lt;em&gt;bis&lt;/em&gt; del")).toBe(
      "articolo 13-bis del",
    );
  });

  it("rimuove il suffisso ^^xsd:type", () => {
    expect(
      decodeHtml("testo^^http://www.w3.org/2001/XMLSchema#string"),
    ).toBe("testo");
  });

  it("lascia invariato un codepoint numerico non valido", () => {
    expect(decodeHtml("x&#0;y")).toBe("x&#0;y");
  });

  it("è idempotente su testo senza entità", () => {
    expect(decodeHtml("Modifiche al testo unico (2822)")).toBe(
      "Modifiche al testo unico (2822)",
    );
  });
});
