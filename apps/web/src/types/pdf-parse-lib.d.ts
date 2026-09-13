// Mirror of packages/core-lms/src/types/pdf-parse-lib.d.ts — needed here too
// because apps/web typechecks core-lms's .ts source directly (no project
// references / prebuilt .d.ts boundary between the two tsconfigs).
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
