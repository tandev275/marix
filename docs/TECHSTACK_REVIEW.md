# Marix — Tech Lead Review & Đề xuất Tech Stack để "build lại nhẹ & nhanh hơn"

> Tài liệu này review kiến trúc/tech stack hiện tại của Marix và đề xuất lộ trình
> build lại để ứng dụng chạy **nhẹ hơn, khởi động nhanh hơn, tốn ít RAM hơn** trên
> **Ubuntu / Windows**, trong khi giữ nguyên toàn bộ tính năng.
>
> Ngày review: 2026-07-14 · Phiên bản hiện tại: `2.0.1`

---

## 1. Tóm tắt cho người bận rộn (TL;DR)

- **Vấn đề cốt lõi không phải React hay TypeScript — mà là Electron.** Mỗi bản
  cài đóng gói nguyên một Chromium + Node.js (~150–220 MB cài đặt, ~150–300 MB RAM
  chỉ để mở cửa sổ trống). Đây là nguồn gốc của "nặng & chậm".
- **Đề xuất chính (khuyến nghị): chuyển sang Tauri 2** (webview hệ điều hành +
  backend Rust). Giữ lại gần như toàn bộ frontend React/TypeScript hiện có. Kết
  quả kỳ vọng: **installer ~8–15 MB** (giảm ~90%), **RAM lúc idle giảm 50–70%**,
  **thời gian khởi động nhanh hơn 2–4×**.
- **Chi phí thật sự nằm ở backend:** 33 service trong `src/main` (SSH, SFTP, RDP,
  DB client, cloud sync…) hiện viết bằng Node.js với native module. Chuyển sang
  Tauri nghĩa là viết lại lớp này bằng Rust (đã có crate tương đương trưởng thành
  cho hầu hết) — đây là phần tốn công nhất.
- **Không nên "big-bang rewrite".** Đề xuất lộ trình **strangler-fig 4 giai đoạn**:
  frontend giữ nguyên, backend port dần theo module, mỗi giai đoạn vẫn ra được bản
  chạy được.
- **Có phương án rẻ hơn** nếu không muốn động vào Rust: tối ưu ngay trên Electron
  (mục §7) — cải thiện 20–40% nhưng **không bao giờ chạm được mức nhẹ của Tauri**.

---

## 2. Kiến trúc & tech stack hiện tại

### 2.1 Stack

| Lớp | Công nghệ hiện tại |
|-----|--------------------|
| Runtime desktop | **Electron 42** (Chromium + Node.js đóng gói) |
| UI | **React 19**, TypeScript 5.9, **Tailwind CSS 4** |
| Bundler | **Webpack 5** (renderer) + `tsc` (main process) |
| Terminal | `@xterm/xterm` 6 + `node-pty` |
| SSH/SFTP | `ssh2`, `cpu-features` (native) |
| FTP | `basic-ftp` |
| RDP | `node-rdpjs-2` |
| WebSocket viewer | `ws` |
| DB client | `pg`, `mysql2`, `mongodb`, `redis` (đóng gói **cả 4 driver**) |
| Local storage | `sqlite3` (native), `electron-store` |
| Mã hoá | `hash-wasm` (Argon2id), AES-256-GCM |
| Cloud sync | `googleapis`, Box, OneDrive, GitHub, GitLab, Cloudflare (OAuth) |
| LAN | `bonjour-service` (mDNS) |
| Code editor | **CodeMirror 6** (16 gói ngôn ngữ) |
| Đóng gói | `electron-builder` → AppImage/deb (Linux), NSIS (Windows) |
| Test | Jest + Testing Library, Playwright (E2E) |

### 2.2 Quy mô code (đo thực tế)

- Tổng: **~67.800 dòng** TS/TSX (45 file `.ts`, 44 file `.tsx`).
- **`src/main/index.ts`: 3.824 dòng / 129 KB — 241 IPC handler.** Đây là "god file"
  của main process.
- **`src/renderer/App.tsx`: 7.901 dòng.** "God component" của UI.
- 33 service backend trong `src/main/services/` — nhiều file rất lớn:
  `BenchmarkService` 53 KB, `NetworkToolsService` 48 KB, `WhoisService` 28 KB,
  `RDPManager` 27 KB, `LANFileTransferService` 27 KB.
- 40 component renderer; các file lớn nhất: `DatabaseClient.tsx` (2.398),
  `DualPaneSFTP.tsx` (2.364), `SourceInstaller.tsx` (2.112),
  `BenchmarkModal.tsx` (1.733).

### 2.3 Bản đồ tính năng (để hiểu độ lớn khi build lại)

Marix **không phải chỉ là SSH client** — nó là một "bộ công cụ hạ tầng" đầy đủ:

1. **Terminal SSH** (xterm + node-pty + ssh2)
2. **Truyền file SFTP/FTP** (dual-pane, kéo-thả, sửa file remote)
3. **RDP** (remote desktop)
4. **WSS viewer** (WebSocket)
5. **Database client** cho PostgreSQL / MySQL / MongoDB / Redis (kèm ERD diagram, SQL editor)
6. **Cloud backup & sync** mã hoá client-side (Google Drive, Box, OneDrive, GitHub, GitLab, Cloudflare)
7. **LAN file transfer / sharing** (mDNS discovery)
8. **Network tools** (whois, port forwarding, port knocking, benchmark server)
9. **Mã hoá zero-knowledge** (Argon2id + AES-256-GCM) cho storage & backup
10. **Code editor** nhúng (CodeMirror, ~15 ngôn ngữ)
11. **Đa ngôn ngữ** (13 locale)

> ⚠️ Điểm quan trọng cho quyết định tech: **bề mặt tính năng rất rộng**. Bất kỳ đề
> xuất "build lại" nào cũng phải trả lời được: *mỗi native module Node hiện tại sẽ
> thay bằng gì?* Mục §5 trả lời câu này.

---

## 3. Vì sao ứng dụng "nặng & chậm" — chẩn đoán

| # | Nguyên nhân | Tác động |
|---|-------------|----------|
| 1 | **Electron đóng gói Chromium riêng** | Installer phồng ~150–220 MB; RAM baseline 150–300 MB; startup phải khởi động cả một trình duyệt |
| 2 | **Đóng gói cả 4 DB driver + googleapis** vào mọi bản cài | Bloat cả installer lẫn bộ nhớ; đa số user không dùng hết |
| 3 | **`App.tsx` 7.900 dòng, ít code-splitting phía state** | Bundle renderer lớn, re-render rộng, tốn CPU/RAM |
| 4 | **`main/index.ts` 241 IPC handler trong 1 file** | Khó bảo trì, khó tách; mọi thứ load cùng lúc khi mở app |
| 5 | **Native module (`sqlite3`, `node-pty`, `ssh2`, `node-rdpjs`)** | Phải `electron-rebuild` theo ABI; kéo theo rủi ro bảo mật & bản dựng nặng |
| 6 | **Chỉ build `x64`** (xem `electron-builder.json`) | Không có bản `arm64` cho Linux/Windows ARM → chạy qua emulation thì chậm |

Kết luận chẩn đoán: **~80% "trọng lượng" đến từ runtime Electron**, không phải từ
code ứng dụng. Vì vậy muốn *nhẹ thật sự* thì phải đổi runtime, không thể chỉ tối ưu JS.

---

## 4. Đề xuất tech stack (khuyến nghị)

### 4.1 Lựa chọn runtime — so sánh

| Tiêu chí | **Tauri 2** ✅ khuyến nghị | Electron (giữ nguyên) | Wails (Go) | Qt / C++ | Native (GTK/WinUI) |
|----------|--------------------------|----------------------|-----------|----------|--------------------|
| Kích thước installer | **~8–15 MB** | 150–220 MB | ~15–25 MB | 30–60 MB | 20–40 MB |
| RAM idle | **Thấp (webview hệ thống)** | Cao | Thấp | Trung bình | Thấp nhất |
| Ngôn ngữ backend | **Rust** | Node.js | Go | C++ | C++/C#/… |
| Tái dùng frontend React hiện tại | **Gần như 100%** | 100% | ~100% | ❌ viết lại | ❌ viết lại |
| Hệ sinh thái crate cho SSH/DB/RDP | **Tốt** | Tốt (npm) | Trung bình | Trung bình | Kém |
| Công port backend | Cao (viết Rust) | 0 | Cao (viết Go) | Rất cao | Cực cao |
| Bảo mật (attack surface) | **Nhỏ** | Lớn (full Chromium+Node) | Nhỏ | Nhỏ | Nhỏ |

> **Chọn Tauri 2** vì cân bằng tốt nhất: giữ được frontend React/TS (bảo toàn ~35k
> dòng UI + 13 locale + toàn bộ CodeMirror/xterm), mà vẫn đạt mức nhẹ mong muốn.
> Điểm cần lưu ý: webview khác nhau theo OS (WebView2/Edge trên Windows, WebKitGTK
> trên Ubuntu) → cần test render trên cả hai; nhưng frontend hiện tại đã là web
> chuẩn nên rủi ro thấp.

### 4.2 Stack đề xuất chi tiết

| Lớp | Đề xuất | Ghi chú |
|-----|---------|---------|
| **Runtime** | **Tauri 2** | Webview OS + core Rust; IPC qua `#[tauri::command]` + event |
| **Backend** | **Rust** (async: `tokio`) | Thay thế `src/main/*` |
| **Frontend** | **Giữ React 19 + TypeScript** | Tái dùng nguyên; đổi lời gọi `window.electron.*` → `@tauri-apps/api` |
| **Bundler** | **Vite** (thay Webpack) | Dev nhanh hơn nhiều, HMR mượt, build nhẹ; Tauri mặc định dùng Vite |
| **CSS** | Giữ **Tailwind 4** | Không đổi |
| **Terminal** | Giữ `@xterm/xterm` ở UI + `portable-pty` (Rust) ở backend | thay `node-pty` |
| **SSH/SFTP** | **`russh` + `russh-sftp`** (Rust) | thay `ssh2` |
| **FTP** | **`suppaftp`** (Rust) | thay `basic-ftp` |
| **RDP** | **`IronRDP`** (Rust, của Devolutions) | thay `node-rdpjs-2` — phần rủi ro nhất, xem §6 |
| **WebSocket** | **`tokio-tungstenite`** | thay `ws` |
| **SQLite local** | **`rusqlite`** hoặc **`sqlx`** | thay `sqlite3` native |
| **DB client** | **`sqlx`** (pg/mysql), **`mongodb`** crate, **`redis`** crate | tách thành plugin/feature, chỉ nạp khi dùng |
| **Mã hoá** | **`argon2`** + **`aes-gcm`** (RustCrypto) | thay `hash-wasm`; nhanh & chuẩn hơn |
| **mDNS/LAN** | **`mdns-sd`** | thay `bonjour-service` |
| **Cloud OAuth** | **`oauth2`** crate + `reqwest` | thay `googleapis`/SDK JS nặng |
| **Local store** | **`tauri-plugin-store`** | thay `electron-store` |
| **Đóng gói** | Tauri bundler → **`.deb` + `.AppImage`** (Ubuntu), **`.msi`/NSIS** (Windows) | thêm target **arm64** |
| **Test** | Giữ Jest/Testing Library (UI) + `cargo test` (Rust) + **`tauri-driver`/WebDriver** cho E2E | thay Playwright-Electron |

### 4.3 Kết quả kỳ vọng (mục tiêu đo được)

| Chỉ số | Hiện tại (Electron) | Mục tiêu (Tauri) |
|--------|--------------------:|-----------------:|
| Installer (Win/Linux x64) | ~150–220 MB | **~8–15 MB** |
| RAM idle (1 cửa sổ, chưa kết nối) | ~150–300 MB | **~60–120 MB** |
| Thời gian khởi động lạnh | baseline | **nhanh hơn 2–4×** |
| Kiến trúc CPU | chỉ x64 | **x64 + arm64** |

> Con số là ước lượng dựa trên đặc tính Tauri vs Electron; cần benchmark thực tế
> sau PoC (§6, Giai đoạn 0) để chốt.

---

## 5. Bản đồ port native module: Node → Rust

Đây là bảng "đối chiếu 1-1" quan trọng nhất — chứng minh việc build lại là khả thi:

| Chức năng | Node hiện tại | Rust thay thế | Độ trưởng thành |
|-----------|---------------|---------------|-----------------|
| SSH client + shell | `ssh2` | `russh` | ✅ Cao |
| SFTP | `ssh2` (sftp) | `russh-sftp` | ✅ Cao |
| PTY (terminal cục bộ) | `node-pty` | `portable-pty` (wezterm) | ✅ Cao |
| FTP | `basic-ftp` | `suppaftp` | ✅ Cao |
| SQLite | `sqlite3` | `rusqlite` / `sqlx` | ✅ Cao |
| PostgreSQL | `pg` | `sqlx` / `tokio-postgres` | ✅ Cao |
| MySQL | `mysql2` | `sqlx` / `mysql_async` | ✅ Cao |
| MongoDB | `mongodb` | `mongodb` crate (chính chủ) | ✅ Cao |
| Redis | `redis` | `redis` crate / `fred` | ✅ Cao |
| WebSocket | `ws` | `tokio-tungstenite` | ✅ Cao |
| Argon2id | `hash-wasm` | `argon2` (RustCrypto) | ✅ Cao |
| AES-256-GCM | Node crypto | `aes-gcm` (RustCrypto) | ✅ Cao |
| mDNS | `bonjour-service` | `mdns-sd` | ✅ Cao |
| OAuth2 | `googleapis`/SDK | `oauth2` + `reqwest` | ✅ Cao |
| **RDP** | `node-rdpjs-2` | **`IronRDP`** | ⚠️ Trung bình — cần PoC riêng |
| CPU features | `cpu-features` | `raw-cpuid` / `sysinfo` | ✅ Cao |

**Kết luận:** 15/16 mảng có crate Rust trưởng thành. **RDP là ẩn số lớn duy nhất**
→ phải làm PoC trước khi cam kết (xem §6).

---

## 6. Lộ trình di trú (Strangler-fig, 4 giai đoạn)

Nguyên tắc: **không big-bang**. Frontend giữ nguyên, backend port dần; mỗi giai đoạn
đều ra được app chạy được để so sánh/benchmark.

### Giai đoạn 0 — PoC & khử rủi ro (2–4 tuần)
- Dựng khung Tauri 2 + Vite, nhét **frontend React hiện tại** vào (chỉ cần app mở
  được cửa sổ, render UI).
- **PoC 3 thứ rủi ro nhất:** (1) SSH shell qua `russh` + xterm, (2) SFTP list/upload,
  (3) **RDP qua `IronRDP`**. Nếu RDP không đạt → cân nhắc giữ RDP dưới dạng sidecar
  Node hoặc tách thành tính năng tuỳ chọn.
- **Benchmark** installer size / RAM / startup để xác nhận con số ở §4.3.
- **Cổng quyết định (go/no-go):** chỉ đi tiếp nếu PoC đạt mục tiêu.

### Giai đoạn 1 — Nền tảng + tính năng lõi (4–8 tuần)
- Chuẩn hoá lớp IPC: gom **241 handler** thành các module Tauri command theo domain
  (ssh, sftp, ftp, db, cloud, network…) — **đồng thời dọn "god file" `index.ts`**.
- Port: **SSH terminal, SFTP/FTP, local SQLite store, mã hoá Argon2id/AES,
  ServerStore**. Đây là bộ khung mà đa số user dùng hàng ngày.
- Tách `App.tsx` (7.900 dòng) thành các feature module + lazy-load theo route.

### Giai đoạn 2 — Tính năng mở rộng (6–10 tuần)
- Port **DB client** (pg/mysql/mongo/redis) — quan trọng: đưa mỗi driver thành
  **feature Cargo tuỳ chọn** để không phồng bản build.
- Port **cloud sync/backup** (OAuth + upload mã hoá), **LAN transfer** (mDNS),
  **network tools** (whois, port forwarding, benchmark).
- Port **WSS viewer**.

### Giai đoạn 3 — RDP, hoàn thiện, phát hành (4–8 tuần)
- Hoàn tất **RDP** (hoặc chốt phương án thay thế từ PoC).
- Thiết lập **CI đa nền tảng** (Ubuntu x64/arm64, Windows x64/arm64), ký số
  (code signing) Windows, auto-update (`tauri-plugin-updater`).
- Chuyển E2E sang `tauri-driver`; đối chiếu tính năng 1-1 với bản Electron rồi
  phát hành song song (beta) trước khi thay thế.

> **Tổng ước lượng:** ~4–7 tháng cho 1–2 kỹ sư thạo Rust + React. Phần lớn thời gian
> là port backend, **không phải** frontend.

---

## 7. Phương án B — nếu chưa muốn động vào Rust (tối ưu Electron)

Nếu nguồn lực hạn chế hoặc muốn cải thiện ngay trong 1–2 tuần mà **chưa** rebuild:

1. **Bỏ đóng gói driver không cần thiết mặc định.** Cân nhắc tải DB driver / googleapis
   theo nhu cầu, hoặc tách thành module lazy → giảm size & RAM.
2. **Đổi Webpack → Vite** (qua `electron-vite`): dev nhanh hơn nhiều, build gọn hơn.
3. **Bật `V8 snapshot` / tối ưu code-splitting**; tách `App.tsx` để giảm bundle load ban đầu.
4. **Thêm target `arm64`** trong `electron-builder.json` (hiện chỉ có x64).
5. **Dùng bản Electron mới + bật `--disable-features`** cho các thành phần Chromium không dùng.
6. Bật lại nén ASAR/loại bỏ locale Chromium thừa.

> Trần cải thiện thực tế: **~20–40% RAM/size**. Không thể tiệm cận mức Tauri vì vẫn
> gánh nguyên Chromium. Phù hợp làm bước đệm trong lúc chuẩn bị Giai đoạn 0 của Tauri.

---

## 8. Rủi ro & cách giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|-----------|
| **RDP trên Rust chưa đủ trưởng thành** | Cao | PoC ở Giai đoạn 0; phương án dự phòng: sidecar Node cho RDP, hoặc tách RDP thành add-on |
| Team chưa quen Rust | Trung bình | Bắt đầu từ module dễ (crypto, store); pair-programming; giữ frontend TS để giảm khối lượng học |
| Khác biệt webview (WebKitGTK vs WebView2) | Trung bình | Frontend đã là web chuẩn; thêm test render 2 OS trong CI từ sớm |
| Sai lệch tính năng so với bản cũ | Trung bình | Đối chiếu 241 IPC handler thành checklist; phát hành song song beta |
| Cần giữ định dạng backup `.marix` cũ | Cao (dữ liệu người dùng) | Đảm bảo Argon2id/AES-GCM Rust tương thích **bit-for-bit** với bản Node; viết test vector chung |
| Code signing / notarize Windows | Thấp | Thiết lập trong CI Giai đoạn 3 |

> **Điểm bắt buộc không được sai:** khả năng **giải mã ngược backup cũ**. Người dùng
> zero-knowledge sẽ mất dữ liệu nếu format đổi. Cần bộ test vector chung Node↔Rust
> ngay từ Giai đoạn 1.

---

## 9. Khuyến nghị cuối cùng (với vai trò Tech Lead)

1. **Duyệt ngân sách cho Giai đoạn 0 (PoC 2–4 tuần).** Đây là chi phí thấp để khử
   rủi ro lớn nhất (RDP + xác nhận con số hiệu năng) trước khi cam kết.
2. **Chọn Tauri 2 + Rust backend + giữ frontend React/TS.** Đây là đường đạt mục
   tiêu "nhẹ & nhanh" thật sự trên Ubuntu/Windows mà bảo toàn nhiều nhất công sức
   đã bỏ ra.
3. **Song song, làm ngay Phương án B (tối ưu Electron)** để user có cải thiện tức
   thì trong lúc rebuild diễn ra.
4. **Đưa 2 việc "dọn nợ kỹ thuật" vào rebuild:** tách `App.tsx` (7.900 dòng) và
   `main/index.ts` (241 handler) — đây là lúc lý tưởng để trả nợ kiến trúc.

> Nếu **không** cần RDP như tính năng cốt lõi, độ rủi ro của toàn bộ dự án giảm mạnh
> và có thể rút ngắn xuống ~3–4 tháng.
