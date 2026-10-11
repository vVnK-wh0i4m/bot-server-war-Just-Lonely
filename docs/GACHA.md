# 🎰 Cơ chế GACHA — mọi con số

Tài liệu kỹ thuật cho `/gacha_aura`. Nguồn: `src/utils/aura.js` (hằng `GACHA_*`) + `src/commands/game/gacha_aura.js`.

---

## 1. Tổng quan một lượt quay

```
Cược aura (50–1000)
   │
   ├─ 1️⃣  Win roll      — thắng/thua theo dải [90−10n, 90]
   ├─ 2️⃣  Pity roll     — 1%×2/quay → role 🎰 GACHA JACKPOT
   ├─ 3️⃣  Item roll     — 10%×2/quay → item mythic/bá khí
   ├─ 4️⃣  Extra spin?   — 35%+15/trạng thái (cap 95%) → QUAY TIẾP
   │        └─ chain tối đa 30 vòng/lượt (MAX_CHAIN)
   └─ 5️⃣  Cut           — trả 40 + immunity nếu cần giữ slot
```

- Chuỗi thắng `n` = số win liên tiếp **trong lượt này** (trước lượt mới).
- Quay **thua** → chuỗi thắng **reset về 0**, mất cược.

---

## 2. Win roll — dải thắng

| Chuỗi thắng `n` | Dải thắng |
|:---:|---|
| 0 | **90%** cố định |
| 1 | [80, 90] |
| 2 | [70, 90] |
| 3 | [60, 90] |
| … | [90 − 10n, 90] |
| 9+ | [0, 90] — sàn 0 |

**Công thức:** thắng nếu `random(0..90) ≤ 90 − 10×n` (band step `GACHA_BAND_STEP = 10`).

> Ý đồ thiết kế: chuỗi thắng dài = **mạo hiểm thật sự**, nhưng bonus bù lại (xem §3). Thua là **reset**, không cộng dồn lỗ.

---

## 3. Bonus khi thắng

```
bonus% = (60 − immunity) + 20 × chuỗi thắng
```

- `GACHA_BONUS_BASE = 60` · `GACHA_BONUS_STEP = 20`
- **immunity** = % miễn khống chế hiện tại của bạn (theo aura) — aura cao → immunity cao → **bonus gacha thấp hơn**.
- Bonus nhận được = `cược × bonus%` (aura thắng thêm ngoài cược hoàn trả).

> **Trade-off trung tâm của game:** aura cao → thắng PvP dễ hơn nhưng **gacha bõ bèn hơn** — người nghèo cày gacha vẫn theo kịp.

---

## 4. Pity — JACKPOT ROLE

| Thông số | Giá trị |
|----------|---------|
| Tỉ lệ gốc | **1%** (`GACHA_PITY_BASE`) |
| Nhân mỗi lần quay | **×2** (1 → 2 → 4 → 8 … %) |
| Reset | Khi trúng, về **1%**; đồng thời **reset khi thắng lớn?** — pity chỉ cộng dồn khi quay |
| Phần thưởng | Role `🎰 GACHA JACKPOT` màu `#f1c40f` |

Pity **riêng từng user**, lưu trong record aura (`gPity`).

---

## 5. Item — mythic / bá khí

| Thông số | Giá trị |
|----------|---------|
| Tỉ lệ gốc | **10%** (`GACHA_ITEM_BASE`) |
| Nhân mỗi lần quay | **×2** (10 → 20 → 40 … %) |
| Reset | Khi trúng → về **10%** |
| Pool | Chỉ **mythic / baky** (baky 5% trong pool) |
| Nhận | **1 item, qty 1** — vào `/tuido` |

---

## 6. Extra spin — chain quay tiếp

Sau mỗi vòng (thắng hoặc thua), roll kích hoạt vòng bonus:

```
extra% = 35 + 15 × số lần đã kích hoạt     (GACHA_EXTRA_BASE=35, STEP=15)
cap    = 95%                                (GACHA_EXTRA_CAP — 100% sẽ quay vô hạn)
```

- Kích hoạt → **quay tiếp ngay** (không cần cược mới), chain tăng.
- **MAX_CHAIN = 30 vòng/lượt** — chặn quay vô hạn; embed ghi chú rõ khi chạm cap.
- Cược chỉ trừ **một lần** ở đầu lượt.

**Ví dụ may mắn:** cược 100 → win → extra → win → extra ×10 → … tới 30 vòng → tổng aura nhận có thể × hàng chục lần cược.

---

## 7. Cut khi thoát

Khi cần giữ slot (bắt cóc / tương tác giữ role), cut aura:

```
cut = 40 + immunity(%)
```

Hiển thị trong embed mọi lần cut.

---

## 8. Tỉ lệ thành công (PVP — dùng chung hệ thống)

Không chỉ gacha — mọi phép thử PvP dùng chung thang:

| Hằng | Giá trị | Meaning |
|------|---------|---------|
| `rank.perStep` | 10 | Mục tiêu rank cao hơn N bậc → **−10%/bậc** |
| `rank.max` | 60 | Giảm tối đa 60% |
| `rank.ccFloor` | **5** | Sàn tỉ lệ CC (chích/chú…) |
| `rank.captureFloor` | **2.5** | Sàn tỉ lệ bắt cóc |

Aura của bạn càng cao → **càng ít bị ảnh hưởng** bởi chênh lệch rank (immunity).

---

## 9. State lưu trong record người chơi

| Field | Meaning |
|-------|---------|
| `gStreak` | Chuỗi thắng hiện tại |
| `gPity` | Mức tích pity role (1 → 2 → 4 …) |
| `gItem` | Mức tích item (10 → 20 → 40 …) |
| `gExtra` | Số lần extra đã kích hoạt trong lượt |

Tất cả nằm trong `data/aura.json` theo `userId` — không đụng chung.

---

## 10. Debug / test

Suite `tests/test_gacha.js` (**46 assertions**) mô phỏng queue `Math.random` cho 7 kịch bản:

- **S1** chuỗi thắng 0 → band cố định 90
- **S2–S4** chuỗi 1–3 → band co đúng −10n
- **S5** pity trúng → reset 1%
- **S6** item + extra + cut
- **S7** `Array(210).fill(0)` → chain chạm **đúng 30**, không 31, random tiêu hết đúng chỗ

```bash
npm test
```

---

Quay lại [README](../README.md) · [COMMANDS.md](COMMANDS.md) · [ECONOMY.md](ECONOMY.md)
