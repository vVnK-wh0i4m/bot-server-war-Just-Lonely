# 🤝 Đóng góp — JUST LONELY AURA BOT

Cảm ơn bạn muốn cải thiện bot. Đọc kỹ trước khi PR.

---

## Bắt đầu

```bash
git clone https://github.com/vVnK-wh0i4m/bot-server-war-Just-Lonely.git
cd bot-server-war-Just-Lonely
npm install
cp .env.example .env    # điền token local
npm run deploy
npm start
```

---

## Quy tắc vàng

1. **KHÔNG commit secret** — `.env` nằm trong `.gitignore`; không hardcode token/mật khẩu/webhook trong source. Secret = biến môi trường.
2. **Không hardcode đường dẫn máy cá nhân** trong test/script — dùng `path.resolve(__dirname, "..")`.
3. **Slash description ≤ 100 ký tự**, tên lệnh ASCII.
4. **Embed game phải hiển thị thông số** (tỉ lệ, cooldown, cut…) — triết lý xuyên suốt: không giấu số với người chơi.
5. **Không đổi cách đặt tên customId/component** đang chạy — thêm mới thì thêm prefix vào `COMPONENT_OWNERS` trong `discord-bot.js`.

## Style

- CommonJS, ES2022, không TypeScript/ESM.
- Đọc pattern file lân cận trước khi viết abstraction mới.
- Log qua `src/utils/logger.js` — không `console.log` lung tung.
- Tiếng Việt có dấu trong embed; tên file/lệnh ASCII.

## Test

Mọi thay đổi logic **phải** kèm test hoặc chạy đủ suite:

```bash
npm test        # 217 assertions — phải 0 fail
```

Test mới: copy pattern backup/restore `data/*.json` — xem [docs/TESTING.md](docs/TESTING.md).

Checklist PR:

- [ ] `npm test` pass
- [ ] `node --check` các file sửa
- [ ] Không secret / đường dẫn absolute trong diff
- [ ] Embed mới hiển thị đủ thông số
- [ ] Cập nhật docs nếu đổi cơ chế/số liệu

## Vấn đề & ý tưởng

- Bug: mở issue — kèm bước tái hiện + log (`logs/bot.log`).
- Ý tưởng gameplay: mở issue thảo luận **trước khi** code lớn — cân bằng kinh tế nhạy cảm (xem [docs/ECONOMY.md](docs/ECONOMY.md)).

---

Quay lại [README](README.md)
