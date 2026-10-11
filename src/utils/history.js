const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "history.json");
const MAX_ENTRIES = 500;

let entries = [];
let saveTimer = null;

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      entries = Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    logger.warn(`history load failed: ${err.message}`);
    entries = [];
  }
}

function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(entries, null, 2));
  } catch (err) {
    logger.error(`history save failed: ${err.message}`);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}

// record(type, name, { user, guild, detail, ok })
function record(type, name, opts = {}) {
  entries.push({
    at: Date.now(),
    type,
    name,
    user: opts.user || null,
    guild: opts.guild || null,
    detail: opts.detail || null,
    ok: opts.ok !== false,
  });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  scheduleSave();
}

function recent(limit = 15) {
  return entries.slice(-limit).reverse();
}

function total() {
  return entries.length;
}

function format(entry) {
  if (!entry) return "";
  const time = new Date(entry.at).toLocaleTimeString("vi-VN", { hour12: false });
  const mark = entry.ok ? "✅" : "❌";
  const who = entry.user ? `${entry.user} ` : "";
  const where = entry.guild ? ` @${entry.guild} ` : " ";
  const detail = entry.detail ? ` — ${entry.detail}` : "";
  return `\`${time}\` ${mark} ${who}${entry.type}/${entry.name}${where}${detail}`.trim();
}

load();
// Không mất lịch sử khi bot tắt
process.on("exit", flush);

module.exports = { record, recent, total, format, flush, MAX_ENTRIES };
