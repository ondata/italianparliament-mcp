export type SparqlBindingValue = {
  type: "uri" | "literal" | "typed-literal" | "bnode";
  value: string;
  "xml:lang"?: string;
  datatype?: string;
};

export type SparqlBinding = Record<string, SparqlBindingValue>;

export type SparqlResults = {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
};

export type Row = Record<string, string>;
