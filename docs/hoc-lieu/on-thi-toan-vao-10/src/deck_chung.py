"""Phần dùng chung của các bộ slide: khai báo slide, chấm câu hỏi, và kiểm kịch bản giọng."""
import re

# Những cụm giao việc cho học sinh. Giọng chỉ dừng thật ở cuối slide chờ, nên giao việc ở chỗ khác là học sinh không kịp làm.
GIAO_VIEC = re.compile(r"\bem (thử|tự|hãy|làm|đoán|chọn|nhập|kéo|bấm|vẽ|tính|xem|đọc|nhìn)\b|\?", re.I)


class BoSlide:
    def __init__(self, tien_to):
        self.tien_to = tien_to
        self.slides = []

    def slide(self, ma, html, buoc, cho=False, ghi_chu=""):
        self.slides.append({
            "id": f"{self.tien_to}-{ma}",
            "html": html,
            "ghiChu": ghi_chu,
            "loiGiang": {"buoc": buoc, "dungCuoi": cho},
        })


def lc(nhan, dung=False, phan_hoi=None):
    ph = f' data-phan-hoi="{phan_hoi}"' if phan_hoi else ""
    return f'<button class="lc{" dung" if dung else ""}" data-gt="{re.sub(chr(92) + "W", "", nhan)[:20]}"{ph}>{nhan}</button>'


def loi_sai(khi, chu):
    return f'<div class="loi-sai" data-khi="{khi}">{chu}</div>'


def so_phan_hien(html):
    """Số phần hiện dần của slide: mỗi <li> trong .hien-dan và mỗi phần tử có class hien."""
    li = sum(len(re.findall(r"<li\b", m.group(1))) for m in re.finditer(r'<ul class="hien-dan">(.*?)</ul>', html, re.S))
    return li + len(re.findall(r'class="(?:[^"]*\s)?hien(?:\s[^"]*)?"', html))


def kiem_kich_ban(s):
    buoc = s["loiGiang"]["buoc"]
    cho = s["loiGiang"]["dungCuoi"]
    for k, cau in enumerate(buoc):
        doc = re.sub(r"\[[^\]]*\]", " ", cau)
        cuoi = cho and k == len(buoc) - 1
        if not cuoi:
            assert not GIAO_VIEC.search(doc), f'{s["id"]} bước {k}: giao việc ở chỗ giọng không dừng: {doc[:70]}'
    if cho:
        assert "Tiếp tục" in buoc[-1], f'{s["id"]}: slide chờ phải dặn bấm Tiếp tục'
    assert "[nghĩ" not in " ".join(buoc), f'{s["id"]}: dấu [nghĩ] không tạo khoảng dừng trong giọng'


def kiem_slide(slides):
    """Số bước lời giảng phải bằng số phần hiện dần cộng một, và kịch bản phải đúng nhịp dừng."""
    for s in slides:
        kiem_kich_ban(s)
        ky_vong = so_phan_hien(s["html"]) + 1
        assert len(s["loiGiang"]["buoc"]) == ky_vong, f'{s["id"]}: {len(s["loiGiang"]["buoc"])} bước lời giảng, {ky_vong} bước hiện'
        assert "'" not in re.sub(r"data-du-lieu='[^']*'", "", s["html"]), s["id"]


def khung_deck(tieu_de, slides, phat_am=None):
    kiem_slide(slides)
    return {
        "tieuDe": tieu_de,
        "mau": "xanh",
        "ngonNgu": "vi",
        "nguoiGiang": {
            "macDinh": "tiendat",
            "dsGiangVien": [
                {"ma": "tiendat", "ten": "Tiến Đạt", "gioi": "nam", "xung": "thầy"},
                {"ma": "baotrang", "ten": "Bảo Trang", "gioi": "nu", "xung": "cô"},
            ],
            "xungHoHs": "em",
            "phatAm": phat_am or {},
        },
        "slides": slides,
    }
