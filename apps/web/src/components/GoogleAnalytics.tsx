import Script from "next/script";

/**
 * Nhiều server (limio.vn, limio.hust.edu.vn...) build từ cùng codebase nhưng
 * mỗi domain cần số liệu GA4 riêng — đồng thời vẫn muốn 1 property tổng gộp
 * để xem traffic toàn hệ thống. Giải pháp: mỗi site gửi hit tới NHIỀU
 * Measurement ID cùng lúc qua nhiều lệnh `gtag('config', ...)` (GA4 hỗ trợ
 * sẵn, không cần Tag Manager). `measurementIds` rỗng/không set → không load
 * gì cả.
 */
export default function GoogleAnalytics({
  measurementIds,
}: {
  measurementIds: (string | undefined)[];
}) {
  const ids = measurementIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${ids.map((id) => `gtag('config', '${id}');`).join("\n          ")}
        `}
      </Script>
    </>
  );
}
