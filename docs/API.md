# API Reference

Base URL: `/api/v1` (global prefix `api` + URI versioning `v1`).


## Quy ước chung

**Auth:** gửi access token qua header `Authorization: Bearer <accessToken>`. Refresh token được set sẵn trong cookie `refreshToken` (httpOnly) sau khi login/register.

**Response envelope** — mọi response thành công được `TransformInterceptor` bọc lại:

```jsonc
// đơn lẻ
{ "success": true, "data": { ... } }

// có phân trang
{ "success": true, "data": [ ... ], "meta": { "page": 1, "limit": 12, "total": 40, "totalPages": 4, "hasNext": true, "hasPrevious": false } }
```

**Lỗi** — `AllExceptionsFilter` chuẩn hoá về một format thống nhất kèm HTTP status tương ứng (400 validate, 401 chưa auth, 403 không có quyền, 404 không tìm thấy, 429 rate limit).

**Rate limit:** mặc định 120 req / 60s mỗi IP. Riêng `POST /auth/login` là 10 req / 60s.

---

## Auth

### POST /auth/register  · public
Đăng ký. Set cookie refresh token, trả access token.
```jsonc
// body
{ "email": "huy@dev.com", "name": "Huy", "password": "secret123" }
// 201
{ "success": true, "data": { "user": { "id", "email", "name", "role" }, "accessToken": "..." } }
```
Ràng buộc: `email` hợp lệ, `name` 2–50 ký tự, `password` 6–80 ký tự.

### POST /auth/login  · public · 10 req/60s
```jsonc
{ "email": "huy@dev.com", "password": "secret123" }
// 200 -> { user, accessToken } + cookie refreshToken
```

### POST /auth/refresh  · public
Lấy access token mới từ refresh token (đọc trong cookie, hoặc trong body nếu không có cookie). Token cũ bị revoke, phát token mới (rotation).
```jsonc
// body (optional nếu đã có cookie)
{ "refreshToken": "..." }
// 200 -> { accessToken }
```

### POST /auth/logout  · cần auth
Revoke refresh token hiện tại và xoá cookie.

### GET /auth/me  · cần auth
Thông tin user đang đăng nhập.

---

## Users  · tất cả cần auth

### GET /users/me
Profile của chính mình.

### PATCH /users/me
```jsonc
{ "name": "Tên mới" }   // 2–60 ký tự
```

### POST /users/me/password
```jsonc
{ "currentPassword": "...", "newPassword": "..." }   // newPassword >= 6 ký tự
```

### POST /users/me/avatar  · multipart/form-data
Field `file`, ảnh tối đa 2MB. Upload lên storage, trả URL avatar.

---

## Videos

### GET /videos  · public
Danh sách video, có phân trang + filter + sort. Kết quả cache 30s.

Query params:

| Param | Mặc định | Ghi chú |
|---|---|---|
| `page` | 1 | |
| `limit` | 12 | tối đa 100 |
| `sortBy` | `createdAt` | một trong `createdAt`, `viewCount`, `title` |
| `order` | `desc` | `asc` / `desc` |
| `search` | — | tìm gần đúng theo title |
| `status` | — | `PROCESSING` / `READY` / `FAILED` |
| `ownerId` | — | lọc theo chủ video |

### GET /videos/hot  · public
Top 10 video nhiều view nhất (chỉ `READY`). Cache theo `HOT_VIDEO_CACHE_TTL`.

### GET /videos/:id  · public
Chi tiết một video. `viewsCount` đã cộng cả phần view đang pending trong Redis.

### GET /videos/:id/view  · public
Ghi nhận một lượt xem. Dedupe theo IP trong 30 phút.
```jsonc
{ "success": true, "data": { "counted": true } }   // false nếu đã xem trong 30 phút
```

### POST /videos  · cần auth · multipart/form-data
Upload video. Field `file` (mp4/webm/quicktime, tối đa 200MB) + `title` (bắt buộc, 2–100 ký tự) + `description` (optional).

Trả về record với `status: PROCESSING`. Worker xử lý nền; poll lại `GET /videos/:id` đến khi `READY`.

### PATCH /videos/:id  · cần auth (owner hoặc admin)
Sửa `title` / `description`.

### DELETE /videos/:id  · cần auth (owner hoặc admin)
Xoá record + xoá file trên storage.

---

## Comments

> Lưu ý route: controller có prefix `comments` nên đường dẫn hơi lặp (`/comments/videos/...`, `/comments/comments/...`). Giữ đúng như code hiện tại.

### GET /comments/videos/:videoId/comments  · public
List comment của một video (phân trang). Comment gốc có `parentId = null`, reply trỏ về comment cha.

### POST /comments/videos/:videoId/comments  · cần auth
```jsonc
{ "content": "Nội dung", "parentId": "<uuid comment cha, optional khi reply>" }
```

### PATCH /comments/comments/:id  · cần auth (chủ comment)
```jsonc
{ "content": "Nội dung sửa" }
```

### DELETE /comments/comments/:id  · cần auth (chủ comment)
Xoá comment (cascade xoá reply).

---

## Health  · public

| Endpoint | Trả về | Dùng để |
|---|---|---|
| `GET /health` | `{ status: "ok" }` | liveness — process còn sống |
| `GET /health/ready` | `{ status: "ready" }` hoặc `not ready` | readiness — ping được Postgres + Redis |

> `liveness` để orchestrator biết có cần restart pod không; `readiness` để biết có nên route traffic vào pod chưa (vd DB chưa kết nối thì chưa nhận request).
