---
version: 1.0
name: BackHaulBid
source: "Hướng thiết kế dựa trên designs/uber/DESIGN.md (awesome-design-md, MIT, commit 13be5c0): bố cục tiết chế, một màu hành động, nút viên thuốc, thẻ phẳng, dải đảo màu. Màu hành động giữ navy của BackHaulBid. Không dùng tên, logo hay hình ảnh của Uber."
description: Giao diện tiết chế cho sàn đấu giá vận tải. Navy #1B4965 là màu hành động duy nhất, mọi phần tử tương tác bo tròn dạng viên thuốc, thẻ trắng bo 16 px phẳng trên nền xám lạnh, một dải navy đậm đảo màu cho thông tin quan trọng nhất của màn (phòng đấu giá, số dư, việc gấp). Màu trạng thái chỉ dùng để báo trạng thái phiên, chuyến và tiền. Font Be Vietnam Pro cho tiếng Việt; mọi số tiền, giờ và mã dùng chữ số đều nhau.

colors:
  primary: "#1B4965"        # nút chính, mục điều hướng đang chọn, liên kết
  primary-hover: "#143A51"
  primary-soft: "#E6EEF4"   # nền mục đang chọn, vùng chọn
  on-primary: "#FFFFFF"
  band: "#102F44"           # dải đảo màu (navy đậm), chữ trắng 13.9:1
  band-hover: "#1A3D55"
  on-band: "#FFFFFF"
  on-band-soft: "#B7C6D3"   # chữ phụ trên dải, 8.0:1
  ink: "#0F1E2E"            # tiêu đề và chữ chính
  body: "#4A5B6C"           # chữ phụ: 7.0:1 trên trắng, 6.1:1 trên canvas-soft
  subtle: "#5E6A77"         # chú thích nhỏ nhất: 5.5:1 trên trắng, 4.8:1 trên canvas-soft, 4.7:1 trên primary-soft
  mute: "#C3CCD6"           # chỉ viền mạnh, placeholder, vô hiệu; không dùng cho chữ cần đọc
  page: "#F4F6F8"           # nền trang ứng dụng
  canvas: "#FFFFFF"         # thẻ, dialog, thanh điều hướng
  canvas-soft: "#EDF0F4"    # ô nhập, chip, nút nhẹ, đầu bảng
  line: "#DFE4EA"           # đường kẻ, trạng thái nhấn
  focus: "#2B7BB9"          # vòng focus 2 px, cách 2 px
  success: "#0E7C3A"
  success-soft: "#E3F3E8"
  warning: "#8A5300"
  warning-soft: "#FBEFD9"
  danger: "#C0262D"
  danger-soft: "#FBE7E7"
  info: "#1F5FBF"
  info-soft: "#E6EEFA"

typography:
  fontFamily: "Be Vietnam Pro, system-ui, Segoe UI, Roboto, Arial, sans-serif"
  display-xxl: { fontSize: 52px, fontWeight: 700, lineHeight: 64px }   # chỉ trang đăng nhập
  display-xl:  { fontSize: 36px, fontWeight: 700, lineHeight: 44px }
  display-lg:  { fontSize: 32px, fontWeight: 700, lineHeight: 40px }   # đồng hồ phòng đấu giá, số dư ví
  display-md:  { fontSize: 24px, fontWeight: 700, lineHeight: 32px }   # tiêu đề trang
  display-sm:  { fontSize: 20px, fontWeight: 700, lineHeight: 28px }   # tiêu đề thẻ, mục
  body-lg:     { fontSize: 18px, fontWeight: 500, lineHeight: 26px }
  body-md:     { fontSize: 16px, fontWeight: 400, lineHeight: 24px }
  body-md-strong: { fontSize: 16px, fontWeight: 500, lineHeight: 22px }
  body-sm:     { fontSize: 14px, fontWeight: 400, lineHeight: 20px }
  body-sm-strong: { fontSize: 14px, fontWeight: 500, lineHeight: 20px }
  caption:     { fontSize: 12px, fontWeight: 400, lineHeight: 18px }
  button-large: { fontSize: 18px, fontWeight: 500, lineHeight: 24px }
  button-md:   { fontSize: 16px, fontWeight: 500, lineHeight: 20px }
  numeric: "font-variant-numeric: tabular-nums"

rounded: { none: 0px, sm: 6px, md: 8px, lg: 12px, xl: 16px, pill-tab: 36px, pill: 999px }
spacing: { xxs: 4px, xs: 6px, sm: 8px, md: 12px, lg: 16px, xl: 20px, 2xl: 24px, 3xl: 32px, 4xl: 48px }
elevation:
  level-0: none
  level-1: "0 4px 16px rgba(15,30,46,0.10)"   # thẻ được kéo, popover nhỏ
  level-2: "0 4px 16px rgba(15,30,46,0.16)"   # dialog, sheet, thanh hành động dính đáy
  level-3: "0 2px 8px rgba(15,30,46,0.16)"    # nút nổi trên bản đồ
---

## Tổng quan

BackHaulBid là sàn đấu giá ngược cho xe tải chiều về: Chủ hàng đăng lô, Chủ xe đặt giá thấp dần, Tài xế chạy chuyến, Admin vận hành. Người dùng đọc nhiều số (giá, cọc, phí, giờ đóng phiên, phút trễ) và thường thao tác trên điện thoại ngoài trời. Giao diện vì vậy tiết chế: nền xám lạnh rất nhạt, thẻ trắng, chữ navy gần đen, một màu hành động duy nhất là navy, để mắt chỉ dừng ở số liệu và nút cần bấm.

Ba dấu hiệu nhận diện:

1. **Viên thuốc navy.** Mọi nút chính là viên thuốc navy bo 999 px; mỗi vùng nhìn thấy chỉ có một nút như vậy.
2. **Dải navy đậm.** Thông tin quan trọng nhất của màn nằm trên một thẻ `band` chữ trắng: bảng đặt giá trong phòng đấu giá, số dư ví, việc gấp nhất trên trang chủ, chuyến đang chạy của tài xế. Tối đa một dải trên một màn.
3. **Thẻ hành trình.** Điểm lấy và điểm giao là hai hàng nền `canvas-soft` có ghim tròn và ghim vuông nối bằng đường dọc.

## Màu

- Navy `primary` là màu hành động duy nhất: nút chính, mục điều hướng đang chọn, liên kết. Không thêm màu thương hiệu thứ hai; `#3D7A8A` (secondary cũ) không dùng cho nút mới.
- Xám lạnh là cấu trúc: `page` nền trang, `canvas` thẻ, `canvas-soft` ô nhập/chip/đầu bảng, `line` đường kẻ.
- **Màu trạng thái** chỉ mang nghĩa: xanh lá là xong hoặc đạt, vàng nâu là chờ hoặc sắp hết hạn, đỏ là lỗi, trễ, bị từ chối, xanh dương là thông tin. Luôn đi kèm biểu tượng và chữ. Không tô nút bằng màu trạng thái, trừ nút xác nhận thao tác phá hủy dùng `danger`.
- Tiền vào hiển thị `success` có dấu cộng; tiền ra hiển thị `ink` có dấu trừ; đỏ dành cho phạt và lỗi.
- Độ tương phản đã đo: `body` 7.0:1 trên trắng, 6.1:1 trên `canvas-soft`; `subtle` 5.5:1 trên trắng, 4.8:1 trên `canvas-soft`; mọi cặp `màu trạng thái / *-soft` từ 4.6:1; chữ trắng trên `primary` 9.6:1, trên `band` 13.9:1. Không đặt chữ `subtle` trên `line` (4.3:1).
- Không gradient, không ảnh stock.

## Chữ

- **Be Vietnam Pro** (Google Fonts, miễn phí, thiết kế cho dấu tiếng Việt). Trọng lượng 400 (chữ thường), 500 (nút, nhấn), 600 (nhãn, mục điều hướng đang chọn), 700 (tiêu đề).
- Tiêu đề viết hoa đầu câu, không in hoa toàn bộ, không giãn chữ. Nhãn nhỏ phía trên tiêu đề có thể in hoa ở cỡ 12 px.
- Mọi số tiền, giờ, đếm ngược, biển số, mã chuyến dùng `tabular-nums`.
- Đoạn văn tối đa khoảng 70 ký tự mỗi dòng.

## Bố cục

- Lưới 4 px. Khung nội dung tối đa 1200 px cho trang đọc, 1440 px cho bảng quản trị.
- Lề ngang 16 px trên điện thoại, 24 px trên tablet, 32 px trên máy tính.
- Desktop: thanh bên trắng, mục đang chọn nền `primary-soft`, vạch `primary` 3 px bên trái, chữ 500. Điện thoại: thanh tab dưới, mục đang chọn màu `primary`.
- Khoảng cách giữa các thẻ 16–24 px; trong thẻ, tiêu đề, nội dung, nút cách nhau 8–12 px.
- Điểm gãy: < 600 điện thoại, 600–1199 tablet, ≥ 1200 máy tính.

## Hình khối và độ nổi

- Nút, chip, nút biểu tượng: viên thuốc 999 px. Ngoại lệ: nút lớn trong form nhiều bước (tạo phiên, đặt giá, xác nhận giao hàng) bo 16 px cao 56 px.
- Thẻ: nền `canvas`, bo 16 px, viền 1 px `line`, không bóng. Thẻ trong thẻ dùng nền `canvas-soft` bo 12 px, không viền.
- Ô nhập: nền `canvas-soft`, bo 8 px, không viền, nhãn nằm trong ô (kiểu filled); hover nền `line`; focus nền trắng và viền `primary` 2 px. Lỗi: viền `danger` 2 px và dòng chữ lỗi bên dưới.
- Bóng chỉ cho dialog, sheet, popover, thanh hành động dính đáy (level 2) và nút nổi trên bản đồ (level 3).

## Thành phần

- **Nút:** chính (navy, chữ trắng), phụ (trắng, viền `line`, chữ `ink`), nhẹ (`canvas-soft`, chữ `ink`), chữ (màu `primary`, gạch chân khi hover), nguy hiểm (`danger`, chỉ cho thao tác phá hủy). Cao tối thiểu 40 px trên máy tính, 44–48 px trên màn cảm ứng. Nhấn thu nhỏ 0.98.
- **Huy hiệu trạng thái:** viên thuốc nền `*-soft`, chữ màu trạng thái, biểu tượng 14 px, chữ 12–13 px 500.
- **Chip lọc và tab:** viên thuốc `canvas-soft`; đang chọn nền `primary` chữ trắng; số đếm sau dấu chấm giữa.
- **Thẻ hành trình:** hai hàng nền `canvas-soft` bo 8 px, ghim tròn (lấy) và ghim vuông (giao), đường nối dọc 2 px `line`.
- **Bảng dữ liệu:** đầu bảng nền `canvas-soft` chữ `body-sm-strong` màu `body`; hàng cách nhau bằng `line`; cột số căn phải; hover nền `page`; trên điện thoại chuyển thành danh sách thẻ.
- **Dải navy đậm:** thẻ bo 16 px nền `band`, chữ trắng, số liệu `display-lg`, nút trắng chữ `primary`.
- **Dialog và sheet:** bo 16 px, level 2, không viền; trên điện thoại là toàn màn hoặc sheet từ dưới, nút xếp dọc đầy bề ngang.
- **Trống, đang tải, lỗi:** khung `canvas-soft` bo 16 px, chữ `body`, một nút hành động; đang tải dùng khung xương cùng hình dạng nội dung.
- **Bản đồ:** tràn trong thẻ, bo theo thẻ, nút nổi level 3.

## Chuyển động

- 150–200 ms cho hover và nhấn; chỉ animate `transform`, `opacity`, màu nền.
- Tôn trọng `prefers-reduced-motion`.

## Nên

- Mỗi vùng nhìn thấy một nút navy; hành động khác là nút phụ, nhẹ hoặc chữ.
- Đặt con số quan trọng nhất của màn lớn và đậm, có đơn vị rõ (₫, phút, tấn).
- Giữ nguyên nội dung, quyền và luồng nghiệp vụ; thiết kế chỉ quyết định cách trình bày.

## Không nên

- Không thêm màu thương hiệu thứ hai, không gradient, không ảnh stock.
- Không dùng màu trạng thái làm trang trí hoặc nền lớn.
- Không đổ bóng cho thẻ thường; không viền và bóng cùng lúc.
- Không in hoa tiêu đề, không giãn chữ tiêu đề.
- Không viết mã màu hoặc lớp màu Tailwind có sẵn (`slate-*`, `emerald-*`…) trong component; luôn dùng token.
