import { describe, expect, it } from "vitest";
import { showcaseEmbed, showcaseThumbnail } from "./showcaseEmbed";

describe("showcaseEmbed", () => {
  it("YouTube dựng lại từ ID", () => {
    expect(showcaseEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(showcaseEmbed("https://youtu.be/dQw4w9WgXcQ")?.shape).toBe("video");
  });

  it("Google Slides nhúng 16:9, Docs nhúng dạng cuộn dọc, cả hai nhắc quyền chia sẻ", () => {
    const slides = showcaseEmbed("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit?usp=sharing");
    expect(slides).toMatchObject({ shape: "video", needsSharing: true });
    expect(slides?.src).toBe("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/embed");
    expect(showcaseEmbed("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit")?.shape).toBe("tall");
  });

  it("Canva link xem được nhúng với ?embed", () => {
    expect(showcaseEmbed("https://www.canva.com/design/DAFabc12345/xYz_987654/view?utm_content=x")?.src).toBe(
      "https://www.canva.com/design/DAFabc12345/xYz_987654/view?embed",
    );
    // Link /edit là trang soạn, không nhúng.
    expect(showcaseEmbed("https://www.canva.com/design/DAFabc12345/xYz_987654/edit")).toBeNull();
  });

  it("Figma bọc qua trang embed của Figma", () => {
    const e = showcaseEmbed("https://www.figma.com/design/AbC123/Ten-file?node-id=1-2");
    expect(e?.src.startsWith("https://www.figma.com/embed?embed_host=share&url=")).toBe(true);
    expect(decodeURIComponent(e!.src)).toContain("https://www.figma.com/design/AbC123/Ten-file?node-id=1-2");
  });

  it("GitHub, trang lạ, link hỏng hoặc rỗng không nhúng", () => {
    expect(showcaseEmbed("https://github.com/team/project")).toBeNull();
    expect(showcaseEmbed("https://evil.example/youtube.com/embed/x")).toBeNull();
    expect(showcaseEmbed("not a url")).toBeNull();
    expect(showcaseEmbed(undefined)).toBeNull();
    expect(showcaseEmbed("javascript:alert(1)")).toBeNull();
  });
});

describe("showcaseThumbnail", () => {
  it("YouTube và file Drive có ảnh bìa, link khác thì không", () => {
    expect(showcaseThumbnail("https://youtu.be/dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(showcaseThumbnail("https://drive.google.com/file/d/1oeN15jcfKCOoNabcdef/view?usp=drivesdk")).toBe(
      "https://drive.google.com/thumbnail?id=1oeN15jcfKCOoNabcdef&sz=w640",
    );
    expect(showcaseThumbnail("https://github.com/a/b")).toBeNull();
    expect(showcaseThumbnail("rác")).toBeNull();
  });
});
