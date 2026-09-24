import { redirect } from "next/navigation";

// Chưa có trang danh sách riêng — màn hình tạo/chọn game (new) là điểm vào
// duy nhất của Gameshow (menu trái cũng trỏ vào đó). Giữ route này để link
// cũ "/instructor/gameshow" không 404.
export default function GameshowIndexPage() {
  redirect("/instructor/gameshow/new");
}
