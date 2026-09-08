// Catalog là trang khám phá công khai — không phải workspace của riêng
// role nào, nên không mang sidebar (giống marketplace của Udemy/Coursera).
// Lối về workspace cá nhân đã có sẵn ở AppHeader (avatar menu → "Tổng quan
// của tôi", hoặc RoleSwitcher nếu tài khoản có nhiều role).
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
