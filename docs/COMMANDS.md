# 🎯 Bảng lệnh đầy đủ — JUST LONELY AURA BOT

> Gõ `/help` trong Discord để xem bảng này ngay trong game, có menu chọn danh mục.

**Quy ước:**
- 🔵 **Slash** `/lệnh` — gõ `/` để tìm
- 🔴 **Prefix** `?lệnh` — gõ `?` ở đầu tin nhắn *(lệnh spam/phá hoại)*
- ⏱️ = cooldown · 🎲 = tỉ lệ base

---

## 📢 Spam (prefix `?` — gửi qua webhook)

| Lệnh | Cú pháp | Mô tả |
|------|---------|-------|
| `?spam` | `?spam <delay> <số dòng\|inf> <nội dung>` | Spam nội dung tùy ý. Nhiều dòng: tách bằng `\|`. Tự thêm `# ` đầu dòng → chữ hiện TO |
| `?ngon` | `?ngon <delay> <số dòng\|inf> [@tag]` | Spam văn từ `ngon.txt` (điền sẵn trong repo) |
| `?nhay` | `?nhay <delay> <số dòng\|inf> [@tag]` | Spam text từ `nhay.txt` |
| `?clearchat` | `?clearchat <số dòng>` | Đẩy trôi chat bằng ký tự ẩn |
| `?stop` | `?stop` | **Dừng TẤT CẢ** spam đang chạy của bạn |

**Ví dụ:**

```
?spam 0.5 20 hello ae
?spam 0.3 10 dòng 1 | dòng 2 | dòng 3
?ngon 0.5 inf @đại-ca
?clearchat 50
?stop
```

> ⚠️ Bot cần quyền **Manage Webhooks**. Nội dung spam là `# ` + text → hiện chữ lớn trong Discord.

---

## ⚔️ PvP — role & aura

| Lệnh | Cú pháp | Tỉ lệ / Hiệu ứng | ⏱️ |
|------|---------|-------------------|-----|
| `/batcocloli` | `/batcocloli nguoi:@ai` | 🎲 **50%** — chiếm role, giữ **30 phút**; slot: **5 + bonus theo aura** | 30s |
| `/cuopaura` | `/cuopaura nguoi:@ai` | 🎲 **5–50%** — cướp **100% aura** mục tiêu; mục tiêu **nghèo cướp dễ hơn** | 120s |
| `/cudamsamset` | `/cudamsamset nguoi:@ai` | 🎲 — cướp **hết role** + mute **15s** | 30s |
| `/chichdien` | `/chichdien nguoi:@ai` | 🎲 — mute **5s** | 10s |
| `/leuleucay` | `/leuleucay nguoi:@ai` | 🎲 — mute **3s** | 6s |
| `/nhothamloli` | `/nhothamloli nguoi:@ai` | Ticket **riêng tư** (chỉ 2 người thấy) · **10 phút** · trừ **5–200 aura/phút** · nút 💸 trả **10/phút** thoát sớm | 60s |
| `/tronthoat` | `/tronthoat` hoặc nút 🏃/💸 | 🎲 trốn **25%** (mỗi lần thử) · 💸 trả aura thoát ngay | 10s |

**Miễn khống chế (immunity):** theo aura của bạn — hiển thị trong `/flexaura`. Mute ngắn < 5s cần aura ≥ 20% mới miễn được.

**Tỉ lệ thành công:** mục tiêu rank **cao hơn** → tỉ lệ **giảm** theo bậc — sàn **CC 5%** / **bắt cóc 2.5%**. Chi tiết công thức: [GACHA.md](GACHA.md#-tỉ-lệ-thành-công-pvp).

---

## 🎮 Game AURA

| Lệnh | Cú pháp | Mô tả | ⏱️ |
|------|---------|-------|-----|
| `/gacha_aura` | `/gacha_aura cuoc:100` | Cược aura quay vòng — thắng nhận bonus theo chuỗi, trúng **jackpot role**, item mythic/bá khí, **extra spin** chain tới 30 vòng | 8s |
| `/aurabox` | `/aurabox` | Rương miễn phí **+5–50** aura (7% jackpot ×3) | 5 phút |
| `/mayman` | `/mayman` | Hộp quà **+5–100** aura | 10 phút |
| `/hangngay` | `/hangngay` | Nhận daily **+30**, chuỗi **+20/ngày** (max **+130**) | 24h |
| `/aurashop` | `/aurashop` | Shop **5 món/lần** (mỗi món 1–30 sp) — mua bằng aura; ❕ **0.001%** | 3s *(restock 90s)* |
| `/tuido` | `/tuido` | Túi đồ — xem & **DÙNG** item ngay (khiên, bùa, vé thoát…) | — |
| `/duaura` | `/duaura nguoichoi:@ai soluong:100` | Chuyển aura (tối đa **99.999.999**/lần) | 10s |
| `/huongdan` | `/huongdan` | Sổ tay game AURA: cơ chế, phân hạng, mẹo | — |

---

## 📊 Thông tin

| Lệnh | Cú pháp | Mô tả |
|------|---------|-------|
| `/flexaura` | `/flexaura [nguoi]` | Hồ sơ: **phân hạng**, tier role, slot, miễn khống chế, thành tích. Từ **15M aura**: nút **đặt tên role custom** `AURA <tên>` |
| `/topaura` | `/topaura` | Bảng xếp hạng aura của **server** |
| `/danhsachloli` | `/danhsachloli` | Danh sách người mình đang bắt · ô chọn 🔓 bỏ sở hữu (bù **100–500 aura** cho họ) |
| `/help` | `/help` | Bảng lệnh GUI embed |

---

## 📌 Lưu ý chung

1. **Sàn tỉ lệ** — không bao giờ về 0: CC **5%**, bắt cóc **2.5%**.
2. **Tất cả số liệu** (tỉ lệ, slot, cd, cut…) đều hiện **ngay trong embed** khi chạy lệnh — không phải đoán.
3. Lệnh phá hoại nhắm vào **bot** sẽ bị từ chối — chỉ nhắm người chơi thật.
4. Farm aura khi chat: **+2 / 45s**, 1.5% trúng **+20** — tính cả khi bạn im lặng quá lâu (khi quay lại).
5. Auto-delete: message lệnh + reply tự xóa sau khi xử lý — chat sạch.

---

Quay lại [README](../README.md) · Cơ chế chi tiết: [GACHA.md](GACHA.md) · [ECONOMY.md](ECONOMY.md)
