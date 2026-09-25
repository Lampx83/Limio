import { describe, expect, it } from "vitest";
import { formatHtml } from "./formatHtml";

describe("formatHtml", () => {
  it("dàn khối lồng nhau, giữ li/p gọn một dòng", () => {
    const src = `<div class="box"><h3>Mục tiêu</h3><p>Học xong, bạn có <strong>thể</strong>:</p><ul><li>Một</li><li>Hai <a href="x">link</a></li></ul></div>`;
    expect(formatHtml(src)).toBe(
      [
        `<div class="box">`,
        `  <h3>Mục tiêu</h3>`,
        `  <p>Học xong, bạn có <strong>thể</strong>:</p>`,
        `  <ul>`,
        `    <li>Một</li>`,
        `    <li>Hai <a href="x">link</a></li>`,
        `  </ul>`,
        `</div>`,
        ``,
      ].join("\n"),
    );
  });

  it("giữ nguyên ruột <pre> và <style>", () => {
    const src = `<style>a{color:red}\n b{}</style><pre>  x\n   y</pre>`;
    expect(formatHtml(src)).toBe(`<style>a{color:red}\n b{}</style>\n<pre>  x\n   y</pre>\n`);
  });

  it("HTML lỗi thì trả lại nguyên gốc", () => {
    expect(formatHtml("<div><span>x")).toBe("<div><span>x");
    expect(formatHtml("</b>")).toBe("</b>");
  });

  it("idempotent", () => {
    const once = formatHtml(`<section><p>a</p><div><p>b</p></div></section>`);
    expect(formatHtml(once)).toBe(once);
  });
});
