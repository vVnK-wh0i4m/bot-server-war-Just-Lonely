const { WebhookClient } = require("discord.js");
const logger = require("../../utils/logger");
const history = require("../../utils/history");
const path = require("path");
const fs = require("fs");

// Tasks spam text đang chạy theo channelId
const activeTasks = new Map();

const MAX_MSG_LENGTH = 2000;
const DEFAULT_BATCH_SIZE = 5;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(baseMs, variance = 0.15) {
  const offset = baseMs * variance;
  return baseMs + (Math.random() * offset * 2 - offset);
}

// ---- File nội dung ở thư mục gốc (ngon.txt / nhay.txt) ----
function getFilePath(filename) {
  return path.join(__dirname, "..", "..", "..", filename);
}

function readFileLines(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

// ---- Dấu "# " trước spam / ngon (chữ to heading trong Discord) ----
function withHashPrefix(lines) {
  return lines.map((l) => (l.startsWith("#") ? l : `# ${l}`));
}

function batchLines(lines, maxChars = MAX_MSG_LENGTH) {
  const batches = [];
  let current = [];
  let currentLen = 0;
  for (const line of lines) {
    if (line.length > maxChars) {
      if (current.length > 0) { batches.push(current.join("\n")); current = []; currentLen = 0; }
      for (let i = 0; i < line.length; i += maxChars) batches.push(line.substring(i, i + maxChars));
      continue;
    }
    const lineLen = line.length + 1;
    if (currentLen + lineLen > maxChars && current.length > 0) { batches.push(current.join("\n")); current = []; currentLen = 0; }
    current.push(line);
    currentLen += lineLen;
  }
  if (current.length > 0) batches.push(current.join("\n"));
  return batches;
}

function pickRandomLines(lines, count) {
  const result = [];
  for (let i = 0; i < count; i++) result.push(lines[Math.floor(Math.random() * lines.length)]);
  return result;
}

async function handleRateLimit(err, attempt) {
  if (err?.httpStatus === 429 || err?.code === 429) {
    let retryAfter = 3000;
    if (err.retryAfter) retryAfter = err.retryAfter * 1000;
    logger.warn(`Rate limited, waiting ${Math.round(retryAfter)}ms`);
    await sleep(retryAfter);
    return true;
  }
  return false;
}

async function sendWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.httpStatus === 429 || err.code === 429) {
        await handleRateLimit(err, attempt + 1);
        continue;
      }
      if (err.httpStatus === 403) throw err;
      if (attempt === maxRetries - 1) throw err;
      await sleep(jitter(1000));
    }
  }
}

function stopAllTasks() {
  let count = 0;
  for (const [, task] of activeTasks) {
    try {
      task.aborted = true;
      task.abort();
    } catch {}
    count++;
  }
  activeTasks.clear();
  return count;
}

// Dừng task đang chạy của 1 kênh trước khi chạy lệnh mới
function abortTaskInChannel(channelId) {
  const task = activeTasks.get(channelId);
  if (!task) return;
  try {
    task.abort();
  } catch {}
  task.aborted = true;
}

// ---- Webhook: TẤT CẢ lệnh spam đều dùng webhook ----
async function getOrCreateWebhook(channel) {
  // 1. Ưu tiên WEBHOOK_URL trong .env (nếu có)
  if (process.env.WEBHOOK_URL) {
    try {
      return new WebhookClient({ url: process.env.WEBHOOK_URL });
    } catch {}
  }
  // 2. Tìm webhook sẵn có của bot trong kênh
  try {
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find((w) => w.token);
    if (existing) return new WebhookClient({ url: `https://discord.com/api/webhooks/${existing.id}/${existing.token}` });
  } catch {}
  // 3. Tự tạo webhook mới (cần quyền ManageWebhooks)
  const created = await channel.createWebhook({ name: "SpamBot-Auto", reason: "Auto-created for spam commands" });
  history.record("action", "webhook.create", {
    guild: channel.guildId,
    detail: `#${channel.name} → ${created.name}`,
  });
  return new WebhookClient({ url: `https://discord.com/api/webhooks/${created.id}/${created.token}` });
}

// Ghi vào lịch sử khi 1 lệnh spam gửi xong
function logSend(command, message, count) {
  history.record("action", `${command}.send`, {
    user: message.author.tag,
    guild: message.guildId,
    detail: `#${message.channel.name || message.channelId}: đã gửi ${count} tin`,
  });
}

// args parser chung cho lệnh prefix ?
// ?spam <delay> <sodong|inf> <nội dung...>
// ?ngon <delay> <sodong|inf>
function parseDelayAndCount(args, defaultDelay = 0.5) {
  let delay = parseFloat(args[0]);
  if (isNaN(delay) || delay < 0.01) delay = defaultDelay;
  if (delay > 600) delay = 600;

  let sodong = null; // null = vô hạn
  if (args[1] && args[1].toLowerCase() !== "inf" && args[1].toLowerCase() !== "infinit") {
    const n = parseInt(args[1], 10);
    if (!isNaN(n) && n > 0) sodong = Math.min(n, 5000);
  }
  return { delay, sodong };
}

// Chuẩn bị mention + tên hiển thị gửi qua webhook
function resolveWebhookIdentity(message) {
  const mentionUser = message.mentions.users.first();
  const mentionRole = message.mentions.roles.first();

  let mentionStr = "";
  let username = message.author.displayName || message.author.username;
  let avatarURL = message.author.displayAvatarURL?.({ dynamic: true });

  if (mentionUser) {
    mentionStr = ` <@${mentionUser.id}>`;
    username = mentionUser.displayName || mentionUser.username;
    avatarURL = mentionUser.displayAvatarURL?.({ dynamic: true });
  } else if (mentionRole) {
    mentionStr = ` <@&${mentionRole.id}>`;
    username = mentionRole.name;
  }

  return { mentionStr, username, avatarURL };
}

module.exports = {
  activeTasks,
  sleep,
  jitter,
  sendWithBackoff,
  stopAllTasks,
  abortTaskInChannel,
  getFilePath,
  readFileLines,
  withHashPrefix,
  batchLines,
  pickRandomLines,
  handleRateLimit,
  getOrCreateWebhook,
  parseDelayAndCount,
  resolveWebhookIdentity,
  logSend,
  DEFAULT_BATCH_SIZE,
};
