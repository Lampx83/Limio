// Đọc clientId (định danh ẩn danh theo thiết bị, sinh ở client) từ body JSON MÀ KHÔNG tiêu thụ
// body — route vẫn đọc lại bình thường. Dùng để rate-limit theo thiết bị thay vì theo IP.
export async function peekClientId(req: Request): Promise<string | null> {
  try {
    const body = (await req.clone().json()) as { clientId?: unknown };
    const id = body?.clientId;
    return typeof id === "string" && id.length >= 8 && id.length <= 64 ? id : null;
  } catch {
    return null;
  }
}
