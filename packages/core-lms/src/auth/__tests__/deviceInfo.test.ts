import { describe, expect, it } from "vitest";
import { categorizeUserAgent } from "../deviceInfo";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  ipadSafari:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  windowsFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
};

describe("categorizeUserAgent", () => {
  it("thiếu User-Agent -> unknown/unknown, không throw", () => {
    expect(categorizeUserAgent(null)).toEqual({ device: "unknown", browser: "unknown" });
    expect(categorizeUserAgent(undefined)).toEqual({ device: "unknown", browser: "unknown" });
    expect(categorizeUserAgent("")).toEqual({ device: "unknown", browser: "unknown" });
  });

  it("iPhone Safari -> mobile/Safari", () => {
    expect(categorizeUserAgent(UA.iphoneSafari)).toEqual({ device: "mobile", browser: "Safari" });
  });

  it("Android Chrome -> mobile/Chrome", () => {
    expect(categorizeUserAgent(UA.androidChrome)).toEqual({ device: "mobile", browser: "Chrome" });
  });

  it("iPad Safari -> tablet/Safari (không lẫn với mobile)", () => {
    expect(categorizeUserAgent(UA.ipadSafari)).toEqual({ device: "tablet", browser: "Safari" });
  });

  it("Mac Chrome -> desktop/Chrome, không bị UA giả Safari của Chrome đánh lừa", () => {
    expect(categorizeUserAgent(UA.macChrome)).toEqual({ device: "desktop", browser: "Chrome" });
  });

  it("Mac Safari thật -> desktop/Safari", () => {
    expect(categorizeUserAgent(UA.macSafari)).toEqual({ device: "desktop", browser: "Safari" });
  });

  it("Windows Edge -> desktop/Edge, không bị nhận nhầm thành Chrome", () => {
    expect(categorizeUserAgent(UA.windowsEdge)).toEqual({ device: "desktop", browser: "Edge" });
  });

  it("Windows Firefox -> desktop/Firefox", () => {
    expect(categorizeUserAgent(UA.windowsFirefox)).toEqual({ device: "desktop", browser: "Firefox" });
  });

  it("chuỗi rác không khớp gì -> unknown/Other, không throw", () => {
    expect(categorizeUserAgent("xyz-bot-crawler-9000")).toEqual({
      device: "unknown",
      browser: "Other",
    });
  });
});
