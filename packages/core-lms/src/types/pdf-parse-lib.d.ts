// pdf-parse@1.1.1 ships types only for the top-level "pdf-parse" entry, whose
// index.js has a debug-mode bug that crashes on dynamic ESM import (see
// oral-material-extract.ts). We import the inner lib path instead, which has
// no shipped types.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  export default function pdfParse(
    data: Buffer,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;
}
