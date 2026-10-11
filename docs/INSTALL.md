# 📦 Hướng dẫn cài đặt — JUST LONELY AURA BOT

Hướng dẫn đầy đủ từ zero đến khi bot online. Chọn nền tảng của bạn:

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt trên Windows](#2-cài-trên-windows)
3. [Đặt lên cloud](#3-đặt-lên-cloud)
4. [Cài đặt trên Linux (systemd)](#4-linux--systemd)
5. [Cấu hình biến môi trường](#5-cấu-hình-biến-môi-trường)
6. [Đăng ký slash command](#6-đăng-ký-slash-command)
7. [Cập nhật bot](#7-cập-nhật-bot)
8. [Xử lý sự cố](#8-xử-lý-sự-cố)

---

## 1. Yêu cầu hệ thống

| Thành phần | Tối thiểu | Ghi chú |
|------------|-----------|---------|
| Node.js | **≥ 18** (khuyến nghị 20 LTS) | `node -v` kiểm tra |
| npm | ≥ 9 | Đi kèm Node |
| RAM | ~100 MB | Bot nhẹ, không cần DB |
| Discord | Bot token | Tạo tại [Developer Portal](https://discord.com/developers/applications) |

**Quyền Discord cần cấp cho bot role (role bot phải CAO HƠN mọi role game):**

- ✅ Manage Roles — gán/gỡ role game, tier, jackpot
- ✅ Manage Webhooks — lệnh spam qua webhook
- ✅ Send Messages / Embed Links / Attach Files
- ✅ Manage Channels *(tùy chọn)* — lệnh `?clearchat`, hầm loli

---

## 2. Cài trên Windows

```powershell
# Clone
git clone https://github.com/vVnK-wh0i4m/bot-server-war-Just-Lonely.git
cd bot-server-war-Just-Lonely

# (Hoặc tải ZIP rồi giải nén, mở terminal trong thư mục)

npm install

# Tạo file .env từ mẫu
copy .env.example .env
notepad .env          # điền DISCORD_TOKEN + CLIENT_ID

# Đăng ký slash command + chạy
npm run deploy
npm start
```

Chạy nền 24/7 trên Windows (ẩn cửa sổ):

```powershell
Start-Process node -ArgumentList "src\discord-bot.js" -WindowStyle Hidden
```

Hoặc dùng [PM2](https://pm2.keymetrics.io/):

```powershell
npm install -g pm2
pm2 start src/discord-bot.js --name "aura-bot"
pm2 save
pm2 startup
```

---

## 3. Đặt lên cloud

Repo đã có **`Procfile`**:

```
worker: node src/discord-bot.js
```

### Render.com (khuyến nghị — free tier ok)

1. Đẩy code lên GitHub (repo này)
2. [render.com](https://render.com) → **New +** → **Background Worker**
3. Connect repo → Build command `npm install` → Start command `npm start`
4. Tab **Environment** → thêm:
   - `DISCORD_TOKEN` = token bot
   - `CLIENT_ID` = Application ID
5. **Save Deploy**

### Railway

1. railway.app → **New Project** → deploy từ GitHub
2. **Variables** → thêm `DISCORD_TOKEN`, `CLIENT_ID`
3. Start command: `npm start`

> ⚠️ Cloud free tier hay "sleep" — bot sẽ offline khi không có request. Dùng worker-type (Render Background Worker) chứ **không phải** Web Service.

---

## 4. Linux + systemd

```bash
sudo apt update && sudo apt install -y nodejs npm
git clone https://github.com/vVnK-wh0i4m/bot-server-war-Just-Lonely.git
cd bot-server-war-Just-Lonely
npm install
cp .env.example .env && nano .env
```

Tạo service `/etc/systemd/system/aura-bot.service`:

```ini
[Unit]
Description=JUST LONELY AURA Bot
After=network.target

[Service]
Type=simple
User=bot
WorkingDirectory=/opt/bot-server-war-Just-Lonely
ExecStart=/usr/bin/node src/discord-bot.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/bot-server-war-Just-Lonely/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aura-bot
journalctl -u aura-bot -f        # xem log realtime
```

---

## 5. Cấu hình biến môi trường

File `.env` (mẫu: `.env.example`):

| Biến | Bắt buộc | Mô tả |
|------|:--------:|-------|
| `DISCORD_TOKEN` | ✅ | Token bot (Developer Portal → Bot) |
| `CLIENT_ID` | ✅ | Application ID — dùng đăng ký slash command |
| `CLIENT_SECRET` | ❌ | OAuth2 — luồng invite dev |
| `WEBHOOK_URL` | ❌ | Webhook mặc định cho lệnh spam (không có → bot tự tạo webhook trong kênh) |
| `REQUIRED_INVITE_CODE` | ❌ | Mã invite qua cổng gate (mặc định `qUk8XTdMHv`) |

> 🔒 **KHÔNG BAO GIỜ commit file `.env`** — nó nằm trong `.gitignore`. Token leak = reset token ngay tại Developer Portal.

---

## 6. Đăng ký slash command

Mỗi lần **thêm/sửa lệnh slash** phải chạy:

```bash
npm run deploy
```

Kết quả kỳ vọng:

```
✓ Deployed 20 global commands (...)
✓ Deployed 1 guild commands for <id> (duatop)
```

- **Global command** — lan sau ~1 giờ (Discord cache).
- **Guild command** (`duatop`) — apply ngay cho server chỉ định.
- Lệnh spam prefix `?` **không cần deploy** — chỉ cần restart bot.

---

## 7. Cập nhật bot

```bash
git pull
npm install          # nếu package.json đổi
npm run deploy       # nếu có lệnh mới
# restart bot (Ctrl+C rồi npm start, hoặc pm2 restart aura-bot)
```

Dữ liệu người chơi nằm trong `data/*.json` — **`git pull` không đè dữ liệu** (thư mục data được gitignore).

---

## 8. Xử lý sự cố

| Triệu chứng | Nguyên nhân / Fix |
|--------------|-------------------|
| `DISCORD_TOKEN is undefined` | Thiếu `.env` hoặc sai tên biến. Kiểm tra `config/index.js` |
| `Missing Access` khi deploy | Sai `CLIENT_ID`, hoặc app sai server |
| Bot online nhưng slash không hiện | Chạy `npm run deploy`; chờ ~1h global cache; gõ `/` tìm lại |
| `Cannot find module 'discord.js'` | `node_modules` bị xóa → `npm install` |
| Bot không gán được role | Role bot phải **cao hơn** role game trong Server Settings → Roles |
| Lệnh spam lỗi webhook | Cấp quyền **Manage Webhooks** cho bot |
| `Unknown interaction` / `40060` | Nhiều instance cùng một token — chỉ được chạy **một** process |

---

Xong — quay lại [README](../README.md) · Xem [COMMANDS.md](COMMANDS.md)
