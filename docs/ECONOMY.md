# 💰 Kinh tế AURA — phân hạng, role, multiplier

Toàn bộ số liệu từ `src/utils/aura.js` (`RANKS`, `MILESTONES`, `newbieMult`, `CUSTOM_ROLE_MIN`).

---

## 1. 15 phân hạng

| # | Phân hạng | Aura từ | Icon |
|:-:|-----------|--------:|:----:|
| 0 | **Thấp** | 0 | 🌱 |
| 1 | **Tân Binh** | 50.000 | 🌿 |
| 2 | **Lính Mới** | 150.000 | 🍀 |
| 3 | **Tinh Anh** | 400.000 | 🌾 |
| 4 | **Lão Luyện** | 700.000 | 🌳 |
| 5 | **Trung Bình** | 1.000.000 | ⚖️ |
| 6 | **Khá Giả** | 2.000.000 | 💍 |
| 7 | **Giàu Có** | 3.000.000 | 💎 |
| 8 | **Thượng Lưu** | 4.000.000 | 👑 |
| 9 | **Cao** | 5.000.000 | 🏔️ |
| 10 | **Cao Cấp** | 10.000.000 | 🚀 |
| 11 | **Siêu Cấp** | 15.000.000 | ⚡ |
| 12 | **Hắc Hoàng** | 20.000.000 | 🖤 |
| 13 | **Chân Thần** | 100.000.000 | 👁️ |
| 14 | **Vô Cực** | 500.000.000 | ♾️ |

Hiển thị ở đầu `/flexaura`, trong `auraSummary` của mọi embed thành tích, và suffix `🆕×N` khi nhận aura ở mức newbie.

---

## 2. 30 role bậc mốc số

Bot **tự tạo + tự gán** role theo mốc aura. Tên `Aura <mốc>`:

```
Aura 1K · Aura 5K · Aura 10K · Aura 50K · Aura 100K · Aura 250K · Aura 500K
Aura 1M · Aura 2M · Aura 3M · Aura 4M · Aura 5M · Aura 6M · Aura 10M · Aura 15M
Aura 20M · Aura 25M · Aura 35M · Aura 50M · Aura 75M · Aura 100M · Aura 125M
Aura 175M · Aura 250M · Aura 350M · Aura 500M · Aura 600M · Aura 700M
Aura 850M · Aura 1B
```

**Cơ chế** (`game.syncTierRole`):
- Chỉ giữ **đúng 1 role mốc** — lên mốc mới → tự gỡ role mốc cũ.
- Gọi sau mọi lần aura đổi (cộng/trừ/du/gacha…).
- Role được tạo với màu theo bậc, kiểm tra quyền Manage Roles trước khi tạo.

---

## 3. Newbie multiplier

Aura **thấp** được **nhân** khi nhận (trừ khi chuyển/duaura):

| Aura hiện tại | Multiplier |
|---------------|:----------:|
| < 100.000 | **×10** |
| < 1.000.000 | **×5** |
| < 5.000.000 | **×2** |
| ≥ 5.000.000 | ×1 |

Áp dụng cho: chat farm (+2/45s), rương, daily, may mắn, thắng PvP, escape… — mọi nguồn `aura.gain`.

**Ví dụ:** newbie 50K mở rương 30 → nhận `30 × 10 = 300`. Embed hiện `🆕×10`.

> Ý đồ: rút ngắn giai đoạn đầu ("1M đầu tiên là khó nhất") — từ 5M mọi thứ tính "gốc".

---

## 4. Role custom `AURA <tên>` — từ 15M

| Điều kiện | ≥ **15.000.000** aura |
|-----------|------------------------|
| Cách đặt | `/flexaura` → nút **Đặt tên role** → modal nhập (≤ 32 ký tự, strip `` `*_~|@ ``) |
| Tên role | `AURA <tên>` (màu `#00cec9`) |
| Đổi tên | Quyền tự đổi — bot gỡ role cũ, tạo role mới |
| Rơi dưới 15M | Bot **gỡ** role custom |

> ⚠️ 30 role mốc dùng pattern `Aura <mốc>` (chữ A thường) — **không** xung đột với `AURA <tên>` (chữ hoa). Bot phân biệt 2 nhóm khi sync.

---

## 5. Nguồn thu aura

| Nguồn | Aura | Ghi chú |
|-------|-----:|---------|
| `/aurabox` | +5–50 | 7% jackpot ×3 · cd 5 phút |
| `/mayman` | +5–100 | cd 10 phút |
| `/hangngay` | +30 → +130 | chuỗi +20/ngày, reset khi bỏ ngày |
| Chat farm | +2 / 45s | 1.5% trúng **+20** |
| Thắng `/gacha_aura` | cược × bonus% | [GACHA.md](GACHA.md) |
| `/cuopaura` thắng | 100% aura target | sàn tỉ lệ 5% |
| Escape tù thành công | +30 | fail +5 |

## 6. Nguồn thoát aura

| Hạng mục | Mức | Ghi chú |
|----------|-----|---------|
| Thua gacha | mất cược | |
| Bị bắt cóc | role bị chiếm 30 phút | slot theo aura |
| Hầm loli | 5–200/phút | hoặc trả 10/phút thoát sớm |
| Bị cướp aura | mất 100% | |
| Cut giữ slot | 40 + immunity | |
| Mua shop / item | theo giá | |

---

## 7. Bảng xếp hạng & top

- `/topaura` — BXH theo **server**, đọc `data/aura.json`.
- `/duaura` chuyển tối đa **99.999.999**/lượt.

---

Quay lại [README](../README.md) · [GACHA.md](GACHA.md) · [COMMANDS.md](COMMANDS.md)
