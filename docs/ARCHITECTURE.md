# 🏗️ Kiến trúc dự án — JUST LONELY AURA BOT

discord.js v14 · Node.js ≥ 18 · lưu JSON file · không ORM, không DB.

---

## 1. Bức tranh lớn

```
                 ┌──────────────────┐
   Discord  ←──→ │ discord-bot.js   │ ←── entry duy nhất
                 │  · client login  │
                 │  · interaction   │
                 │  · sticky/delete │
                 └───┬──────────┬───┘
             events/ │          │ commands/
      ┌──────────────┘          └──────────────┐
  ready.js                              game/ · spam/
  guildMemberAdd.js                     general/ · dev/
                                              │
                                        utils/ (core)
                                    aura · game · shop ·
                                    inventory · gate · history
                                              │
                                          data/*.json
```

---

## 2. Cấu trúc module

| Đường dẫn | Vai trò |
|-----------|---------|
| `src/discord-bot.js` | Entry. Login, **routing slash/prefix/component**, sticky debounce, auto-delete 2 tầng, instrumentation debug (giữ nguyên) |
| `src/deploy-commands.js` | Build JSON từ `data` của từng lệnh → PUT Discord API. Chạy `npm run deploy` |
| `src/utils/loader.js` | Quét `src/commands/**` nạp module `{data, execute, prefix?, onComponent?}` |
| `src/utils/aura.js` | **Nhân vật**: record người chơi, `gain/spend/credit`, rank 15 bậc, TIERS 30, newbie multiplier, hằng `GACHA_*` |
| `src/utils/game.js` | **Luật chơi**: cooldown, tỉ lệ `hitChance`, role sync, possession (bắt cóc), prison (hầm), effects, farm chat, `TUNE` |
| `src/utils/shop.js` / `items.js` / `inventory.js` | Shop 5 món/lần + restock, định nghĩa item, túi đồ người chơi |
| `src/utils/gate.js` | Cổng lọc member qua invite code |
| `src/utils/history.js` | Nhật ký thao tác dev → `data/history.json` |
| `src/utils/duatop.js` / `stats.js` | Đấu trường top + thống kê |
| `config/index.js` | Đọc `.env` qua dotenv — **không** hardcode secret |

---

## 3. Quy ước module lệnh

Mỗi file trong `src/commands/<nhóm>/` export:

```js
module.exports = {
  data: new SlashCommandBuilder()...,   // bắt buộc với slash
  name: "?spam",                        // prefix command (nhóm spam)
  async execute(interaction) {...},     // slash / prefix
  async onComponent(interaction) {...}, // button / select / modal
};
```

**Routing component:** `discord-bot.js` so `customId.split("_")[0]` với map `COMPONENT_OWNERS` → delegate về `onComponent` của owner. Thêm customId mới → thêm prefix vào map.

```
customId "flex_role"  → owner "flex"    → flexaura.js
customId "tuido_use"  → owner "tuido"   → tuido.js
```

---

## 4. Vòng đời data

- `data/*.json` — **gitignore**; bot tự tạo khi chạy lần đầu.
- Ghi: debounce (không ghi mỗi tick), flush khi tắt process.
- **Test backup/restore** — mọi test tự save/restore `data/*.json`; exit-handler restore phải đăng ký **SAU** `require` module (sau khi aura.js đăng ký flush của nó — flush chạy trước, restore đè sau).

---

## 5. Role sync

`game.syncTierRole(member)` chạy sau mọi thay đổi aura:

1. Tính target = mốc cao nhất ≤ aura (`TIER_ROLES`).
2. Loop 30 key: `ensureRole` (tạo nếu thiếu, cache theo `${guildId}:${key}`) → gán đúng 1 role mốc, gỡ role mốc khác.
3. Custom role: ≥15M + đã đặt tên → tạo `AURA <tên>` (màu `#00cec9`), gỡ custom cũ; <15M → gỡ hết custom.

Role tạo qua `guild.roles.create({ name, colors: { primaryColor }, reason })` — discord.js v14.27.

---

## 6. Sticky & auto-delete

- **Sticky:** tin lệnh → pin logic (debounce) trong kênh — chống spam tin hướng dẫn.
- **Auto-delete 2 tầng:** xóa tin lệnh + reply sau khi xử lý (best-effort, catch mọi lỗi — Discord race với instance khác là bình thường).

---

## 7. Multi-instance / cloud

- Host cloud (Procfile worker) là bản chạy chính — **cùng token = chỉ được 1 instance**.
- Lỗi `Unknown interaction` / `40060` / `REST<400` = instance thứ hai thắng race — **không phải bug**.
- Instrumentation debug trong `discord-bot.js` giữ nguyên để quan sát race.

---

## 8. Style code

- ES2022 CommonJS — **không** ESM, không TypeScript.
- Tên file/lệnh **ASCII**; nội dung embed tiếng Việt có dấu.
- Slash description **≤ 100 ký tự** (Discord limit).
- Embed game **bắt buộc hiển thị thông số** (tỉ lệ, cd, cut…) — rule xuyên suốt.
- Logger: `src/utils/logger.js` → console + `logs/bot.log`.
- Tôn trọng pattern hiện có trước khi thêm abstraction mới.

---

Quay lại [README](../README.md) · [TESTING.md](TESTING.md)
