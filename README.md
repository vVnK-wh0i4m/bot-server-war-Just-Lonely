<div align="center">

# 🎮 JUST LONELY — AURA SERVER WAR

**Discord mini-game bot đậm chất PvP — cướp role, bắt cóc, gacha jackpot role, kinh tế 15 phân hạng**

[![discord.js](https://img.shields.io/badge/discord.js-14.27-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Commands](https://img.shields.io/badge/slash_commands-20-blueviolet)](#-bảng-lệnh)
[![Tests](https://img.shields.io/badge/tests-217%20✅-success)](docs/TESTING.md)
[![Version](https://img.shields.io/badge/version-2.0.0-orange)](CHANGELOG.md)

[![Tải ZIP](https://img.shields.io/badge/⬇️_Tải_ZIP-main-pink?style=for-the-badge&logo=github&logoColor=white)](https://github.com/vVnK-wh0i4m/bot-server-war-Just-Lonely/archive/refs/heads/main.zip)
[![Clone](https://img.shields.io/badge/git_clone-HTTPS-black?style=for-the-badge&logo=github&logoColor=white)](https://github.com/vVnK-wh0i4m/bot-server-war-Just-Lonely)

</div>

---

## 📑 Mục lục

- [✨ Tính năng](#-tính-năng)
- [🚀 Cài đặt nhanh](#-cài-đặt-nhanh)
- [🎯 Bảng lệnh](#-bảng-lệnh)
- [📚 Tài liệu](#-tài-liệu)
- [🏗️ Cấu trúc dự án](#️-cấu-trúc-dự-án)
- [🧪 Kiểm thử](#-kiểm-thử)
- [🛠️ Công nghệ](#️-công-nghệ)

---

## ✨ Tính năng

<table>
<tr>
<td width="50%">

### ⚔️ PvP Role Warfare
- **Bắt cóc** `?` — chiếm role người khác, giữ 30 phút, slot theo aura
- **Cướp aura** —Target nghèo dễ cướp hơn (sàn 5%)
- **Cú đấm sấm sét** — cướp hết role + mute
- **Nhốt hầm loli** — ticket kín, trừ aura theo phút
- **Trốn tù** — 25% hoặc trả aura thoát ngay

</td>
<td width="50%">

### 🎰 Gacha Cực Hạn
- Dải thắng `90 → 80 → 70…` (sàn **CC 5%** / **bắt cóc 2.5%**)
- Bonus chuỗi thắng **+20%/lần**
- **Jackpot role** `🎰 GACHA JACKPOT` qua cơ chế pity
- **Item mythic/baky** trong pool, cap 100
- **Extra spin** chain tối đa **30 vòng/lượt**

</td>
</tr>
<tr>
<td>

### 💰 Kinh tế 15 Phân Hạng
- `Thấp → … → Trung Bình → … → Cao → … → Hắc Hoàng → Chân Thần → Vô Cực`
- **30 role bậc mốc** `Aura 1K` → `Aura 1B`
- **Newbie ×10/×5/×2** — tân thủ cày nhanh gấp 10 lần
- **Role custom** `AURA <tên>` từ 15M aura

</td>
<td>

### 🛡️ Cơ Chế Chín Chín
- Tỉ lệ giảm dần theo chênh lệch role — **sàn chặn** không về 0
- Immunity theo aura, cut khi bỏ chạy
- Sticky message + auto-delete 2 tầng
- Shop 5 món/lần, restock 90s, item ❕ 0.001%

</td>
</tr>
</table>

---

## 🚀 Cài đặt nhanh

> Chi tiết từng bước (Windows / cloud / systemd): **[docs/INSTALL.md](docs/INSTALL.md)**

```bash
# 1. Clone hoặc tải ZIP
git clone https://github.com/vVnK-wh0i4m/bot-server-war-Just-Lonely.git
cd bot-server-war-Just-Lonely

# 2. Cài dependency
npm install

# 3. Cấu hình env
copy .env.example .env        # Windows
# nano .env                   # Linux — điền DISCORD_TOKEN + CLIENT_ID

# 4. Đăng ký slash command
npm run deploy

# 5. Chạy
npm start
```

**Yêu cầu:** Node.js **≥ 18**, Discord Bot token ([Developer Portal](https://discord.com/developers/applications)), quyền **Manage Roles** (role bot cao nhất trong bậc role), **Manage Webhooks** (lệnh spam).

<details>
<summary>💡 Deploy lên cloud (Render / Railway / …)</summary>

Repo có sẵn `Procfile`:

```
worker: node src/discord-bot.js
```

Chỉ cần set biến môi trường `DISCORD_TOKEN` + `CLIENT_ID` trên dashboard. Chi tiết: [docs/INSTALL.md § Đám mây](docs/INSTALL.md#3-đặt-lên-cloud).

</details>

---

## 🎯 Bảng lệnh

> Cú pháp đầy đủ + cơ chế: **[docs/COMMANDS.md](docs/COMMANDS.md)**

| Nhóm | Lệnh | Mô tả |
|:----:|------|-------|
| 📢 Spam *(prefix `?`)* | `?spam` `?ngon` `?nhay` `?clearchat` `?stop` | Spam qua webhook, dừng tất cả bằng `?stop` |
| ⚔️ PvP | `/batcocloli` `/cuopaura` `/cudamsamset` `/nhothamloli` `/tronthoat` | Cướp role / aura / nhốt hầm / trốn tù |
| 🎮 Game | `/gacha_aura` `/aurabox` `/aurashop` `/mayman` `/hangngay` `/tuido` `/duaura` | Gacha, rương, shop, túi đồ |
| 📊 Thông tin | `/flexaura` `/topaura` `/danhsachloli` `/huongdan` `/help` | Hồ sơ, BXH, hướng dẫn |

---

## 📚 Tài liệu

| Tài liệu | Nội dung |
|----------|----------|
| 📖 [INSTALL.md](docs/INSTALL.md) | Cài đặt Windows/Linux/macOS, `.env`, deploy cloud, systemd, PM2 |
| 🎯 [COMMANDS.md](docs/COMMANDS.md) | Bảng lệnh đầy đủ, cú pháp, cooldown, lưu ý từng lệnh |
| 🎰 [GACHA.md](docs/GACHA.md) | Công thức win band, pity, item, extra spin, chain — **mọi con số** |
| 💰 [ECONOMY.md](docs/ECONOMY.md) | 15 phân hạng, 30 role mốc, newbie multiplier, role custom |
| 🏗️ [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Cấu trúc module, loader, event, vòng đời data, convention code |
| 🧪 [TESTING.md](docs/TESTING.md) | Chạy `npm test`, cấu trúc test, mock Discord, backup/restore |
| 📝 [CHANGELOG.md](CHANGELOG.md) | Lịch sử phiên bản |
| 🤝 [CONTRIBUTING.md](CONTRIBUTING.md) | Quy tắc đóng góp, style, checklist PR |

---

## 🏗️ Cấu trúc dự án

```
bot-server-war-Just-Lonely/
├── src/
│   ├── discord-bot.js          # Entry — client, routing, sticky, auto-delete
│   ├── deploy-commands.js      # Đăng ký slash command
│   ├── commands/
│   │   ├── game/               # Lệnh game AURA (gacha, cướp, tù, shop…)
│   │   ├── spam/               # Lệnh spam qua webhook (prefix ?)
│   │   └── general/            # /help, /duatop
│   ├── events/                 # ready, guildMemberAdd
│   └── utils/                  # aura, game, shop, inventory, gate, history…
├── config/index.js             # Đọc .env (dotenv)
├── data/                       # JSON runtime (gitignored)
├── tests/                      # 217 assertions — npm test
├── assets/img/                 # Ảnh minh họa lệnh game
├── ngon.txt / nhay.txt         # Nội dung lệnh spam
└── Procfile                    # Deploy cloud (worker)
```

---

## 🧪 Kiểm thử

```bash
npm test        # 6 suite · 217 assertions · ~40s
```

Mọi test **backup + restore** `data/*.json` — chạy thoải mái trên bản dev. Chi tiết: [docs/TESTING.md](docs/TESTING.md).

---

## 🛠️ Công nghệ

| Thành phần | Lựa chọn |
|------------|----------|
| Runtime | Node.js ≥ 18 |
| Library | [discord.js](https://discord.js.org) **14.27** |
| Quản lý env | dotenv |
| Lưu trữ | JSON file (`data/`) — không cần DB |
| Test | Script Node thuần (zero dependency) |

---

<div align="center">

**JUST LONELY** · AURA SERVER WAR · built với ☕ và sự căm ghét role cao

[![GitHub](https://img.shields.io/badge/GitHub-vVnK--wh0i4m-181717?logo=github&logoColor=white)](https://github.com/vVnK-wh0i4m)

</div>
