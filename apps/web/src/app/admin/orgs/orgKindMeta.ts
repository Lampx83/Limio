/** Nhãn + màu của loại tổ chức, dùng chung cho danh sách và trang chi tiết (chỉ để hiển thị). */
export type OrgKindValue = "school" | "center" | "publisher";

export const ORG_KIND_META: Record<OrgKindValue, { label: string; chip: string }> = {
  school: { label: "Trường", chip: "chip" },
  center: { label: "Trung tâm", chip: "chip-brand" },
  publisher: { label: "Nhà xuất bản", chip: "chip-accent" },
};

export function orgKindMeta(kind: string | null | undefined) {
  return ORG_KIND_META[(kind as OrgKindValue) ?? "school"] ?? ORG_KIND_META.school;
}
