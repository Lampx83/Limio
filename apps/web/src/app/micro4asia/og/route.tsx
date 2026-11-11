import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Ảnh xem trước khi dán link /micro4asia vào Zalo/Facebook/Slack: nhận diện NEU + Micro4Asia
 * (thay ảnh Limio mặc định). 1200×630, dựng bằng satori; font Inter nhúng sẵn trong public.
 */
export const dynamic = "force-static";

async function pub(rel: string): Promise<Buffer> {
  // Standalone chạy với cwd khác nhau tuỳ cách khởi động — thử cả hai.
  for (const base of [process.cwd(), path.join(process.cwd(), "apps/web")]) {
    try {
      return await readFile(path.join(base, "public", rel));
    } catch {}
  }
  throw new Error(`missing public/${rel}`);
}

const dataUri = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString("base64")}`;

export async function GET() {
  const [neu, m4a, kv, f400, f600] = await Promise.all([
    pub("brand/neu/neu-logo-ngang.svg"),
    pub("brand/micro4asia/logo.png"),
    pub("brand/neu/kv-dark/00-nguyen-khung.svg"),
    pub("brand/fonts/inter-400.woff"),
    pub("brand/fonts/inter-600.woff"),
  ]);

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
            borderBottom: "6px solid #FFC101",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri("image/svg+xml", neu)} height={80} width={423} alt="" />
          <div style={{ width: 2, height: 80, background: "#B2B2B2", margin: "0 40px", display: "flex" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri("image/png", m4a)} height={112} width={78} alt="" />
        </div>
        <div style={{ display: "flex", flex: 1, background: "#00528C", color: "#FFFFFF", padding: "0 64px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 40 }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 3, color: "#D6EEFB" }}>
              MICRO4ASIA × NEU
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 62, fontWeight: 600, lineHeight: 1.08 }}>
              <span>Six micro-credentials</span>
              <span>
                for <span style={{ color: "#FFC101", marginLeft: 14 }}>data and AI skills</span>
              </span>
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: "#D6EEFB" }}>
              School of Technology, National Economics University
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri("image/svg+xml", kv)} width={300} height={300} alt="" />
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
