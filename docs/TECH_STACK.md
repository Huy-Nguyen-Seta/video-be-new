# Lý do chọn tech stack

## NestJS

Bài toán này nhiều feature (auth, video, comment, user, storage, queue) và cross-cutting concern (auth guard, rate limit, validate, error format). Express  thì mấy thứ đó phải tự dựng và dễ làm mỗi chỗ một kiểu.

Nest cho sẵn DI + module nên:
- Logic tách khỏi controller, dễ test (mock service).
- Guard/Interceptor/Pipe/Filter áp toàn cục một chỗ (`app.module.ts`).
- Worker dùng lại nguyên service của API qua DI, không phải viết lại.

Đánh đổi: Nest nặng và "nhiều tính năng" hơn Express. Với một service nhỏ thì hơi thừa, nhưng ở quy mô nhiều feature/nhiều người làm thì cấu trúc rõ ràng đáng giá hơn.

## PostgreSQL (thay vì MongoDB)

Dữ liệu ở đây **quan hệ rõ**: user sở hữu video, video có comment, comment reply comment, refresh token thuộc user. Cần join, cần transaction (list + count chạy trong một `$transaction`), cần ràng buộc khoá ngoại + cascade delete.

Mấy thứ này Postgres làm tự nhiên. MongoDB hợp document phi cấu trúc hơn — ở đây sẽ phải tự lo nhất quán quan hệ ở tầng app, không đáng.

Postgres còn dư đường scale đọc bằng read replica, và có full-text search built-in khi cần.

## Prisma (thay vì TypeOR)

- Migration tự sinh từ schema, lịch sử rõ ràng.
- Type-safe tới tận kết quả query — sai tên cột là fail lúc compile, không phải lúc chạy.
- `schema.prisma` đọc như một sơ đồ, vừa làm code vừa làm tài liệu.

So với TypeORM: Prisma ít "magic decorator", schema tập trung một file, trải nghiệm migration tốt hơn. Đánh đổi: Prisma kén mấy query siêu phức tạp — lúc đó dùng `$queryRaw` (đã dùng cho health check).

## Redis (làm 3 việc bằng 1 hạ tầng)

1. **Cache** danh sách video + video hot (TTL ngắn).
2. **Đếm view** — `INCR` counter + dedupe `SET NX EX`, gom rồi flush xuống DB theo lô.
3. **Broker cho BullMQ**.

Một service lo cả ba, đỡ phải thêm hạ tầng. Đây là lý do chọn BullMQ thay vì một message queue riêng (RabbitMQ/Kafka) — tránh thêm một thứ phải vận hành khi Redis đã có sẵn.

## BullMQ (thay vì xử lý đồng bộ / RabbitMQ / Kafka)

Upload video xong không thể bắt client đứng đợi transcode. Phải đẩy việc nặng sang nền.

BullMQ chạy trên Redis (đã có), cho sẵn retry + exponential backoff + concurrency + lưu lịch sử job. Đủ cho nhu cầu hiện tại.

- **RabbitMQ/Kafka** mạnh hơn nhiều nhưng là thêm một cụm phải vận hành. Chưa cần ở quy mô này. Khi job lên rất lớn hoặc cần fan-out nhiều consumer group thì mới tính Kafka.
- Xử lý **đồng bộ** thì đơn giản nhưng chặn event loop và không retry được — loại.

## MinIO (thay vì lưu file vào DB / disk local)

Video là blob lớn, không nhét vào Postgres. Lưu disk local thì không scale ngang được (mỗi pod một ổ đĩa khác nhau).

MinIO là **S3-compatible**: dev chạy local trong Docker, production đổi `MINIO_ENDPOINT` + key sang AWS S3 (hoặc R2, GCS...) là xong, **không sửa code**. Bọc trong `StorageService` nên chỗ gọi cũng không biết phía sau là MinIO hay S3.

## JWT access + refresh (thay vì session lưu DB)

- **Access token** ngắn hạn (15 phút), stateless — mọi API pod verify được bằng secret, không phải hỏi DB mỗi request. Đây là thứ giúp scale ngang phần đọc.
- **Refresh token** hash lưu DB — bù lại nhược điểm "JWT không revoke được": logout/đổi máy thì revoke trong bảng, và mỗi lần refresh là rotate token mới.

Session lưu DB/Redis thì mỗi request phải tra store — đúng nhưng tốn một round-trip cho phần nóng nhất. Cách lai này lấy stateless cho phần đọc, stateful cho phần nhạy cảm.

## pino (thay vì Winston / console.log)

JSON log, throughput cao, overhead thấp. Production xuất JSON một dòng để Loki/ELK parse; dev thì `pino-pretty` cho dễ đọc. Tự redact `authorization` header để không lộ token vào log.

## Tóm tắt một dòng

> Postgres cho dữ liệu quan hệ, Redis cho mọi thứ cần nhanh và tạm thời, BullMQ + worker tách process cho việc nặng, MinIO cho file, JWT cho auth stateless. Mọi lựa chọn đều ưu tiên **scale ngang được** và **đổi nhà cung cấp không phải sửa code**.
