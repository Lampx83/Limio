// Mirror of packages/core-lms/src/types/pdf-parse-lib.d.ts — needed here too
// because this package's tsconfig type-checks a core-lms test file
// (__tests__/lessonAsTag.e2e.test.ts) that imports @feedbackme/core-lms,
// pulling its .ts source (incl. oral-material-extract.ts) into this program.
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
