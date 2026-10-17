import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Tối thiểu: cho test dùng alias "@/" giống tsconfig và biên dịch JSX (tsconfig để
// jsx = "preserve" cho Next, esbuild của vitest cần "automatic" để test component).
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // next/font chỉ chạy trong trình biên dịch của Next — xem src/test/nextFontStub.ts.
      "next/font/google": resolve(__dirname, "src/test/nextFontStub.ts"),
    },
  },
});
