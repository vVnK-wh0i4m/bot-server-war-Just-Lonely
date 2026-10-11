# 📝 CHANGELOG

Tất cả thay đổi đáng kể của **JUST LONELY AURA BOT**. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/).

---

## [2.0.0] — 2026-10-11

### 🎰 Gacha — viết lại toàn bộ

- Dải thắng `90 − 10×chuỗi` (sàn 0) — chuỗi thắng dài = mạo hiểm thật sự
- Bonus thắng: `(60 − immunity) + 20%/lần`
- **Pity role** 1% ×2/quay → role `🎰 GACHA JACKPOT`
- **Item** 10% ×2/quay (cap 100) — pool mythic/bá khí, baky 5%
- **Extra spin** 35% + 15/trạng thái, cap 95%, chain **MAX 30** vòng/lượt
- Cut `40 + immunity`; state per-user: `gStreak/gPity/gItem/gExtra`
- Embed hiển thị đầy đủ mọi thông số + note giới hạn 30

### 💰 Kinh tế — đại trùng tu

- **15 phân hạng**: Thấp → Tân Binh → … → Trung Bình → … → Cao → … → Hắc Hoàng → Chân Thần → Vô Cực
- **30 role bậc mốc số** `Aura 1K` → `Aura 1B` — tự tạo/gán/gỡ
- **Newbie multiplier** ×10 (<100K) · ×5 (<1M) · ×2 (<5M) — hiện `🆕×N` trong embed
- **Role custom** `AURA <tên>` từ **15M aura** — đặt tên qua nút trong `/flexaura` (modal, tự đổi/tự gỡ)
- Cap chuyển aura mới: tối đa **99.999.999**/lượt

### ⚔️ Cơ chế PvP

- Sàn tỉ lệ: CC **5%** · bắt cóc **2.5%** — không bao giờ về 0
- Mục tiêu rank cao hơn → giảm **10%/bậc** (max 60) — theo thang rank mới
- Sticky debounce + auto-delete 2 tầng

### 🧪 Chất lượng

- **217 assertions / 6 suite** — `npm test` (gacha 46, shop/reflect 36, danh sách 41, sticky 26, release 20, economy 48)
- Test chuyển vào repo `tests/`, không hardcode đường dẫn
- Fix: role sync luôn chọn mốc **cao nhất** (trước đó fix nhầm chọn mốc đầu tiên)

### 🔐 Bảo mật

- Chuyển toàn bộ secret hardcoded trong source sang **biến môi trường** (`.env` — gitignore)
- `.env.example` mẫu không chứa giá trị thật

---

## [1.x] — trước 2026-10

Bản legacy: spam qua webhook (prefix `?`), game AURA cơ bản (bắt cóc, tù, shop, rương), duatop, gate invite.

---

[2.0.0]: https://github.com/vVnK-wh0i4m/bot-server-war-Just-Lonely/releases/tag/v2.0.0
