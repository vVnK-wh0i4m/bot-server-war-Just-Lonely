# 🧪 Kiểm thử — JUST LONELY AURA BOT

Zero-dependency: test là **script Node thuần**, chạy thẳng bằng `node`.

---

## 1. Chạy

```bash
npm test
```

Chạy tuần tự 6 suite (~40s):

| Suite | Assertions | Phạm vi |
|-------|:----------:|---------|
| `tests/test_gacha.js` | 46 | Win band, pity, item, extra chain, cut — queue `Math.random` kịch bản S1–S7 |
| `tests/test_reflect_shop.js` | 36 | Reflect ❔ shop,定价 shop, restock, item |
| `tests/test_danhsach.js` | 41 | Danh sách bắt cóc, bỏ sở hữu, bù aura |
| `tests/test_sticky.js` | 26 | Sticky debounce, adopt, auto-delete |
| `tests/test_release.js` | 20 | Release/escape tù, payment |
| `tests/test_economy.js` | 48 | 15 phân hạng, 30 tier, newbie ×10/×5/×2, sync role mốc + custom, flexaura button/modal, duaura cap |
| **Tổng** | **217** | |

Chạy riêng 1 suite:

```bash
node tests/test_gacha.js
```

Kết quả kỳ vọng: `RESULT: 46 pass, 0 fail` hoặc `PASS 41 assertions` — exit code `0`.

---

## 2. Nguyên tắc bất thành văn

1. **Backup + restore `data/*.json`** — mọi test phải trả data về đúng trạng thái đầu, kể cả khi THROW.
2. **Exit-handler restore đăng ký SAU khi `require` module game** — aura.js đăng ký flush lúc require; handler restore của test phải chạy **sau** flush đó, không thì data test bị flush đè lại lúc thoát.
3. **Không gọi Discord thật** — mock `interaction`, `guild`, `member` thủ công.
4. **Math.random queue** — test gacha đẩy array giá trị `0/1/...` (0 = thắng band trên, 1 = thua…) rồi assert chuỗi kết quả đúng kịch bản. Tiêu hết queue = fail có chủ đích (bắt unexpected branch).

---

## 3. Mock Discord tối thiểu

Pattern dùng chung (xem `tests/test_economy.js`):

```js
const guild = {
  id: "g1",
  roles: {
    everyone: { id: "e" },
    cache: { get: id => ..., find: fn => ... },
    create: async ({ name }) => ({ id: "rc"+ ++rid, name, managed: false }),
  },
  members: {
    me: { permissions: { has: () => true } },   // luôn có Manage Roles
    fetch: async () => null,
  },
};

const member = {
  id, guild,
  roles: {
    cache: { has, get, find, filter, some },    // Collection-like
    add: async (role) => ...,                   // ghi lại added[]
    remove: async (role) => ...,                // ghi lại removed[]
  },
};
```

`interaction` mock: `{ user, member, guild, options: { getUser }, reply: async p => ..., showModal: async m => ... }`.

> ⚠️ Mock phải đủ method mà code **thực sự gọi** — `syncTierRole` dùng `cache.filter` iterable; thiếu = test fail (đúng hướng — bắt regression).

---

## 4. Viết test mới

1. Copy pattern backup/restore từ test bất kỳ.
2. Đặt file `tests/test_<tên>.js`, không hardcode đường dẫn — dùng `BOT = path.resolve(__dirname, "..")`.
3. Chạy riêng trước, rồi thêm vào chuỗi `npm test` trong `package.json`.
4. Assertions dạng `ok(cond, "mô tả tiếng Việt")` → output dễ đọc log.

---

## 5. CI (tự thêm khi cần)

Chưa có CI trên repo. Khi thêm GitHub Actions — chỉ cần:

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npm install
- run: npm test
```

Test không network → chạy sạch trên runner.

---

Quay lại [README](../README.md) · [ARCHITECTURE.md](ARCHITECTURE.md)
