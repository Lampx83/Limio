import { describe, expect, it } from "vitest";
import { extractMaterialText } from "../oral-material-extract";

describe("extractMaterialText (A6.1)", () => {
  it("returns trimmed text for text/plain", async () => {
    const text = await extractMaterialText(Buffer.from("  hello world  \n"), "text/plain");
    expect(text).toBe("hello world");
  });

  it("returns trimmed text for text/markdown", async () => {
    const text = await extractMaterialText(Buffer.from("# Đề cương\n\nNội dung"), "text/markdown");
    expect(text).toBe("# Đề cương\n\nNội dung");
  });

  it("returns null for an empty text file", async () => {
    const text = await extractMaterialText(Buffer.from("   \n  "), "text/plain");
    expect(text).toBeNull();
  });

  it("returns null for an unsupported mime type", async () => {
    const text = await extractMaterialText(Buffer.from("data"), "application/zip");
    expect(text).toBeNull();
  });

  it("returns null (not throw) for a corrupt pdf buffer", async () => {
    const text = await extractMaterialText(Buffer.from("not a real pdf"), "application/pdf");
    expect(text).toBeNull();
  });

  it("returns null (not throw) for a corrupt docx buffer", async () => {
    const text = await extractMaterialText(
      Buffer.from("not a real docx"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(text).toBeNull();
  });
});
