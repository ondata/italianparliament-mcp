import { describe, it, expect } from "vitest";
import { parseTextList } from "./fetch-text.js";

describe("parseTextList", () => {
  it("extracts label + PDF url from the Senato 'Testi disponibili' list", () => {
    const html = `
      <h2>Testi disponibili</h2>
      <ol class="schede">
        <li>
          <span>Testo DDL</span>
          <a title="Testo DDL 596" href="/show-doc?id=1393983">596</a>
          <span class="annotazione">(<a href="//www.senato.it/service/PDF/PDFServer/BGT/01393983.pdf">PDF</a>)</span>
        </li>
        <li>
          <span>Relazione</span>
          <span class="annotazione">(<a href="//www.senato.it/service/PDF/PDFServer/BGT/01507594.pdf">PDF</a>)</span>
        </li>
      </ol>`;
    const docs = parseTextList(html);
    expect(docs).toEqual([
      { label: "Testo DDL", url: "https://www.senato.it/service/PDF/PDFServer/BGT/01393983.pdf" },
      { label: "Relazione", url: "https://www.senato.it/service/PDF/PDFServer/BGT/01507594.pdf" },
    ]);
  });

  it("returns an empty array when there are no PDF links", () => {
    expect(parseTextList("<ol class='schede'><li><span>Testo</span></li></ol>")).toEqual([]);
  });
});
