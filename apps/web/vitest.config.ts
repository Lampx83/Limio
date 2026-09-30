import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Tối thiểu: cho test dùng alias "@/" giống tsconfig và biên dịch JSX (tsconfig để
// jsx = "preserve" cho Next, esbuild của vitest cần "automatic" để test component).
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
