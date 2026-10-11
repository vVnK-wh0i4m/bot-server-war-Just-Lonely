const fs = require("fs");
const path = require("path");

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const LOG_DIR = path.join(__dirname, "..", "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "bot.log");
const MAX_LOG_BYTES = 1024 * 1024; // 1MB rồi sang file .old

function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

// Ghi cả ra file để còn tra khi bot chết giữa chừng
function write(level, msg) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.old`);
    }
    fs.appendFileSync(LOG_FILE, `${timestamp()} [${level}] ${msg}\n`);
  } catch { /* không được để lỗi log giết bot */ }
}

function emit(color, level, prefix, msg) {
  console.log(`${color}[${timestamp()}]${prefix} ${COLORS.reset} ${msg}`);
  write(level, msg);
}

module.exports = {
  info(msg) { emit(COLORS.cyan, "info", "", msg); },
  success(msg) { emit(COLORS.green, "info", " ✓", msg); },
  warn(msg) { emit(COLORS.yellow, "warn", " ⚠", msg); },
  cmd(msg) { emit(COLORS.magenta, "info", " >", msg); },
  error(msg) {
    console.error(`${COLORS.red}[${timestamp()}] ✖${COLORS.reset} ${msg}`);
    write("error", msg);
  },

  readFileLines(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    } catch {
      return null;
    }
  },
};
