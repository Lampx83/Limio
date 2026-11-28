"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import NeuApiTester from "./NeuApiTester";
import { formatDateTime } from "@/lib/datetime";

interface Status {
  key: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  updatedAt: string | Date | null;
}

const LABELS: Record<
  string,
  { name: string; placeholder: string; help?: string; emoji?: string; multiline?: boolean }
> = {
  openai: {
    name: "OpenAI API key",
    placeholder: "sk-proj-...",
    help: "Dùng cho AI tutor, auto-tag skill, generate feedback. Lấy ở console.openai.com.",
    emoji: "",
  },
  "stripe.secret": {
    name: "Stripe secret key",
    placeholder: "sk_live_... / sk_test_...",
    emoji: "",
  },
  "vnpay.secret": {
    name: "Khoá bí mật (vnp_HashSecret)",
    placeholder: "VNPAY_HASH_SECRET",
    help: "Do VNPay cấp cùng mã website. Không bao giờ gửi cho học viên hay dán vào chat.",
    emoji: "",
  },
  "vnpay.tmn_code": {
    name: "Mã website (vnp_TmnCode)",
    placeholder: "VD: ABCD1234",
    help: "8 ký tự do VNPay cấp cho từng website.",
  },
  "vnpay.payment_url": {
    name: "Địa chỉ thanh toán",
    placeholder: "https://pay.vnpay.vn/vpcpay.html",
    help: "Để trống = sandbox (https://sandbox.vnpayment.vn/paymentv2/vpcpay.html). Khi chạy thật phải đặt địa chỉ production mà VNPay cấp.",
  },
  "momo.secret": { name: "Momo secret", placeholder: "MOMO_SECRET_KEY", emoji: "" },
  "sepay.api_key": {
    name: "Khoá API webhook",
    placeholder: "Chuỗi bất kỳ, khai cùng ở SePay",
    help: "Tự đặt một chuỗi dài, khó đoán; khai đúng chuỗi này ở SePay (Webhooks → Kiểu xác thực API Key). SePay gửi nó trong header Authorization: Apikey …. Không gửi cho ai, không dán vào chat.",
  },
  "sepay.account_number": {
    name: "Số tài khoản nhận tiền",
    placeholder: "VD: 0123456789",
    help: "Tài khoản ngân hàng đã gắn vào SePay. Giao dịch vào tài khoản khác bị bỏ qua.",
  },
  "sepay.bank": {
    name: "Ngân hàng (cho ảnh QR)",
    placeholder: "VD: Vietcombank, MBBank, VCB",
    help: "Tên hoặc mã ngân hàng đúng như SePay/VietQR dùng; sai thì ảnh QR không dựng được (thông tin chuyển khoản dạng chữ vẫn hiện).",
  },
  "sepay.account_holder": {
    name: "Tên chủ tài khoản (tuỳ chọn)",
    placeholder: "VD: NGUYEN VAN A",
    help: "Hiện cho người mua để họ đối chiếu trước khi chuyển.",
  },
  "sepaypg.merchant_id": {
    name: "Merchant ID",
    placeholder: "VD: SP-TEST-XXXXXXXX (sandbox) / SP-LIVE-…",
    help: "Mã merchant ở my.sepay.vn → Cổng thanh toán. Sandbox và thật có hai bộ riêng.",
  },
  "sepaypg.secret_key": {
    name: "Secret Key",
    placeholder: "Khoá bí mật do SePay cấp",
    help: "SePay chỉ hiện một lần khi tạo; sao chép ngay vào đây. Không gửi cho ai, không dán vào chat.",
  },
  "sepaypg.ipn_secret": {
    name: "Khoá xác thực IPN (tuỳ chọn)",
    placeholder: "Chuỗi tự đặt, khai cùng ở SePay",
    help: "Chỉ điền nếu trang Cấu hình IPN ở SePay có ô chọn kiểu xác thực SECRET_KEY: nhập đúng chuỗi này ở cả hai nơi (SePay gửi nó trong header X-Secret-Key). Để TRỐNG nếu SePay không có ô đó: Limio sẽ hỏi lại API của SePay để xác nhận đơn đã thu tiền trước khi cấp quyền.",
  },
  "sepaypg.env": {
    name: "Môi trường",
    placeholder: "sandbox hoặc production",
    help: "Để trống = sandbox (không thu tiền thật). Chỉ gõ production khi dùng Merchant ID và Secret Key thật.",
  },
  "sepay.qr_base_url": {
    name: "Địa chỉ dịch vụ ảnh QR (tuỳ chọn)",
    placeholder: "https://qr.sepay.vn/img",
    help: "Để trống = https://qr.sepay.vn/img. Chỉ đổi nếu tài liệu SePay hiện hành ghi địa chỉ khác.",
  },
  "vbee.app_id": { name: "App-Id", placeholder: "App-Id" },
  "vbee.token": { name: "Token", placeholder: "Token" },
  "speech_analysis.base_url": {
    name: "Địa chỉ dịch vụ",
    placeholder: "http://<máy GPU>:8080/speech",
    help: "Gốc của dịch vụ phân tích tiếng nói (không kèm /v1/analyze). Để trống = chuyển chữ bằng Whisper qua OpenAI như trước.",
  },
  "speech_analysis.api_key": {
    name: "Khoá API",
    placeholder: "Khoá của dịch vụ",
    help: "Cùng giá trị với SPEECH_API_KEY của dịch vụ. Gửi kèm mỗi lần gọi (Authorization: Bearer và x-api-key).",
  },
  "neutts.base_url": {
    name: "Base URL (Kong)",
    placeholder: "http://<host>:8037/tts",
    help: "Gốc gateway của NEU TTS, gồm tiền tố /tts, không kèm /v1/speech.",
  },
  "neutts.api_key": {
    name: "Kong consumer key",
    placeholder: "Kong consumer key",
    help: "Key của consumer trên Kong (key-auth, header x-api-key).",
  },
  "neutts.voice": {
    name: "Giọng",
    placeholder: "baotrang",
    help: "Một trong: baotrang, giahuy, hamy, huuduc, kimoanh, maichi, quangminh, tiendat. Bỏ trống = baotrang.",
  },
  "neutts.voice_zh": {
    name: "Giọng tiếng Trung",
    placeholder: "",
    help: "Giọng đọc cho đề vấn đáp tiếng Trung. Bỏ trống = hệ thống lấy giọng tiếng Trung đầu tiên NEU trả về.",
  },
  "neutts.voice_en": {
    name: "Giọng tiếng Anh",
    placeholder: "",
    help: "Giọng đọc cho đề vấn đáp tiếng Anh. Bỏ trống = hệ thống lấy giọng tiếng Anh đầu tiên NEU trả về.",
  },
  "websearch.tavily": {
    name: "Tavily API key (tìm trên internet)",
    placeholder: "tvly-...",
    help: "Limio-Live dùng khi soạn bài giảng từ mô tả chủ đề có bật nguồn internet. Lấy ở app.tavily.com. Bỏ trống thì không hiện công tắc nguồn internet.",
  },
  "ga4.property_id": {
    name: "GA4 Property ID",
    placeholder: "556146065",
    help: "Số ID property trong GA Admin → Property details (không phải Measurement ID G-...).",
  },
  "ga4.service_account": {
    name: "Service account JSON",
    placeholder: '{"type":"service_account",...}',
    help: "Toàn bộ nội dung file JSON key, cấp quyền Viewer trên property trong GA Admin → Property access management.",
    multiline: true,
  },
};

/**
 * Vài integration cần NHIỀU secret cùng lúc (vd Vbee: App-Id + Token) — gom
 * lại một khung thay vì mỗi secret một card riêng, để rõ đây là MỘT tích hợp
 * chứ không phải hai cái không liên quan.
 */
const GROUPS: Record<
  string,
  { name: string; help?: string; emoji?: string; keys: string[]; testEndpoint?: string; embedsTester?: boolean }
> = {
  vbee: {
    name: "Vbee — vấn đáp AI bằng giọng nói",
    help: "TTS + STT cho chế độ vấn đáp bằng giọng nói. Lấy cả App-Id và Token ở studio.vbee.vn/apps.",
    emoji: "",
    keys: ["vbee.app_id", "vbee.token"],
    // Không có mode "test trước khi lưu" như OpenAI — App-Id/Token là hai ô
    // độc lập, không có một giá trị "đang gõ" duy nhất để test tạm. Test
    // luôn nhắm vào cặp ĐÃ LƯU, và chỉ bật khi cả hai đã cấu hình.
    testEndpoint: "/api/admin/integrations/vbee/test",
  },
  speech_analysis: {
    name: "Phân tích tiếng nói — nhịp nói khi học viên nói bằng mic",
    help: "Dịch vụ nội bộ chạy trên máy GPU: chuyển chữ, mốc thời gian và đoạn có tiếng để đo độ trôi chảy; giọng nói không rời máy chủ của mình. Lỗi hoặc quá bận thì tự dùng Whisper qua OpenAI. Xem docs/van-hanh/phan-tich-tieng-noi.md.",
    keys: ["speech_analysis.base_url", "speech_analysis.api_key"],
  },
  neutts: {
    name: "NEU TTS — đọc giọng vấn đáp (Việt, Trung, Anh)",
    help: "Khi đã nhập Base URL, luồng vấn đáp đọc bằng NEU TTS thay cho OpenAI. Mỗi ngôn ngữ của đề dùng giọng của ngôn ngữ đó. Để trống Base URL = dùng OpenAI TTS.",
    keys: ["neutts.base_url", "neutts.api_key", "neutts.voice", "neutts.voice_zh", "neutts.voice_en"],
    embedsTester: true,
  },
  vnpay: {
    name: "VNPay — thanh toán ATM / QR / thẻ",
    help: "Cần cả mã website và khoá bí mật thì nút thanh toán VNPay mới hiện ở trang khoá. Địa chỉ nhận kết quả (IPN) khai ở cổng quản trị VNPay: https://<tên miền>/api/webhooks/vnpay. Xem docs/van-hanh/cong-thanh-toan.md.",
    keys: ["vnpay.tmn_code", "vnpay.secret", "vnpay.payment_url"],
  },
  sepaypg: {
    name: "SePay — cổng thanh toán (VietQR, QR NAPAS, thẻ)",
    help: "Cần Merchant ID và Secret Key thì nút \"Thanh toán qua SePay\" mới hiện ở trang khoá và trang combo. Địa chỉ IPN khai ở my.sepay.vn: https://<tên miền>/api/webhooks/sepaypg, xác thực SECRET_KEY. Xem docs/tieu-chi/thanh-toan-sepay-pg.md.",
    keys: ["sepaypg.merchant_id", "sepaypg.secret_key", "sepaypg.ipn_secret", "sepaypg.env"],
  },
  sepay: {
    name: "SePay — chuyển khoản ngân hàng tự động (không cần pháp nhân)",
    help: "Cần cả khoá API, số tài khoản và ngân hàng thì nút \"Chuyển khoản VietQR\" mới hiện ở trang khoá và trang combo. Địa chỉ webhook khai ở SePay: https://<tên miền>/api/webhooks/sepay, kiểu xác thực API Key. Xem docs/tieu-chi/thanh-toan-sepay.md.",
    keys: ["sepay.api_key", "sepay.account_number", "sepay.bank", "sepay.account_holder", "sepay.qr_base_url"],
  },
  ga4: {
    name: "Google Analytics 4 — traffic & acquisition",
    help: "Property ID lấy ở GA Admin → Property details. Service account JSON: tạo ở Google Cloud Console (IAM → Service accounts → Keys), cấp quyền Viewer cho property trong GA Admin → Property access management. Dùng cho traffic/acquisition trên Admin Dashboard — không dùng cho hành vi học chi tiết (đã có LearningEvent).",
    keys: ["ga4.property_id", "ga4.service_account"],
    testEndpoint: "/api/admin/integrations/ga4/test",
  },
};

/**
 * Chủ đề của từng tích hợp, để trang Cài đặt hiện mỗi tab một nhóm thay vì một trang dài 14 thẻ.
 * Khoá/nhóm chưa được xếp ở đây (thêm khoá mới mà quên khai) rơi vào "ai", không bao giờ bị ẩn mất.
 */
export type IntegrationTopic = "payment" | "ai" | "analytics";

const TOPIC_MEMBERS: Record<Exclude<IntegrationTopic, "ai">, { groups: string[]; keys: string[] }> = {
  payment: { groups: ["vnpay", "sepaypg", "sepay"], keys: ["stripe.secret", "momo.secret"] },
  analytics: { groups: ["ga4"], keys: [] },
};

const DISPLAY_ORDER: Record<IntegrationTopic, string[]> = {
  payment: ["stripe.secret", "sepaypg", "vnpay", "sepay", "momo.secret"],
  ai: ["openai", "neutts", "speech_analysis", "vbee", "websearch.tavily"],
  analytics: ["ga4"],
};

function topicOfGroup(groupId: string): IntegrationTopic {
  for (const [t, m] of Object.entries(TOPIC_MEMBERS)) if (m.groups.includes(groupId)) return t as IntegrationTopic;
  return "ai";
}

function topicOfKey(key: string): IntegrationTopic {
  for (const [t, m] of Object.entries(TOPIC_MEMBERS)) if (m.keys.includes(key)) return t as IntegrationTopic;
  return "ai";
}

export default function IntegrationsManager({
  initialStatuses,
  topic,
}: {
  initialStatuses: Status[];
  topic: IntegrationTopic;
}) {
  const [statuses, setStatuses] = useState<Status[]>(initialStatuses);

  async function refresh() {
    const r = await fetch(apiUrl("/api/admin/integrations"));
    const j = await r.json();
    setStatuses(j.statuses ?? []);
  }

  const byKey = new Map(statuses.map((s) => [s.key, s]));
  const groupedKeys = new Set(Object.values(GROUPS).flatMap((g) => g.keys));
  const groupEntries = Object.entries(GROUPS)
    .filter(([id]) => topicOfGroup(id) === topic)
    .map(([id, group]) => ({
      id,
      group,
      members: group.keys.map((k) => byKey.get(k)).filter((s): s is Status => s !== undefined),
    }))
    .filter((e) => e.members.length > 0);
  const standalone = statuses.filter((s) => !groupedKeys.has(s.key) && topicOfKey(s.key) === topic);

  const total = groupEntries.length + standalone.length;
  const configured =
    groupEntries.filter((e) => e.members.some((m) => m.hasValue)).length + standalone.filter((s) => s.hasValue).length;

  // Cái hay dùng nhất lên đầu; cái chưa xếp (khoá mới) xuống cuối, giữ nguyên thứ tự gốc.
  const order = DISPLAY_ORDER[topic];
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  const cards = [
    ...groupEntries.map((e) => ({ id: e.id, node: e })),
    ...standalone.map((s) => ({ id: s.key, node: s })),
  ].sort((a, b) => rank(a.id) - rank(b.id));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted" aria-live="polite">
        <span className="font-medium text-[rgb(var(--text))]">{configured}</span> / {total} tích hợp đã có cấu hình. Khoá được
        mã hoá AES-256-GCM, không bao giờ trả lại trình duyệt.
      </p>
      {cards.map(({ id, node }) =>
        "group" in node ? (
          <IntegrationGroupCard
            key={id}
            group={node.group}
            members={node.members}
            onChange={refresh}
            extra={
              node.group.embedsTester && byKey.get("neutts.base_url")?.hasValue && byKey.get("neutts.api_key")?.hasValue ? (
                <NeuApiTester />
              ) : null
            }
          />
        ) : (
          <IntegrationRow key={id} status={node} onChange={refresh} />
        ),
      )}
    </div>
  );
}

/** Thẻ thu gọn: tên + trạng thái luôn thấy, phần hướng dẫn và ô nhập chỉ mở khi cần. */
function Disclosure({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="card p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-5 py-4 text-left hover:bg-[rgb(var(--surface-muted))]"
      >
        <span className="min-w-[14rem] flex-1">
          <span className="block text-base font-semibold">{title}</span>
          {subtitle && <span className="mt-0.5 block font-mono text-xs text-faint">{subtitle}</span>}
        </span>
        <span className="ml-auto flex items-center gap-3 sm:ml-0">
          {badge}
          <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div id={id} className="border-t border-token px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </section>
  );
}

function IntegrationGroupCard({
  group,
  members,
  onChange,
  extra,
}: {
  group: { name: string; help?: string; emoji?: string; testEndpoint?: string; embedsTester?: boolean };
  members: Status[];
  onChange: () => void;
  extra?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const filled = members.filter((m) => m.hasValue).length;
  const allConfigured = filled === members.length;

  async function testSaved() {
    if (!group.testEndpoint) return;
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch(apiUrl(group.testEndpoint), { method: "POST" });
    const j = await res.json();
    setBusy(false);
    setTestResult(j.ok ? "✓ Key đã lưu hợp lệ" : `✗ ${j.error}`);
  }

  // Nhóm có ô tuỳ chọn nên không có "đủ/thiếu" tuyệt đối: chỉ nói đã điền bao nhiêu ô.
  const badge = (
    <span className={filled === 0 ? "chip" : allConfigured ? "chip-success" : "chip-brand"}>
      {filled === 0 ? "Chưa cấu hình" : `${filled}/${members.length} ô đã điền`}
    </span>
  );

  return (
    <Disclosure title={group.name} badge={badge}>
      {group.help && <p className="mb-4 text-xs text-muted">{group.help}</p>}
      <div className="space-y-5">
        {members.map((status, i) => (
          <div key={status.key} className={i > 0 ? "border-t border-token pt-4" : ""}>
            <IntegrationField status={status} onChange={onChange} />
          </div>
        ))}
      </div>

      {extra}

      {group.testEndpoint && allConfigured && (
        <div className="mt-4 border-t border-token pt-4">
          <button onClick={testSaved} disabled={busy} className="btn-secondary btn-sm">
            Test key đã lưu
          </button>
          {testResult && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                testResult.startsWith("✓")
                  ? "border border-success-100 bg-success-50 text-success-700"
                  : testResult.startsWith("✗")
                    ? "border border-danger-100 bg-danger-50 text-danger-700"
                    : "border border-token bg-[rgb(var(--surface-muted))] text-muted"
              }`}
            >
              {testResult}
            </p>
          )}
        </div>
      )}
    </Disclosure>
  );
}

function IntegrationRow({
  status,
  onChange,
}: {
  status: Status;
  onChange: () => void;
}) {
  const meta = LABELS[status.key] ?? { name: status.key, placeholder: "", emoji: "" };
  return (
    <Disclosure title={meta.name} subtitle={status.key} badge={<StatusChip status={status} />}>
      {meta.help && <p className="mb-4 text-xs text-muted">{meta.help}</p>}
      <IntegrationField status={status} onChange={onChange} hideLabel />
    </Disclosure>
  );
}

function StatusChip({ status }: { status: Status }) {
  const statusChip = status.hasValue
    ? status.source === "env"
      ? "chip-brand"
      : "chip-success"
    : "chip";
  const statusLabel = status.hasValue
    ? status.source === "env"
      ? "Từ biến môi trường"
      : "Đã lưu"
    : "Chưa cấu hình";
  return <span className={statusChip}>{statusLabel}</span>;
}

/**
 * Phần thân dùng chung cho cả card đơn (IntegrationRow) lẫn card gộp nhóm
 * (IntegrationGroupCard): nhãn nhỏ + trạng thái (trừ khi `hideLabel` — card
 * đơn đã hiện tên/trạng thái ở header rồi), ô nhập, nút lưu/đổi/xoá, kết quả
 * test, thời điểm cập nhật. Mỗi field tự quản state của riêng nó — lưu App-Id
 * không đụng gì tới Token.
 */
// Giọng của NEU TTS (đo từ /v1/voices, 2026-10). Mặc định: baotrang.
const NEU_TTS_VOICES = [
  "baotrang", "giahuy", "hamy", "huuduc", "kimoanh", "maichi", "quangminh", "tiendat",
] as const;
const NEU_TTS_DEFAULT_VOICE = "baotrang";

function IntegrationField({
  status,
  onChange,
  hideLabel,
}: {
  status: Status;
  onChange: () => void;
  hideLabel?: boolean;
}) {
  const meta = LABELS[status.key] ?? { name: status.key, placeholder: "" };
  const [value, setValue] = useState(status.key === "neutts.voice" ? NEU_TTS_DEFAULT_VOICE : "");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(!status.hasValue);
  // Giọng tiếng Trung/Anh: danh sách giọng lấy từ NEU, lọc theo ngôn ngữ của ô này.
  const voiceLang = status.key === "neutts.voice_zh" ? "zh" : status.key === "neutts.voice_en" ? "en" : null;
  const [langVoices, setLangVoices] = useState<string[] | null>(null);
  useEffect(() => {
    if (!voiceLang) return;
    let cancelled = false;
    fetch(apiUrl("/api/admin/integrations/neutts/voices"), { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; voices?: Array<{ voice: string; language: string }> }) => {
        if (cancelled || !j.ok) return;
        const list = (j.voices ?? []).filter((v) => v.language === voiceLang).map((v) => v.voice);
        setLangVoices(list);
        setValue((cur) => cur || list[0] || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [voiceLang]);

  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    setTestResult(null);
    const res = await fetch(
      apiUrl(`/api/admin/integrations/${encodeURIComponent(status.key)}`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value.trim() }),
      },
    );
    setBusy(false);
    if (res.ok) {
      setValue("");
      setShowInput(false);
      setTestResult("✓ Đã lưu (encrypted)");
      onChange();
    } else {
      const d = await res.json().catch(() => ({}));
      setTestResult(`Lỗi: ${d.error ?? "unknown"}`);
    }
  }

  async function testInline() {
    if (!value.trim()) return;
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch(apiUrl("/api/admin/integrations/openai/test"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: value.trim() }),
    });
    const j = await res.json();
    setBusy(false);
    setTestResult(
      j.ok ? `✓ Hợp lệ (${j.modelCount} models)` : `✗ ${j.error}`,
    );
  }

  async function testSaved() {
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch(apiUrl("/api/admin/integrations/openai/test"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    setBusy(false);
    setTestResult(
      j.ok ? `✓ Key đã lưu hợp lệ (${j.modelCount} models)` : `✗ ${j.error}`,
    );
  }

  async function clearKey() {
    if (!confirm(`Xóa key "${status.key}"?`)) return;
    setBusy(true);
    const res = await fetch(
      apiUrl(`/api/admin/integrations/${encodeURIComponent(status.key)}`),
      { method: "DELETE" },
    );
    setBusy(false);
    if (res.ok) {
      setValue("");
      setShowInput(true);
      setTestResult(null);
      onChange();
    }
  }

  return (
    <div>
      {!hideLabel && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-medium">{meta.name}</span>{" "}
            <code className="font-mono text-xs text-faint">{status.key}</code>
          </div>
          <StatusChip status={status} />
        </div>
      )}

      {showInput ? (
        <div className="space-y-3">
          {status.key === "neutts.voice" ? (
            <select
              value={value || NEU_TTS_DEFAULT_VOICE}
              onChange={(e) => setValue(e.target.value)}
              className="input font-mono"
            >
              {NEU_TTS_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : voiceLang && langVoices && langVoices.length > 0 ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="input font-mono">
              {langVoices.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : meta.multiline ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={meta.placeholder}
              rows={6}
              className="input font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={meta.placeholder}
              className="input font-mono"
              autoComplete="off"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {status.key === "openai" && (
              <button
                onClick={testInline}
                disabled={busy || !value}
                className="btn-secondary btn-sm"
              >
                Test trước khi lưu
              </button>
            )}
            <button
              onClick={save}
              disabled={busy || !value}
              className="btn-primary btn-sm"
            >
              {busy ? "..." : "Lưu (encrypted)"}
            </button>
            {status.hasValue && (
              <button
                onClick={() => {
                  setShowInput(false);
                  setValue("");
                  setTestResult(null);
                }}
                className="btn-ghost btn-sm"
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowInput(true)}
            className="btn-secondary btn-sm"
          >
            Thay đổi
          </button>
          {status.key === "openai" && (
            <button
              onClick={testSaved}
              disabled={busy}
              className="btn-secondary btn-sm"
            >
              Test key đã lưu
            </button>
          )}
          {status.source === "db" && (
            <button
              onClick={clearKey}
              disabled={busy}
              className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg border border-danger-100 bg-[rgb(var(--surface))] px-3 py-1.5 font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-50"
            >
              Xóa
            </button>
          )}
        </div>
      )}

      {testResult && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            testResult.startsWith("✓")
              ? "border border-success-100 bg-success-50 text-success-700"
              : testResult.startsWith("✗") || testResult.startsWith("Lỗi")
                ? "border border-danger-100 bg-danger-50 text-danger-700"
                : "border border-token bg-[rgb(var(--surface-muted))] text-muted"
          }`}
        >
          {testResult}
        </p>
      )}

      {status.updatedAt && (
        <p className="mt-3 text-xs text-faint">
          Cập nhật: {formatDateTime(status.updatedAt)}
        </p>
      )}
    </div>
  );
}
