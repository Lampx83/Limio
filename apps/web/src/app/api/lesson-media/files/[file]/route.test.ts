import { beforeEach, describe, expect, it, vi } from "vitest";

/** GET /api/lesson-media/files/[file] — tải File đính kèm, luôn attachment + nosniff. */

const resolveKey = vi.fn();

vi.mock("@/lib/storage-serve", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/storage-serve")>();
  return { ...actual, resolveKey };
});

// 1790000000000 ms = tháng 09/2026.
const FILE = "11111111-2222-4333-8444-555555555555-1790000000000-ab12cd34ef567890";
const get = (file: string) =>
  import("./route").then(({ GET }) =>
    GET(new Request(`http://x/api/lesson-media/files/${file}`), { params: { file } }),
  );

describe("GET /api/lesson-media/files/[file]", () => {
  beforeEach(() => {
    resolveKey.mockReset().mockResolvedValue({ get: vi.fn().mockResolvedValue(Buffer.from("abc")) });
  });

  it("tên file có ../ hoặc ký tự lạ → 403, không chạm vào kho", async () => {
    for (const bad of ["../etc/passwd.pdf", "a/b.pdf", "a\\b.pdf"]) {
      expect((await get(bad)).status).toBe(403);
    }
    expect(resolveKey).not.toHaveBeenCalled();
  });

  it("đuôi ngoài danh sách → 404, kể cả có file trong kho", async () => {
    expect((await get(`${FILE}.html`)).status).toBe(404);
    expect(resolveKey).not.toHaveBeenCalled();
  });

  it("file không còn trong kho → 404", async () => {
    resolveKey.mockResolvedValue(null);
    expect((await get(`${FILE}.pdf`)).status).toBe(404);
  });

  it("tìm đúng key, trả attachment + nosniff + content-type theo đuôi", async () => {
    const res = await get(`${FILE}.xlsx`);
    expect(resolveKey).toHaveBeenCalledWith({ layer: "public", key: `lesson-media/files/2026/09/${FILE}.xlsx` });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(await res.text()).toBe("abc");
  });
});
