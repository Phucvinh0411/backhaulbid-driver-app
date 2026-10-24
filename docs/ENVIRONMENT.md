# Cấu hình môi trường app

Ứng dụng đọc cấu hình Expo từ file `.env` trong `fe/backhaulbid-driver-app`. File `.env` là cấu hình riêng của máy phát triển; không commit file này.

## Tạo file cấu hình

Nếu chưa có `.env`, sao chép mẫu:

```powershell
Copy-Item .env.example .env
```

Sau đó đặt `EXPO_PUBLIC_API_BASE_URL` thành địa chỉ gateway mà thiết bị chạy app có thể truy cập:

| Nơi chạy app | Ví dụ origin |
| --- | --- |
| Android Emulator | `http://10.0.2.2:8080` |
| Điện thoại Android thật cùng Wi-Fi với máy tính | `http://<IP-LAN-của-máy-tính>:8080` |
| Expo Web chạy trên chính máy tính | `http://localhost:8080` |

`EXPO_PUBLIC_MAP_TILE_URL` là mẫu URL tile bản đồ. Có thể giữ giá trị trong `.env.example` nếu dùng OpenStreetMap.

## Thay đổi địa chỉ backend

Lấy IPv4 của card Wi-Fi trên máy tính, đặt origin đó trong `.env`, rồi khởi động lại Metro hoặc build lại APK tự chứa để giá trị mới được nhúng vào JavaScript. Điện thoại và máy tính phải cùng mạng; gateway port `8080` phải được mở cho thiết bị truy cập.

Script `scripts/build-wifi-test.ps1` cũng nhận `-GatewayOrigin http://<IP-LAN>:8080`. Script chỉ chấp nhận origin HTTP dùng IPv4 private cho APK debug. Bản release phải dùng HTTPS.

## Bảo vệ cấu hình

Các biến có tiền tố `EXPO_PUBLIC_` được đưa vào JavaScript bundle và có thể được đọc từ app đã cài. Chỉ đặt URL và cấu hình công khai ở đây; không đặt mật khẩu, token, khóa ký hay thông tin nhà cung cấp. Secret phải nằm ở backend.

Thay đổi `.env` không cần sửa source. Sau khi đổi, restart Metro để bundle mới nhận cấu hình; APK đã build trước đó vẫn giữ origin cũ.
