import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

function safeDecrypt(s: string): string | undefined {
  try { return decrypt(s); } catch { return undefined; }
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "system_admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });

  const fromDb = db
    .prepare("SELECT value FROM system_settings WHERE key = ?")
    .get("openai_api_key") as { value: string } | undefined;
  const apiKey = fromDb?.value ? safeDecrypt(fromDb.value) : process.env.OPENAI_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "Chưa có API key" }, { status: 400 });

  const modelSetting = db
    .prepare("SELECT value FROM system_settings WHERE key = ?")
    .get("openai_model") as { value: string } | undefined;
  const model = modelSetting?.value ?? "gpt-4o-mini";

  try {
    const client = new OpenAI({ apiKey });
    const r = await client.chat.completions.create({
      model,
      max_tokens: 10,
      messages: [{ role: "user", content: "Reply with just the word: OK" }],
    });
    const text = r.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({
      ok: true,
      message: `OpenAI trả lời: "${text}" (model ${model})`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
