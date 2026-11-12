import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { absoluteUrl } from "@/lib/seo";
import type { SpaceConfig } from "./types";

/**
 * Ảnh xem trước khi dán link của space vào Zalo/Facebook/Slack (1200×630): logo trường + đối tác, màu của space.
 * Font Inter nhúng sẵn trong public/brand/fonts; ảnh logo đọc từ public (nếu là đường dẫn trong site) hoặc tải qua https.
 */
async function pub(rel: string): Promise<Buffer> {
  // Standalone chạy với cwd khác nhau tuỳ cách khởi động — thử cả hai.
  for (const base of [process.cwd(), path.join(process.cwd(), "apps/web")]) {
    try {
      return await readFile(path.join(base, "public", rel));
    } catch {}
  }
  throw new Error(`missing public/${rel}`);
}

const MIME: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

async function imageDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  const ext = (url.split("?")[0]!.split(".").pop() ?? "").toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;
  try {
    let buf: Buffer;
    if (url.startsWith("/")) {
      try {
        buf = await pub(url.replace(/^\//, ""));
      } catch {
        const r = await fetch(absoluteUrl(url), { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return null;
        buf = Buffer.from(await r.arrayBuffer());
      }
    } else {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      buf = Buffer.from(await r.arrayBuffer());
    }
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderSpaceOg(cfg: SpaceConfig): Promise<ImageResponse> {
  const [logo, partner, visual, f400, f600] = await Promise.all([
    imageDataUri(cfg.logoUrl),
    imageDataUri(cfg.partnerLogoUrl),
    imageDataUri(cfg.heroVisualUrl),
    pub("brand/fonts/inter-400.woff"),
    pub("brand/fonts/inter-600.woff"),
  ]);
  const { primary, accent, soft } = cfg.palette;
  const c = cfg.copy[cfg.defaultLang];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: "Inter" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 150,
            background: "#FFFFFF",
            padding: "0 64px",
            borderBottom: `6px solid ${accent}`,
          }}
        >
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} height={80} style={{ height: 80, width: "auto", maxWidth: 520 }} alt="" />
          )}
          {logo && partner && <div style={{ width: 2, height: 80, background: "#B2B2B2", margin: "0 40px", display: "flex" }} />}
          {partner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner} height={112} style={{ height: 112, width: "auto", maxWidth: 260 }} alt="" />
          )}
          {!logo && !partner && <div style={{ display: "flex", fontSize: 54, fontWeight: 600, color: primary }}>{cfg.name}</div>}
        </div>
        <div style={{ display: "flex", flex: 1, background: primary, color: "#FFFFFF", padding: "0 64px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: visual ? 40 : 0 }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 3, color: soft }}>
              {`${cfg.name} × ${cfg.titleSuffix}`.toUpperCase()}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", marginTop: 18, fontSize: 58, fontWeight: 600, lineHeight: 1.1 }}>
              <span style={{ marginRight: 16 }}>{c.heroLead}</span>
              <span style={{ color: accent }}>{c.heroAccent}</span>
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: soft }}>{cfg.logoAlt}</div>
          </div>
          {visual && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={visual} width={300} height={300} alt="" />
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: f400, weight: 400, style: "normal" },
        { name: "Inter", data: f600, weight: 600, style: "normal" },
      ],
    },
  );
}
