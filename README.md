# BSN iSync

Công cụ đồng bộ hóa và quản lý chạy dự án .NET siêu tốc, hỗ trợ tự động rebuild, quản lý profile và auto-update.

## Tính năng chính

- **Quản lý Profile**: Lưu cấu hình riêng cho từng dự án (Workspace, Startup Project, Build Config, SQL Setup...).
- **Biến số tùy chỉnh**: Định nghĩa các biến `{{key}}` để sử dụng linh hoạt trong các tham số.
- **Terminal tích hợp**: Tự động phát hiện thay đổi source code và rebuild trước khi chạy.
- **Hỗ trợ ReceiveBatchAction**: Tự động build project RBA đi kèm nếu có thay đổi.
- **Auto-Update**: Tự động thông báo và cập nhật khi có phiên bản mới từ GitHub.
- **Chia sẻ Profile**: Xuất/Nhập profile dưới dạng file JSON dễ dàng.

## Cài đặt & Sử dụng

1. Tải bản cài đặt mới nhất tại: [BSN iSync Download](https://ngtuonghy.github.com/bsn_isync/)
2. Chạy file exe/msi để cài đặt.
3. Mở ứng dụng, chọn thư mục dự án và bắt đầu cấu hình profile.

## Dành cho Nhà phát triển

### Yêu cầu
- Node.js & Bun
- Rust (cho Tauri)
- .NET SDK (để build/run dự án mục tiêu)

### Lệnh hữu ích
- `npm run dev`: Chạy app ở chế độ phát triển.
- `npm run tauri build`: Build bản phát hành (release).
- `npm run bump`: Tăng version tự động cho toàn dự án.

## Liên hệ
Phát triển bởi **ngtuonghy**.
