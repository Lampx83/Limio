import type { MetadataRoute } from "next";
import { LOGO_PNG, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

/**
 * `/manifest.webmanifest` — tên/biểu tượng khi cài về màn hình chính và tín
 * hiệu "đây là một ứng dụng web có thương hiệu" cho Chrome/Lighthouse.
 * `start_url`/`icons` là đường dẫn nội bộ: Next tự gắn basePath.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#F7FEE7",
    theme_color: "#65A30D",
    lang: "vi",
    icons: [
      { src: LOGO_PNG, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
