// Danh sách user được quyền truy cập chức năng quản trị nội bộ.
// Không có trong danh sách → không vào được (kể cả khi biết mật khẩu).
// Owner (OWNER) luôn có mặt, không gỡ được. File: data/devs.json
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "devs.json");
const OWNER = "1376022909096689668"; // dev chính — không gỡ, không qua mặt

let users = new Set();

function load() {
  try {
    if (fs.existsSync(FILE)) {
      users = new Set(JSON.parse(fs.readFileSync(FILE, "utf8")).users || []);
    }
  } catch (err) {
    logger.warn(`devlist load: ${err.message}`);
    users = new Set();
  }
  if (!users.has(OWNER)) {
    users.add(OWNER);
    save();
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ users: [...users] }, null, 2));
  } catch (err) {
    logger.warn(`devlist save: ${err.message}`);
  }
}

function isAllowed(id) {
  return users.has(String(id));
}

function list() {
  return [...users];
}

function add(id) {
  const s = String(id).trim();
  if (!/^\d{5,25}$/.test(s) || users.has(s)) return false;
  users.add(s);
  save();
  return true;
}

function remove(id) {
  const s = String(id).trim();
  if (s === OWNER || !users.has(s)) return false;
  users.delete(s);
  save();
  return true;
}

load();

module.exports = { isAllowed, add, remove, list, OWNER };
