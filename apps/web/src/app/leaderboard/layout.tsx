// Bảng xếp hạng là trang công khai, không phải workspace riêng của role
// nào, nên không mang sidebar (cùng lý do với /catalog). Lối về workspace cá
// nhân đã có sẵn ở AppHeader.
export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
