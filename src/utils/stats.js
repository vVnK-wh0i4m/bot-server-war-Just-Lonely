// Ghi lại lệnh chạy gần nhất để /dev_only hiển thị
let last = null;

module.exports = {
  record(name, user) {
    last = {
      name,
      user: user?.tag || user?.username || String(user || "?"),
      at: Date.now(),
    };
  },
  get() {
    return last ? { ...last } : null;
  },
};
