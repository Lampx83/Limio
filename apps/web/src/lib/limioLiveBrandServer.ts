import { getOrganizationSlideBrandForUser } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";

/** Thương hiệu của trường mà người dùng thuộc về (null nếu không thuộc trường nào): đủ để máy khách tự tính thương hiệu thực sự áp cho bài. */
export interface DeckOrgBrand {
  name: string;
  /** Cài đặt đã lưu của trường (OrgBrandSettings, chưa chuẩn hoá lại ở máy khách). */
  slideBrand: unknown;
  /** Logo của trường (brandingLogoUrl). */
  logoUrl: string | null;
}

/**
 * Gắn thương hiệu của trường vào bài giảng trả về cho chủ bài. Máy khách tính thương hiệu thực sự bằng
 * resolveEffectiveBrand (hàm thuần) để đổi chế độ/mẫu xong thấy ngay mà không phải tải lại.
 */
export async function withOrgBrand<T extends object>(deck: T, userId: string): Promise<T & { org: DeckOrgBrand | null }> {
  const org = await getOrganizationSlideBrandForUser(userId, prisma);
  return { ...deck, org: org ? { name: org.organizationName, slideBrand: org.slideBrand, logoUrl: org.logoUrl } : null };
}
