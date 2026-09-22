"use client";

import { useState } from "react";

/**
 * Cảnh báo khi trang được mở trong webview của Zalo/Messenger/... — đăng nhập
 * Google sẽ thất bại trong các trình duyệt nhúng này. Nút "Sao chép liên kết"
 * đọc window.location.href lúc bấm, không cần server truyền URL tuyệt đối
 * xuống (an toàn với basePath/reverse proxy).
 */
export default function InAppBrowserNotice({ appName }: { appName: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API có thể bị chặn (context không secure, quyền bị từ
      // chối...) — im lặng bỏ qua, người dùng vẫn thấy hướng dẫn copy tay.
    }
  }

  return (
    <div className="banner-warning text-left">
      <p className="font-medium">
        Bạn đang mở liên kết này trong {appName}
      </p>
      <p className="mt-1 text-sm">
        {appName} dùng trình duyệt riêng, và Google chặn đăng nhập từ trình
        duyệt này — dù đăng nhập lại bao nhiêu lần cũng sẽ không vào được.
        Hãy mở liên kết bằng Chrome hoặc Safari:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>
          Chạm vào nút menu (⋮ hoặc ⋯) ở góc màn hình và chọn{" "}
          <strong>&quot;Mở bằng trình duyệt&quot;</strong>, hoặc
        </li>
        <li>Sao chép liên kết bên dưới rồi dán vào Chrome/Safari.</li>
      </ol>
      <button
        type="button"
        onClick={copyLink}
        className="btn-secondary btn-sm mt-3"
      >
        {copied ? "Đã sao chép" : "Sao chép liên kết"}
      </button>
    </div>
  );
}
