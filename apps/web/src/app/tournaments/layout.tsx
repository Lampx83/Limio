// Tournament (danh sách + chi tiết) là trang khám phá/tham gia công khai —
// không phải workspace riêng của role nào, nên không mang sidebar (cùng lý do
// với /catalog). Lối về workspace cá nhân đã có sẵn ở AppHeader.
export default function TournamentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
