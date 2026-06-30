# 📱 BackHaulBid Driver App

> **Mobile Application Dành Cho Tài Xế (Expo / React Native)**
>
> BackHaulBid Driver App là dự án di động dành cho tài xế được khởi tạo bằng Expo SDK 54 sử dụng Expo Router. Dự án đã được chuyển đổi hoàn toàn sang JavaScript/JSX, cấu hình sẵn path alias và GitHub Actions CI.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

*   **Framework chính**: ![Expo](https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white) / ![React Native](https://img.shields.io/badge/React_Native-61DAFB?style=flat-square&logo=react&logoColor=black) (Expo Router SDK 54)
*   **Điều hướng (Navigation)**: Expo Router (File-based Routing)
*   **Quản lý giao diện (Styling)**: React Native StyleSheet / Themed Components
*   **Hiệu ứng (Animations)**: React Native Reanimated

---

## 🚀 Kích Hoạt Dự Án (Getting Started)

1.  **Cài đặt các gói thư viện Node.js:**
    ```bash
    npm install
    ```

2.  **Khởi động Metro Bundler (Expo):**
    ```bash
    npm start
    ```

3.  **Khởi chạy ứng dụng trên máy ảo hoặc thiết bị kiểm thử:**
    *   **Đối với hệ điều hành Android**:
        ```bash
        npm run android
        ```
    *   **Đối với hệ điều hành iOS**:
        ```bash
        npm run ios
        ```
    *   **Đối với phiên bản Web**:
        ```bash
        npm run web
        ```

---

## 📂 Cơ Cấu Thư Mục (Project Structure)

```text
backhaulbid-driver-app/
├── .github/             # Cấu hình GitHub Actions CI
│   └── workflows/
│       └── ci-mobile.yml # Workflow tự động kiểm tra build trên GitHub
├── app/                 # Thư mục mã nguồn các trang/màn hình (Expo Router)
│   ├── (tabs)/          # Luồng điều hướng chính dạng Tabs (Tab One, Tab Two)
│   │   ├── _layout.jsx
│   │   ├── index.jsx
│   │   └── two.jsx
│   ├── +html.jsx        # Thiết lập root HTML cho nền tảng Web
│   ├── +not-found.jsx   # Màn hình thông báo khi không tìm thấy trang
│   ├── _layout.jsx      # Thiết lập Root Layout (ThemeProvider, Font, SplashScreen)
│   └── modal.jsx        # Màn hình Modal ví dụ
├── assets/              # Thư mục chứa hình ảnh tĩnh, phông chữ hệ thống
├── components/          # Các component giao diện dùng chung (Themed, ExternalLink...)
├── constants/           # Định nghĩa màu sắc và hằng số của hệ thống (Colors.js)
├── jsconfig.json        # Cấu hình nhận diện path alias cho JavaScript (@/*)
├── package.json         # Danh sách thư viện liên kết và câu lệnh script
└── README.md
```
