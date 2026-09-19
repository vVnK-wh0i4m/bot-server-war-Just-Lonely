const fs = require("fs");

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

function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

module.exports = {
  info(msg) {
    console.log(`${COLORS.cyan}[${timestamp()}]${COLORS.reset} ${msg}`);
  },
  success(msg) {
    console.log(`${COLORS.green}[${timestamp()}] ✓${COLORS.reset} ${msg}`);
  },
  warn(msg) {
    console.log(`${COLORS.yellow}[${timestamp()}] ⚠${COLORS.reset} ${msg}`);
  },
  error(msg) {
    console.error(`${COLORS.red}[${timestamp()}] ✖${COLORS.reset} ${msg}`);
  },
  cmd(msg) {
    console.log(`${COLORS.magenta}[${timestamp()}] >${COLORS.reset} ${msg}`);
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
