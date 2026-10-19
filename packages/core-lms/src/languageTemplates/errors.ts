export class LanguageTemplateError extends Error {
  constructor(
    public readonly code: "forbidden" | "validation_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}
