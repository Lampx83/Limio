import { describe, expect, it } from "vitest";
import { signGrowthRequest, signMessage, verifyGrowthRequest } from "./signature";

// Test vector cố định — bản C# của SIM phải ra đúng chuỗi này.
const SECRET = "0123456789abcdef0123456789abcdef";
const TS = "1760000000";
const PATH = "/api/internal/growth/events";
const VECTOR_SIG = "33a0b1d85ebfbf001f1df0a199546c805e2c82e3bf9ec6f7eb1e311c8061eb57";

describe("signGrowthRequest", () => {
  it("khớp test vector cố định", () => {
    expect(signMessage({ timestamp: TS, method: "GET", pathname: PATH, rawQuery: "limit=2" })).toBe(
      "1760000000\nGET\n/api/internal/growth/events\nlimit=2",
    );
    expect(
      signGrowthRequest({ secret: SECRET, timestamp: TS, method: "GET", pathname: PATH, rawQuery: "limit=2" }),
    ).toBe(VECTOR_SIG);
  });

  it("method được chuẩn hoá chữ hoa; query rỗng vẫn có dòng cuối rỗng", () => {
    const a = signGrowthRequest({ secret: SECRET, timestamp: TS, method: "get", pathname: PATH, rawQuery: "" });
    const b = signGrowthRequest({ secret: SECRET, timestamp: TS, method: "GET", pathname: PATH, rawQuery: "" });
    expect(a).toBe(b);
    expect(a).toBe("c3d328e662853f0787bfcaedcfd699d4ac455d2fe23e137d2d0b15acd1955f2a");
  });
});

describe("verifyGrowthRequest", () => {
  const base = {
    secret: SECRET,
    timestampHeader: TS,
    signatureHeader: VECTOR_SIG,
    method: "GET",
    pathname: PATH,
    rawQuery: "limit=2",
    nowSec: 1760000000,
  };

  it("chấp nhận chữ ký đúng", () => {
    expect(verifyGrowthRequest(base)).toEqual({ ok: true });
  });

  it("chấp nhận trong ±300s, từ chối ngoài khoảng đó", () => {
    expect(verifyGrowthRequest({ ...base, nowSec: 1760000300 }).ok).toBe(true);
    expect(verifyGrowthRequest({ ...base, nowSec: 1759999700 }).ok).toBe(true);
    expect(verifyGrowthRequest({ ...base, nowSec: 1760000301 })).toEqual({ ok: false, reason: "expired" });
    expect(verifyGrowthRequest({ ...base, nowSec: 1759999699 })).toEqual({ ok: false, reason: "expired" });
  });

  it("từ chối khi query / path / method bị sửa", () => {
    expect(verifyGrowthRequest({ ...base, rawQuery: "limit=3" })).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(verifyGrowthRequest({ ...base, pathname: "/api/internal/growth/other" }).ok).toBe(false);
    expect(verifyGrowthRequest({ ...base, method: "POST" }).ok).toBe(false);
  });

  it("từ chối khi timestamp trong header khác timestamp đã ký", () => {
    expect(verifyGrowthRequest({ ...base, timestampHeader: "1760000001" }).ok).toBe(false);
  });

  it("từ chối khi sai secret", () => {
    expect(
      verifyGrowthRequest({ ...base, secret: "ffffffffffffffffffffffffffffffff" }),
    ).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("từ chối header thiếu / sai định dạng", () => {
    expect(verifyGrowthRequest({ ...base, timestampHeader: null })).toEqual({ ok: false, reason: "missing_headers" });
    expect(verifyGrowthRequest({ ...base, signatureHeader: "" })).toEqual({ ok: false, reason: "missing_headers" });
    expect(verifyGrowthRequest({ ...base, timestampHeader: "17600x0000" })).toEqual({ ok: false, reason: "bad_timestamp" });
    expect(verifyGrowthRequest({ ...base, timestampHeader: "-1" })).toEqual({ ok: false, reason: "bad_timestamp" });
    // hex hoa không được nhận (hợp đồng: lowercase hex)
    expect(verifyGrowthRequest({ ...base, signatureHeader: VECTOR_SIG.toUpperCase() })).toEqual({
      ok: false,
      reason: "bad_signature_format",
    });
    expect(verifyGrowthRequest({ ...base, signatureHeader: VECTOR_SIG.slice(0, 62) }).ok).toBe(false);
    expect(verifyGrowthRequest({ ...base, signatureHeader: "zz".repeat(32) }).ok).toBe(false);
  });
});
