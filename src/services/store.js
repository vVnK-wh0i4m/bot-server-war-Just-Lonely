const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function readJson(name, fallback = {}) {
  try {
    ensureDir();
    const p = filePath(name);
    if (!fs.existsSync(p)) return clone(fallback);
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return clone(fallback);
    return JSON.parse(raw);
  } catch {
    return clone(fallback);
  }
}

function writeJson(name, data) {
  ensureDir();
  const p = filePath(name);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

// Ghi trễ (debounce) cho file bị cập nhật liên tục -> đỡ hao I/O
const pending = new Map();
function writeJsonDebounced(name, data, delay = 1500) {
  if (pending.has(name)) clearTimeout(pending.get(name));
  pending.set(
    name,
    setTimeout(() => {
      pending.delete(name);
      try {
        writeJson(name, data);
      } catch {
        /* ignore */
      }
    }, delay)
  );
}

function flushAll() {
  for (const [name, t] of pending) {
    clearTimeout(t);
    pending.delete(name);
  }
}

module.exports = { DATA_DIR, readJson, writeJson, writeJsonDebounced, flushAll };
