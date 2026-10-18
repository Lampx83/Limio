// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RemoteImageFetchError, checkRemoteImageUrl, fetchRemoteImage, isBlockedAddress } from "./safeFetchImage";

describe("isBlockedAddress: chặn mạng nội bộ", () => {
  it.each([
    "127.0.0.1", "127.8.9.10", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.5", "::ffff:7f00:1", "ff02::1", "2002:a00:1::1", "không-phải-ip",
  ])("chặn %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "203.0.114.5", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("cho %s", (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe("checkRemoteImageUrl: hình thức địa chỉ", () => {
  const code = (u: string) => {
    try {
      checkRemoteImageUrl(u);
      return "ok";
    } catch (e) {
      return (e as RemoteImageFetchError).code;
    }
  };
  it("chỉ nhận http/https, cổng 80/443, không có tài khoản trong URL", () => {
    expect(code("https://upload.wikimedia.org/a.jpg")).toBe("ok");
    expect(code("http://example.com:80/a.png")).toBe("ok");
    expect(code("file:///etc/passwd")).toBe("invalid_url");
    expect(code("ftp://example.com/a.png")).toBe("invalid_url");
    expect(code("https://user:pass@example.com/a.png")).toBe("invalid_url");
    expect(code("http://example.com:6379/")).toBe("invalid_url");
    expect(code("không phải url")).toBe("invalid_url");
  });
});

describe("fetchRemoteImage", () => {
  const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  let server: http.Server;
  let base: string; // 127.0.0.1 viết thẳng: localhost phân giải ra cả ::1, mà test chỉ mở riêng 127.0.0.1
  let named: string; // qua tên miền, để thử đường kiểm lúc phân giải DNS
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/a.png") return res.writeHead(200, { "content-type": "image/png" }).end(PNG);
      if (req.url === "/page") return res.writeHead(200, { "content-type": "text/html" }).end("<html></html>");
      if (req.url === "/big") {
        res.writeHead(200, { "content-type": "image/jpeg" });
        return res.end(Buffer.alloc(3000));
      }
      if (req.url === "/to-a") return res.writeHead(302, { location: "/a.png" }).end();
      if (req.url === "/to-meta") return res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" }).end();
      if (req.url === "/loop") return res.writeHead(302, { location: "/loop" }).end();
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;
    named = `http://localhost:${port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  // Máy chủ thử chạy ở 127.0.0.1: cho riêng địa chỉ đó, mọi thứ khác theo luật thật.
  const testing = { isBlocked: (ip: string) => ip !== "127.0.0.1" && isBlockedAddress(ip), anyPort: true as const };
  const codeOf = (p: Promise<unknown>) => p.then(() => "ok", (e: RemoteImageFetchError) => e.code);

  it("theo luật thật: tên miền trỏ về localhost bị chặn trước khi gửi request", async () => {
    let hit = false;
    server.once("request", () => (hit = true));
    expect(await codeOf(fetchRemoteImage(`${named}/a.png`, { testing: { isBlocked: isBlockedAddress, anyPort: true } }))).toBe("blocked_address");
    expect(await codeOf(fetchRemoteImage(`${base}/a.png`, { testing: { isBlocked: isBlockedAddress, anyPort: true } }))).toBe("blocked_address");
    expect(hit).toBe(false);
  });

  it("tải được ảnh, kể cả qua chuyển hướng", async () => {
    const r = await fetchRemoteImage(`${base}/to-a`, { testing });
    expect(r.contentType).toBe("image/png");
    expect(r.body.equals(PNG)).toBe(true);
  });

  it("chuyển hướng vào địa chỉ nội bộ bị chặn; vòng chuyển hướng bị cắt", async () => {
    expect(await codeOf(fetchRemoteImage(`${base}/to-meta`, { testing }))).toBe("blocked_address");
    expect(await codeOf(fetchRemoteImage(`${base}/loop`, { testing }))).toBe("fetch_failed");
  });

  it("trang web không phải ảnh, ảnh quá lớn, địa chỉ không tồn tại", async () => {
    expect(await codeOf(fetchRemoteImage(`${base}/page`, { testing }))).toBe("not_image");
    expect(await codeOf(fetchRemoteImage(`${base}/big`, { testing, maxBytes: 1000 }))).toBe("too_large");
    expect(await codeOf(fetchRemoteImage(`${base}/missing`, { testing }))).toBe("fetch_failed");
  });
});
