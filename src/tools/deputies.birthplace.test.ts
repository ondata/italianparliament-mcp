import { describe, it, expect } from "vitest";
import { parseCameraBirthPlace } from "./deputies.js";

describe("parseCameraBirthPlace", () => {
  it("slug a 3 parti = comune_provincia_regione (Italia)", () => {
    expect(parseCameraBirthPlace("catania_catania_sicilia")).toEqual({
      birth_city: "catania",
      birth_province: "catania",
      birth_country: "Italia",
      birth_region: "Sicilia",
    });
    // regione canonica identica al Senato anche per Emilia-Romagna/Friuli
    expect(parseCameraBirthPlace("cazzago-brabbia_varese_lombardia").birth_region).toBe("Lombardia");
    expect(parseCameraBirthPlace("x_y_emilia-romagna").birth_region).toBe("Emilia-Romagna");
  });

  it("slug a 2 parti con regione nota = comune_regione (Aosta/Trentino, non estero)", () => {
    expect(parseCameraBirthPlace("aosta_valle-d-aosta")).toEqual({
      birth_city: "aosta",
      birth_province: "",
      birth_country: "Italia",
      birth_region: "Valle d'Aosta/Vallée d'Aoste",
    });
    expect(parseCameraBirthPlace("bozen_trentino-alto-adige")).toEqual({
      birth_city: "bozen",
      birth_province: "",
      birth_country: "Italia",
      birth_region: "Trentino-Alto Adige/Südtirol",
    });
  });

  it("slug a 2 parti con stato estero = comune_stato (regione vuota)", () => {
    expect(parseCameraBirthPlace("lugano_svizzera")).toEqual({
      birth_city: "lugano",
      birth_province: "",
      birth_country: "svizzera",
      birth_region: "",
    });
  });

  it("slug vuoto o a 1 parte", () => {
    expect(parseCameraBirthPlace("")).toEqual({
      birth_city: "",
      birth_province: "",
      birth_country: "",
      birth_region: "",
    });
    expect(parseCameraBirthPlace("roma")).toEqual({
      birth_city: "roma",
      birth_province: "",
      birth_country: "",
      birth_region: "",
    });
  });
});
