# video-be

Backend cho một service kiểu YouTube thu nhỏ: user đăng ký/đăng nhập, upload video, video được đưa vào hàng đợi để xử lý (transcode/sinh thumbnail), người khác xem được, đếm view và comment.

Viết bằng NestJS + Prisma + PostgreSQL, dùng Redis cho cache + đếm view, BullMQ cho việc xử lý video chạy nền, và MinIO (S3-compatible) để lưu file.

## Mục lục

- [Tech stack & lý do chọn](#tech-stack--lý-do-chọn)
- [Chạy nhanh bằng Docker](#chạy-nhanh-bằng-docker)
- [Chạy local để dev](#chạy-local-để-dev)
- [Biến môi trường](#biến-môi-trường)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Kiến trúc & các quyết định kỹ thuật](#kiến-trúc--các-quyết-định-kỹ-thuật)
- [Tài liệu chi tiết](#tài-liệu-chi-tiết)
- [Những chỗ còn dở / nếu có thêm thời gian](#những-chỗ-còn-dở--nếu-có-thêm-thời-gian)

## Tech stack & lý do chọn

| Thành phần | Dùng gì | Tại sao |
|---|---|---|
| Framework | **NestJS 11** (TypeScript) | Module/DI rõ ràng, dễ tách feature, có sẵn guard/interceptor/pipe nên không phải tự dựng. Hợp với codebase nhiều người làm chung. |
| Database | **PostgreSQL 16** | Quan hệ user–video–comment rõ ràng, cần transaction (list + count), index trên nhiều cột. Postgres ổn định và đủ mạnh để scale bằng read replica sau này. |
| ORM | **Prisma 6** | Migration tự sinh, type-safe tới tận query. Đỡ được cả mảng lỗi typo cột lúc compile. |
| Cache + đếm view | **Redis (ioredis)** | Cache list/hot video, dedupe view bằng `SET NX EX`, và làm broker cho BullMQ luôn. Một hạ tầng làm 3 việc. |
| Job queue | **BullMQ** | Upload xong phải trả response ngay, việc nặng (transcode) đẩy sang worker. BullMQ có retry + backoff + concurrency sẵn, chạy trên Redis đang có. |
| Object storage | **MinIO** | S3-compatible nhưng chạy được local trong Docker. Lên production đổi endpoint sang S3 thật là xong, không phải sửa code. |
| Auth | **JWT access + refresh token** | Access token ngắn (15 phút) cho stateless scale ngang; refresh token lưu hash trong DB để revoke được (logout, đổi máy). |
| Log | **pino** (`nestjs-pino`) | JSON log, nhanh, hợp để bắn lên ELK/Loki. |

Chi tiết hơn xem [docs/TECH_STACK.md](docs/TECH_STACK.md).

## Chạy nhanh bằng Docker

Cách nhanh nhất, không cần cài gì ngoài Docker:

```bash
cp .env.example .env        # nếu chưa có .env
docker compose up --build
```

Lệnh này dựng đủ Postgres, Redis, MinIO, API và worker. `RUN_MIGRATIONS=true` nên migration + seed chạy tự động lúc container API khởi động (xem `docker-entrypoint.sh`).

Sau khi lên:

- API: http://localhost:4000/api/v1
- Health: http://localhost:4000/api/v1/health
- MinIO console: http://localhost:9001 (user/pass: `minioadmin`)

Kiểm tra nhanh:

```bash
curl http://localhost:4000/api/v1/health
# {"status":"ok"}
```

## Chạy local để dev

Cần Node 20+, và Postgres/Redis/MinIO đang chạy (dễ nhất là `docker compose up postgres redis minio`).

```bash
npm install
cp .env.example .env          # rồi sửa lại cho khớp máy mình
npm run prisma:generate
npm run prisma:migrate:dev    # tạo schema
npm run prisma:seed           # tạo vài user/video mẫu (optional)

# Terminal 1 — API
npm run start:dev

# Terminal 2 — worker xử lý video
npm run worker:dev
```

API và worker là **hai process tách biệt** — đây là cố ý, xem phần kiến trúc.

Test:

```bash
npm test          # unit
npm run test:cov  # coverage
```

## Biến môi trường

Đây là các biến code thực sự đọc (tên trong bảng là tên đúng cần set):

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `NODE_ENV` | `development` | `production` thì bật secure cookie, tắt pretty log |
| `PORT` | `4000` | |
| `CORS_ORIGIN` | `http://localhost:5173` | cho nhiều origin thì ngăn cách bằng dấu phẩy |
| `DATABASE_URL` | — | **bắt buộc**, connection string Postgres |
| `JWT_ACCESS_SECRET` | — | **bắt buộc** |
| `JWT_ACCESS_TTL` | `900s` | tuổi access token |
| `JWT_REFRESH_SECRET` | — | **bắt buộc** |
| `JWT_REFRESH_TTL` | `7d` | tuổi refresh token |
| `REDIS_HOST` | `localhost` | **bắt buộc** (env validation) |
| `REDIS_PORT` | `6379` | |
| `MINIO_ENDPOINT` | `localhost` | |
| `MINIO_PORT` | `9000` | |
| `MINIO_USE_SSL` | `false` | |
| `MINIO_ACCESS_KEY` | `minioadmin` | |
| `MINIO_SECRET_KEY` | `minioadmin` | |
| `MINIO_BUCKET` | `videos` | tự tạo nếu chưa có |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | base URL public để build link video |
| `RATELIMIT_TTL` | `60` | cửa sổ rate limit (giây) |
| `RATELIMIT_MAX` | `120` | số request / cửa sổ |
| `HOT_VIDEO_CACHE_TTL` | `60` | TTL cache danh sách video hot (giây) |
| `ENABLE_VIEW_FLUSH` | `false` | bật cron flush view từ Redis xuống DB. **Phải set `true` ở đúng 1 process** (xem dưới) |
| `RUN_MIGRATIONS` | `false` | chỉ dùng trong Docker: tự chạy `migrate deploy` + seed lúc start |

`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_HOST` được validate lúc boot (`src/config/env.validation.ts`) — thiếu là app không lên, cố tình để fail-fast thay vì chạy với secret mặc định.

## Cấu trúc thư mục

```
src/
├── main.ts                 # bootstrap API (helmet, cors, versioning, global pipe)
├── worker.ts               # process riêng cho BullMQ worker
├── app.module.ts           # wiring toàn cục: guard, filter, interceptor, throttler
│
├── config/                 # load + validate env
├── prisma/                 # PrismaService (kết nối DB)
├── redis/                  # Redis client + helper cache (getJson/setJson/delByPattern)
│
├── common/                 # đồ dùng chung, không thuộc feature nào
│   ├── guards/             # JWT auth guard, roles guard
│   ├── decorators/         # @Public, @Roles, @CurrentUser
│   ├── filters/            # all-exceptions filter (chuẩn hoá error response)
│   ├── interceptors/       # transform interceptor (chuẩn hoá success response)
│   └── dto/                # pagination dùng chung
│
└── modules/                # các feature, mỗi cái 1 module
    ├── auth/               # register/login/refresh/logout + JWT strategy
    ├── users/              # profile, đổi mật khẩu, avatar
    ├── videos/             # CRUD video, list/hot, đếm view, gọi queue
    ├── comments/           # comment + reply lồng nhau
    ├── storage/            # bọc MinIO (upload/remove/urlFor)
    └── queue/              # producer + processor cho BullMQ
```

Quy ước: mỗi feature gói trong một module với controller (route) + service (logic) + dto (validate input). Logic không bao giờ nằm trong controller.

## Kiến trúc & các quyết định kỹ thuật

Sơ đồ đầy đủ ở [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), tóm tắt ở đây:

**1. API và worker tách process.** Cùng codebase (`AppModule`) nhưng hai entrypoint: `main.ts` chạy HTTP server, `worker.ts` chỉ tạo application context rồi mở BullMQ Worker. Lý do: việc transcode nặng CPU không được làm nghẽn event loop của API. Tách ra thì scale độc lập — nhiều API pod cho traffic đọc, vài worker pod cho việc nặng.

**2. Upload là bất đồng bộ.** `POST /videos` lưu file lên MinIO, tạo record status `PROCESSING`, đẩy job vào queue rồi trả về luôn. Client poll lại bằng `GET /videos/:id` để thấy status đổi sang `READY`. Producer set `attempts: 3` + exponential backoff, fail thì worker đánh dấu video `FAILED`.

**3. Đếm view không đụng DB mỗi request.** Mỗi view `INCR` một counter trong Redis, dedupe theo (IP + videoId) trong 30 phút bằng `SET NX EX`. Một cron trong service flush các counter này xuống DB mỗi 10 giây bằng `updateMany increment`. Đổi từ "mỗi view = 1 UPDATE" thành "gom N view = 1 UPDATE", giảm tải DB rất nhiều cho video hot. Khi đọc chi tiết video thì cộng thêm phần view đang pending trong Redis để số hiển thị không bị trễ.

> Cái cron flush này phải bật ở **đúng một process** (`ENABLE_VIEW_FLUSH=true`), nếu bật ở nhiều API pod thì chúng cùng `getdel` đua nhau — vẫn không mất view (atomic) nhưng thừa. Hợp lý nhất là để worker giữ vai trò flush.

**4. Cache đọc.** List video và danh sách "hot" cache trong Redis TTL ngắn (30s / 60s). Khi có create/update/delete thì xoá cache theo pattern (`delByPattern`). Chấp nhận dữ liệu cũ vài chục giây để đổi lấy việc đỡ DB.

**5. Auth có thể revoke.** Access token JWT ngắn hạn, stateless. Refresh token thì hash bằng SHA-256 lưu trong bảng `refesh_tokens`, mỗi lần refresh là revoke token cũ và phát token mới (rotation). Logout revoke token. Nhờ vậy stateless cho phần đọc nhưng vẫn kiểm soát được session.

**6. Guard toàn cục, mở route bằng decorator.** `JWTAuthGuard` áp cho mọi route; route nào public thì gắn `@Public()`. An toàn theo kiểu "mặc định khoá, mở có chủ đích" — quên đánh dấu thì route bị khoá chứ không bị hở.

## Tài liệu chi tiết

| File | Nội dung |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Sơ đồ kiến trúc, luồng upload/xem/đếm view |
| [docs/DATABASE.md](docs/DATABASE.md) | Sơ đồ ERD, mô tả bảng, lý do đặt index |
| [docs/API.md](docs/API.md) | Toàn bộ endpoint, request/response mẫu |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Lý do chọn từng công nghệ + các phương án đã cân nhắc |
| [docs/SCALING.md](docs/SCALING.md) | Scale lên 1M user, xử lý 100k request đồng thời |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Deploy production, backup DB, monitoring, logging, rollback |

