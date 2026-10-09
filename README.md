# BackHaulBid Mobile

Ứng dụng Expo (SDK 54, Expo Router, JavaScript) dùng chung cho **SHIPPER, CARRIER và DRIVER**. Tài xế nhận chuyến bằng PIN và thực hiện hành trình. Chủ hàng và Chủ xe có các nghiệp vụ đấu giá, hợp đồng, theo dõi chuyến, ví, đội xe, sổ địa chỉ, khiếu nại, thông báo và hồ sơ doanh nghiệp. Admin dùng web portal.

Backend hiện có một vai trò trên mỗi tài khoản. “Đổi tài khoản / vai trò” đăng xuất và đăng nhập tài khoản tương ứng; app không sửa role trong JWT. Route và dữ liệu được kiểm tra theo tài khoản hiện tại, kể cả khi request/refresh của tài khoản cũ trả về muộn.

Theo dõi chuyến có bản đồ điểm đầu/cuối, tuyến dự kiến, GPS và timeline. Phiên bản Android hiện tại là `1.1.0` (version code `2`).

## Chạy ứng dụng

### Yêu cầu

- Node.js và npm tương thích với Expo SDK 54.
- Android Studio/Android SDK và JDK 17 để build Android.
- Điện thoại Android 8.0 (API 26) trở lên hoặc Android Emulator.

### Cài đặt và cấu hình

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

- Sửa `.env` để `EXPO_PUBLIC_API_BASE_URL` trỏ tới gateway đang chạy. Xem [hướng dẫn cấu hình môi trường](docs/ENVIRONMENT.md).
- Không đưa token, mật khẩu hoặc khóa bí mật vào biến `EXPO_PUBLIC_*`; các giá trị này được nhúng vào bundle.

### Chạy Android với Dev Client

Lần đầu, tạo project Android từ cấu hình Expo rồi build và cài lên thiết bị đang kết nối:

```powershell
npx expo prebuild --platform android --no-install
npx expo run:android
```

Để chạy lại Metro trên cùng Wi-Fi với điện thoại:

```powershell
npm run start -- --dev-client --lan
```

Mở BackHaulBid trên điện thoại và kết nối tới development server. Khi chỉ sửa JavaScript/JSX, Metro cập nhật app mà không cần build APK lại. Khi thêm hoặc đổi native module, Expo plugin, quyền Android hay cấu hình native, cần build Dev Client lại.

Dev Client cần Metro để tải JavaScript. Nếu mở APK Dev Client khi Metro chưa chạy hoặc điện thoại không tới được máy tính, app chưa thể vào luồng đăng nhập.

### Chạy web

```bash
npx expo start --web --port 3002
```

Bản Expo web dùng để phát triển/kiểm tra. Nếu chạy cùng web portal, giữ portal ở cổng `3000` và Expo web ở `3002`; gateway cần cho phép đúng origin trong cấu hình CORS.

```bash
npx expo export --platform web
```

### Chạy iOS

```bash
npm run ios
```

Build và cài iOS cần macOS cùng Xcode.

## Màn hình

Thanh tab theo vai trò (route được kiểm bằng `lib/roles.js`; backend vẫn quyết định quyền cuối cùng):

- Chủ hàng: Trang chủ / Phiên / Chuyến / Ví / Thêm
- Chủ xe: Trang chủ / Đấu giá / Chuyến / Đội xe / Thêm
- Tài xế: Chuyến / Lịch sử / Thông báo / Tài khoản

| Route | Vai trò | Mục đích |
|---|---|---|
| `/login` | cả ba | Đăng nhập; từ chối Admin |
| `/register` | chưa đăng nhập | Tạo tài khoản Tài xế; server cấp role DRIVER |
| `/(tabs)` | cả ba | Tài xế: chuyến cần làm. Chủ hàng/Chủ xe: số liệu và “Việc cần xử lý” |
| `/(tabs)/auctions` | S, C | Chủ hàng: phiên của tôi theo trạng thái. Chủ xe: tìm phiên, lọc, sắp xếp |
| `/auctions/new` | S | Tạo phiên 4 bước, chọn kho từ sổ địa chỉ, ảnh hàng hóa, khóa chống tạo trùng |
| `/auctions/[id]` | S, C | Chủ hàng: giá đã đặt, chọn người thắng (phiên kín), hủy phiên, tiến trình trao thầu. Chủ xe: đăng ký và thanh toán, phòng đấu giá, kết quả |
| `/registrations` | C | Phiên đã đăng ký: thanh toán lại, vào phòng, hủy đăng ký, thắng/thua |
| `/(tabs)/trips`, `/business/trips/[tripId]` | S, C | Theo dõi đơn hàng; xác nhận nhận hàng, hủy do trễ, phân công và PIN, ghi mốc, bằng chứng, sự cố, cột mốc, xử lý giao trễ |
| `/contracts`, `/contracts/[id]` | S, C | Danh sách, chi tiết, chữ ký, ký hợp đồng |
| `/(tabs)/wallet` | S, C | Số dư, nạp SePay, rút tiền, lịch sử và chi tiết giao dịch |
| `/(tabs)/fleet`, `/fleet/vehicle/[id]`, `/fleet/driver/[id]` | C | Xe và tài xế: thêm, sửa, tài liệu, ngừng/xóa, nhập CSV |
| `/addresses` | S | Sổ địa chỉ kho |
| `/carriers/[id]` | S | Hồ sơ công khai và điểm uy tín của nhà xe |
| `/complaints`, `/complaints/[id]` | S, C | Tạo theo loại vấn đề, lọc, trao đổi |
| `/(tabs)/notifications` | cả ba | Danh sách, đánh dấu đã đọc, mở đúng màn |
| `/company` | S, C | Người đại diện và hồ sơ doanh nghiệp (tra MST, giấy phép, ủy quyền) |
| `/verification` | S, C | Quét QR và đọc căn cước gắn chip bằng NFC |
| `/(tabs)/history`, `/trips/[tripId]`, `/trips/[tripId]/milestones` | D | Lịch sử, thực hiện chuyến, check-in cột mốc |

Thanh toán SePay mở trong WebView (`react-native-webview`); số dư chỉ cập nhật khi máy chủ báo đơn đã thanh toán. Ảnh bằng chứng, ảnh hàng hóa và ảnh khiếu nại đọc qua media-service có đăng nhập; giấy tờ xe, tài xế và doanh nghiệp không hiển thị lại trong app.

## SDK NFC Android

SDK artifacts được vendoring trong [vendor/nfc-sdk](vendor/nfc-sdk/README.md). Không cần publish hoặc truy cập repo SDK riêng để build app.

1. Trong repo này, chạy `npm install` và `npx expo prebuild --platform android`.
2. Đặt `JAVA_HOME` tới JDK 17, `ANDROID_HOME` tới Android SDK; chạy `npx expo run:android`. Android tối thiểu API 26.
3. Bật `NFC_EKYC_ENABLED=true` cho identity-service trong môi trường local cần kiểm tra NFC. Mặc định cờ tắt.

SDK dùng local Expo Module và Maven metadata; không chạy trong Expo Go hoặc trình duyệt. Model phát triển nằm trong `vendor/nfc-sdk/debug-assets` và chỉ được gắn vào debug build; bản release không đóng gói các model này. Thiết bị Android cần NFC đang bật và camera. Khi dùng điện thoại thật, cấu hình gateway bằng IP LAN của máy tính; có thể dùng `adb reverse tcp:8080 tcp:8080` cùng `http://localhost:8080` nếu thiết bị đã kết nối ADB. Release yêu cầu HTTPS.

### Build APK tự chứa để test qua Wi-Fi

APK Dev Client lấy JavaScript từ Metro. Để cài bản test mở độc lập, dùng script dưới đây; APK chứa JavaScript/Hermes và không cần Metro. Điện thoại và máy tính phải dùng cùng mạng Wi-Fi, backend phải truy cập được từ điện thoại.

```powershell
npx expo prebuild --platform android --no-install
.\scripts\build-wifi-test.ps1
```

Script đọc `EXPO_PUBLIC_API_BASE_URL` trong `.env`, xác nhận đây là HTTP origin với IPv4 private, chạy unit test của native eKYC module rồi build ARM64. APK được ghi vào `.expo/test-builds/BackHaulBid-android-arm64-wifi.apk`. Android tối thiểu 8.0 (API 26). Nếu IP máy tính đổi, sửa `.env` hoặc truyền origin mới:

```powershell
.\scripts\build-wifi-test.ps1 -GatewayOrigin http://192.168.1.42:8080
```

Script cũng nhận `-BuildJavaHome`, `-GradleUserHome` và `-AndroidSdkPath` nếu môi trường build không nằm ở vị trí mặc định. Cài APK bằng cách chép file sang điện thoại hoặc chạy `adb install -r .expo/test-builds/BackHaulBid-android-arm64-wifi.apk` khi đã kết nối ADB.

Lệnh Gradle `:app:assembleDebug` tạo build phát triển, không tự nhúng JavaScript; cần Metro để mở app. Dùng script `build-wifi-test.ps1` khi cần APK tự chứa.

Origin gateway được dùng cho cả JavaScript và native upload. HTTP Wi-Fi chỉ được chấp nhận trong debug, đúng IPv4 private và cổng đã cấu hình khi build qua `BACKHAULBID_DEBUG_API_ORIGIN`. Bản release tiếp tục yêu cầu HTTPS. Quyền CAMERA/NFC và đăng nhập cùng tài khoản trên web/app vẫn bắt buộc.

Mở web trên máy tính tại `http://localhost:3000`, vào xác thực người đại diện để tạo QR. Trên app, đăng nhập cùng tài khoản Chủ hàng/Chủ xe, mở màn xác thực và quét QR; nhập mã app hiển thị vào web để cho phép điện thoại thu thập. Tài xế dùng cùng APK với màn nhận chuyến bằng PIN riêng.

Chip và ảnh được native SDK đọc, backend quyết định trạng thái. Chế độ tự chấp nhận NFC chỉ dành cho profile local và phải được cấu hình ở identity-service; đây là chấp nhận nghiệp vụ để phát triển, không phải xác minh chính thức bởi cơ quan nhà nước. Ở chế độ mặc định `DISABLED`, hồ sơ cần luồng duyệt được cấu hình phía server. Server lưu tạm bằng chứng đã mã hóa theo thời hạn lưu, không lưu raw DG/SOD/MRZ/APDU. Các giá trị cấu hình nằm ở identity-service trong backend.

## Quy tắc nghiệp vụ (theo contract-service)

- Tài xế ghi `journey-events` (nhận chuyến, đến điểm lấy, đã lấy hàng, bắt đầu chạy, đến điểm giao) và `delivery-proofs`.
- Chủ xe phân công trên web hoặc app, gửi **UUID chuyến đầy đủ + PIN 6 số**. Tài xế bấm “Nhận chuyến bằng PIN” trong tab Chuyến. Server tự ghi mốc nhận chuyến và cấp quyền cho tài khoản đã nhận.
- PIN dùng một lần, hạn 24 giờ, khóa sau 5 lần sai. Cấp lại PIN/phân công lại thu hồi quyền tài khoản cũ. PIN chỉ nằm trong form tạm thời, không lưu vào session hay log.
- Cần contract-service áp **V20**. Chuyến phân công trước migration phải được Chủ xe cấp PIN mới; không cần liên kết lâu dài Account với DriverProfile.
- Báo đã giao = tải ảnh lên media-service → `POST delivery-proofs` → sự kiện `DELIVERY_PROOF_SUBMITTED` chuyển `DELIVERED`. Nếu bước cuối lỗi, "Thử lại" không tải ảnh lần hai.
- Tài xế **không** hoàn thành hay hủy chuyến; chủ hàng xác nhận hoàn thành trên web hoặc app.
- Bước đổi trạng thái luôn có hộp xác nhận và chỉ báo thành công khi máy chủ trả lời. Riêng GPS có queue tối đa 120 điểm/30 phút; thao tác nghiệp vụ không xếp hàng offline.

## Phiên đăng nhập

- Token lưu bằng `expo-secure-store` (web: `sessionStorage`). Request thường chỉ gửi `Authorization: Bearer`; cookie chỉ dùng cho login/refresh/logout vì gateway ưu tiên cookie.

## Giới hạn đã biết

- Đã kiểm tra export và luồng trên Expo web qua gateway local; chưa kiểm tra trên thiết bị Android/iOS native.
- Ảnh bằng chứng đọc qua `GET /api/v1/media/files/{folder}/{file}` của media-service (cần đăng nhập); bucket S3 vẫn riêng tư. Giấy tờ doanh nghiệp/định danh không đọc qua đường này.
- Dữ liệu demo theo dõi đơn hàng: `backhaulbid-demo-data/order-tracking`.
- Phòng đấu giá trên app hỏi lại máy chủ mỗi 4 giây thay vì dùng socket realtime như web; mọi giá vẫn do máy chủ quyết định.
- `react-native-webview` và `expo-document-picker` là module native mới: cần build lại APK/dev client, Expo Go cũ không có.
- Tạo phiên chọn thời gian theo ngày và bước 15 phút/1 giờ (không dùng date picker native).

## Khắc phục lỗi Android

- Nếu APK Dev Client chỉ đứng ở splash, chạy `npm run start -- --dev-client --lan`, giữ Metro hoạt động và kiểm tra điện thoại tới được máy tính. APK Dev Client cần tải JavaScript từ Metro.
- Nếu cần APK mở được mà không chạy Metro, build bằng `scripts/build-wifi-test.ps1`; không dùng APK debug tạo trực tiếp bằng `:app:assembleDebug` cho mục đích đó.
- Nếu màn đăng nhập đã hiện nhưng không gọi được backend, kiểm tra `EXPO_PUBLIC_API_BASE_URL`, gateway port `8080`, firewall và việc điện thoại cùng mạng với máy tính.
