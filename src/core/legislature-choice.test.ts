import { describe, it, expect } from "vitest";
import { formatLegislatureList } from "./legislature-choice.js";

describe("formatLegislatureList", () => {
  it("due legislature", () => {
    expect(formatLegislatureList([18, 19])).toBe("18 e 19");
  });

  it("più di due: virgole e una sola congiunzione", () => {
    // Un intervallo di date aperto può coprirne parecchie: un messaggio che ne
    // desse per scontate due sarebbe scorretto proprio nel caso più ampio.
    expect(formatLegislatureList([13, 15, 16, 19])).toBe("13, 15, 16 e 19");
  });

  it("una sola resta nuda", () => {
    expect(formatLegislatureList([18])).toBe("18");
  });
});
