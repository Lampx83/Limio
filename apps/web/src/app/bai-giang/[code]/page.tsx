import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getLiveDeckByShareCode, getOrganizationSlideBrandForUser } from "@feedbackme/core-lms";
import { resolveEffectiveBrand } from "@/lib/limioLiveBrand";
import { toPublicSlides } from "@/lib/limioLiveShare";
import SharedDeckView from "./SharedDeckView";

// Link xem chỉ đọc của bài giảng Limio-Live: ai có link cũng xem được, không cần đăng nhập. Luôn đọc mới từ DB
// (không cache) để tắt chia sẻ hay tạo link mới có hiệu lực ngay lập tức.
export const dynamic = "force-dynamic";

type Props = { params: { code: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const deck = await getLiveDeckByShareCode(params.code, prisma);
  return {
    // Layout gốc tự gắn hậu tố "| Limio".
    title: deck ? deck.title : "Không tìm thấy bài giảng",
    // Link riêng gửi tay, không phải trang công khai cho công cụ tìm kiếm.
    robots: { index: false, follow: false },
  };
}

export default async function SharedLiveDeckPage({ params }: Props) {
  const deck = await getLiveDeckByShareCode(params.code, prisma);
  if (!deck) notFound();

  // Tính sẵn thương hiệu thực sự áp cho bài (của bài hoặc của trường chủ bài) ở máy chủ, chỉ gửi kết quả ra trình duyệt.
  const org = deck.brandOff ? null : await getOrganizationSlideBrandForUser(deck.userId, prisma);
  const brand = resolveEffectiveBrand({
    deckBrand: deck.brand,
    brandOff: deck.brandOff,
    orgBrand: org?.slideBrand,
    orgLogoUrl: org?.logoUrl,
    deckTemplate: deck.brandTemplate,
  }).brand;

  return (
    <SharedDeckView
      deckId={deck.id}
      motif={deck.motif}
      title={deck.title}
      ownerName={deck.ownerName}
      theme={deck.theme}
      brand={brand}
      slides={toPublicSlides(deck.slides)}
    />
  );
}
