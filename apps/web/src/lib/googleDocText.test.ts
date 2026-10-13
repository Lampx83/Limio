import { describe, expect, it } from "vitest";
import { fetchGoogleDocText, googleDocExportUrl } from "./googleDocText";

const DOC = "1LhcaCrqNK3v5Ox1_gDs6fwiOkEuuEHHxwGB7AQE4BmU";

describe("googleDocExportUrl", () => {
  it("dựng URL tải từ ID cho Docs/Sheets/Slides, kể cả link /u/0/ và link có gid", () => {
    expect(googleDocExportUrl(`https://docs.google.com/document/d/${DOC}/edit?usp=sharing`)).toEqual({
      kind: "document",
      exportUrl: `https://docs.google.com/document/d/${DOC}/export?format=txt`,
    });
    expect(googleDocExportUrl(`https://docs.google.com/document/u/0/d/${DOC}/edit`)?.exportUrl).toBe(
      `https://docs.google.com/document/d/${DOC}/export?format=txt`,
    );
    expect(googleDocExportUrl(`https://docs.google.com/spreadsheets/d/${DOC}/edit#gid=42`)?.exportUrl).toBe(
      `https://docs.google.com/spreadsheets/d/${DOC}/export?format=csv&gid=42`,
    );
    expect(googleDocExportUrl(`https://docs.google.com/presentation/d/${DOC}/edit`)?.exportUrl).toBe(
      `https://docs.google.com/presentation/d/${DOC}/export/txt`,
    );
  });

  it("không nhận host khác, http, Drive file, hay ID lạ", () => {
    expect(googleDocExportUrl(`https://evil.com/document/d/${DOC}/edit`)).toBeNull();
    expect(googleDocExportUrl(`http://docs.google.com/document/d/${DOC}/edit`)).toBeNull();
    expect(googleDocExportUrl(`https://drive.google.com/file/d/${DOC}/view`)).toBeNull();
    expect(googleDocExportUrl(`https://docs.google.com/document/d/../../x/edit`)).toBeNull();
    expect(googleDocExportUrl(`https://docs.google.com/forms/d/${DOC}/edit`)).toBeNull();
    expect(googleDocExportUrl("/api/assignment-media/a.webm")).toBeNull();
  });
});

type Step = { status: number; location?: string; type?: string; body?: string };

/** fetch giả chạy theo kịch bản từng bước; ghi lại URL đã gọi. */
function scripted(steps: Step[]) {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(url);
    const s = steps[urls.length - 1];
    if (!s) throw new Error("unexpected fetch");
    const headers = new Headers();
    if (s.location) headers.set("location", s.location);
    if (s.type) headers.set("content-type", s.type);
    return new Response(s.status >= 300 && s.status < 400 ? null : (s.body ?? ""), { status: s.status, headers });
  }) as unknown as typeof fetch;
  return { impl, urls };
}

const link = `https://docs.google.com/document/d/${DOC}/edit`;

describe("fetchGoogleDocText", () => {
  it("tài liệu công khai: 307 sang googleusercontent rồi 200 text/plain → lấy chữ", async () => {
    const f = scripted([
      { status: 307, location: `https://doc-08-44-docstext.googleusercontent.com/export/abc/${DOC}?format=txt` },
      { status: 200, type: "text/plain; charset=utf-8", body: "﻿Bài luận của em.\n" },
    ]);
    const r = await fetchGoogleDocText(link, { fetchImpl: f.impl });
    expect(r).toEqual({ ok: true, kind: "document", text: "Bài luận của em.", truncated: false });
    expect(f.urls[0]).toBe(`https://docs.google.com/document/d/${DOC}/export?format=txt`);
  });

  it("tài liệu riêng tư: chuyển tới trang đăng nhập → not_accessible, không đi theo", async () => {
    const f = scripted([{ status: 302, location: "https://accounts.google.com/ServiceLogin?continue=x" }]);
    expect(await fetchGoogleDocText(link, { fetchImpl: f.impl })).toEqual({ ok: false, reason: "not_accessible" });
    expect(f.urls).toHaveLength(1);
  });

  it("chuyển hướng tới host ngoài Google bị chặn", async () => {
    const f = scripted([{ status: 302, location: "http://169.254.169.254/latest/meta-data" }]);
    expect(await fetchGoogleDocText(link, { fetchImpl: f.impl })).toEqual({ ok: false, reason: "not_accessible" });
    expect(f.urls).toHaveLength(1);
  });

  it("200 nhưng là trang HTML (màn xin quyền) → not_accessible; 404/401 → not_accessible", async () => {
    expect(
      await fetchGoogleDocText(link, { fetchImpl: scripted([{ status: 200, type: "text/html", body: "<html>" }]).impl }),
    ).toEqual({ ok: false, reason: "not_accessible" });
    expect(await fetchGoogleDocText(link, { fetchImpl: scripted([{ status: 404, type: "text/html" }]).impl })).toEqual({
      ok: false,
      reason: "not_accessible",
    });
    expect(await fetchGoogleDocText(link, { fetchImpl: scripted([{ status: 401 }]).impl })).toEqual({
      ok: false,
      reason: "not_accessible",
    });
  });

  it("Google lỗi 5xx hoặc mạng hỏng → fetch_failed; tài liệu trống → empty", async () => {
    expect(await fetchGoogleDocText(link, { fetchImpl: scripted([{ status: 503 }]).impl })).toEqual({
      ok: false,
      reason: "fetch_failed",
    });
    expect(await fetchGoogleDocText(link, { fetchImpl: scripted([]).impl })).toEqual({ ok: false, reason: "fetch_failed" });
    expect(
      await fetchGoogleDocText(link, { fetchImpl: scripted([{ status: 200, type: "text/plain", body: "  \n" }]).impl }),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("tài liệu quá dài: chỉ đọc tới maxBytes và báo truncated", async () => {
    const f = scripted([{ status: 200, type: "text/plain", body: "x".repeat(5000) }]);
    const r = await fetchGoogleDocText(link, { fetchImpl: f.impl, maxBytes: 1000 });
    expect(r).toMatchObject({ ok: true, truncated: true });
    if (r.ok) expect(r.text.length).toBe(1000);
  });

  it("link không phải Google Docs → not_google, không gọi mạng", async () => {
    const f = scripted([]);
    expect(await fetchGoogleDocText("/api/assignment-media/a.png", { fetchImpl: f.impl })).toEqual({
      ok: false,
      reason: "not_google",
    });
    expect(f.urls).toHaveLength(0);
  });
});
