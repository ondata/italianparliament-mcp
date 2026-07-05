// Shim di tipi per il subpath `cheerio/slim` (usato in camera-amendments per
// evitare che cheerio "full" trascini encoding-sniffer→require("buffer") nel
// bundle). esbuild risolve il subpath a runtime; tsc, con la moduleResolution
// attuale, non risolve gli export condizionali del package → qui gli diamo gli
// stessi tipi di "cheerio".
declare module "cheerio/slim" {
  export * from "cheerio";
}
