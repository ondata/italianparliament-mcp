import { describe, it, expect } from "vitest";
import {
  aknAttoPath,
  aknRawUrl,
  aknEmendRawUrlFromTestoXml,
  parseAknAmendment,
  mapLimit,
} from "./akn.js";

describe("aknAttoPath", () => {
  it("costruisce il path Leg/Atto zero-padded a 8 cifre", () => {
    expect(aknAttoPath("http://dati.senato.it/ddl/60233", 19)).toBe(
      "Leg19/Atto00060233",
    );
    expect(aknAttoPath("http://dati.senato.it/ddl/52873", "18")).toBe(
      "Leg18/Atto00052873",
    );
  });

  it("rifiuta URI non-ddl", () => {
    expect(() => aknAttoPath("http://dati.senato.it/senatore/32", 19)).toThrow(
      /non riconosciuto/,
    );
  });
});

describe("aknRawUrl", () => {
  it("costruisce l'URL raw.githubusercontent", () => {
    expect(aknRawUrl("Leg19/Atto00060233/emend/01511393-em.akn.xml")).toBe(
      "https://raw.githubusercontent.com/SenatoDellaRepubblica/AkomaNtosoBulkData/master/Leg19/Atto00060233/emend/01511393-em.akn.xml",
    );
  });
});

describe("aknEmendRawUrlFromTestoXml", () => {
  // Caso verificato nel wiki (senato/akn-bulk-data.md): emendamento 900011 del
  // ddl/53429 leg.18 → Leg18/Atto00053429/emend/01181876-em.akn.xml
  it("converte l'URL WAF-ato del LOD in URL raw del bulk", () => {
    expect(
      aknEmendRawUrlFromTestoXml(
        "https://www.senato.it/leg/18/BGT/Testi/Emend/01186716/01181876.akn",
        "http://dati.senato.it/ddl/53429",
        "18",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/SenatoDellaRepubblica/AkomaNtosoBulkData/master/Leg18/Atto00053429/emend/01181876-em.akn.xml",
    );
  });

  it("usa emendc/ per gli emendamenti di commissione", () => {
    expect(
      aknEmendRawUrlFromTestoXml(
        "https://www.senato.it/leg/19/BGT/Testi/Emend/01511401/01511402.akn",
        "http://dati.senato.it/ddl/60233",
        "19",
        true,
      ),
    ).toContain("/emendc/01511402-em.akn.xml");
  });

  it("ritorna vuoto su input non nel formato atteso", () => {
    expect(
      aknEmendRawUrlFromTestoXml("https://esempio.it/x.pdf", "http://dati.senato.it/ddl/1", "19"),
    ).toBe("");
    expect(
      aknEmendRawUrlFromTestoXml(
        "https://www.senato.it/leg/19/BGT/Testi/Emend/01/02.akn",
        "http://dati.senato.it/ddl/1",
        "",
      ),
    ).toBe("");
  });
});

describe("parseAknAmendment", () => {
  // Estratto reale da Leg19/Atto00060233/emend/01511393-em.akn.xml (Piano Casa).
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<an:akomaNtoso xmlns:an="http://docs.oasis-open.org/legaldocml/ns/akn/3.0/CSD03">
  <an:amendment contains="originalVersion">
    <an:meta>
      <an:FRBRWork>
        <an:FRBRdate date="2026-07-01" name="presentazione"/>
        <an:FRBRnumber value="QP1"/>
        <an:FRBRname value="Questione pregiudiziale"/>
      </an:FRBRWork>
      <an:references source="#redattore">
        <an:TLCPerson id="IDAAA" href="http://dati.senato.it/32619" showAs="DI GIROLAMO"/>
        <an:TLCPerson id="IDBBB" href="http://dati.senato.it/36417" showAs="PIRONDINI"/>
      </an:references>
    </an:meta>
    <an:preface>
      <an:docNumber>Questione pregiudiziale n. QP1</an:docNumber>
      <an:docProponent refersTo="#IDAAA" as="#tipoSenatore">DI GIROLAMO</an:docProponent>
      <an:docProponent refersTo="#IDBBB" as="#tipoSenatore">PIRONDINI</an:docProponent>
      <an:docProponent refersTo="#IDAAA" as="#tipoSenatore">DI GIROLAMO</an:docProponent>
    </an:preface>
  </an:amendment>
</an:akomaNtoso>`;

  it("estrae numero, tipo, data e proponenti in ordine (con URI persona)", () => {
    const a = parseAknAmendment(xml);
    expect(a.number).toBe("QP1");
    expect(a.name).toBe("Questione pregiudiziale");
    expect(a.date).toBe("2026-07-01");
    expect(a.proponents).toEqual([
      { name: "DI GIROLAMO", uri: "http://dati.senato.it/32619" },
      { name: "PIRONDINI", uri: "http://dati.senato.it/36417" },
    ]);
  });

  it("estrae date e URI persona anche con ordine attributi invertito (XML non garantisce l'ordine)", () => {
    const shuffledXml = `<an:akomaNtoso xmlns:an="http://docs.oasis-open.org/legaldocml/ns/akn/3.0/CSD03">
      <an:FRBRdate name="presentazione" date="2026-07-01"/>
      <an:TLCPerson showAs="DI GIROLAMO" href="http://dati.senato.it/32619" id="IDAAA"/>
      <an:docProponent refersTo="#IDAAA" as="#tipoSenatore">DI GIROLAMO</an:docProponent>
    </an:akomaNtoso>`;
    const a = parseAknAmendment(shuffledXml);
    expect(a.date).toBe("2026-07-01");
    expect(a.proponents).toEqual([
      { name: "DI GIROLAMO", uri: "http://dati.senato.it/32619" },
    ]);
  });

  it("estrae i proponenti annidati in an:span (file di commissione) preferendo showAs", () => {
    // Nei file emendc/ il nome è dentro <an:span> e showAs ha il nome completo.
    const commXml = `<an:akomaNtoso xmlns:an="http://docs.oasis-open.org/legaldocml/ns/akn/3.0/CSD03">
      <an:FRBRnumber value="1.30"/>
      <an:TLCPerson id="ID0E5" href="http://dati.senato.it/31010" showAs="Bartolomeo Amidei"/>
      <an:docProponent refersTo="#ID0E5" as="#tipoSenatore">
        <an:span style="font-variant:small-caps;">Amidei</an:span>
      </an:docProponent>
    </an:akomaNtoso>`;
    const a = parseAknAmendment(commXml);
    expect(a.number).toBe("1.30");
    expect(a.proponents).toEqual([
      { name: "Bartolomeo Amidei", uri: "http://dati.senato.it/31010" },
    ]);
  });

  it("deduplica i proponenti ripetuti e non esplode su XML povero", () => {
    const a = parseAknAmendment(xml);
    expect(a.proponents.filter((p) => p.name === "DI GIROLAMO")).toHaveLength(1);
    const empty = parseAknAmendment("<xml/>");
    expect(empty.number).toBe("");
    expect(empty.proponents).toEqual([]);
  });
});

describe("mapLimit", () => {
  it("preserva l'ordine e rispetta la concorrenza", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("con limit<=0 processa comunque gli item invece di tornare vuoto in silenzio", async () => {
    const out = await mapLimit([1, 2, 3], 0, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30]);
    const outNeg = await mapLimit([1, 2], -5, async (n) => n * 10);
    expect(outNeg).toEqual([10, 20]);
  });
});
