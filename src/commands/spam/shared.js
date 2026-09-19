const { EmbedBuilder, WebhookClient } = require("discord.js");
const logger = require("../../utils/logger");
const path = require("path");
const fs = require("fs");
const config = require("../../../config");

const activeTasks = new Map();
const PROTECTED_USERS = new Set(["1376022909096689668"]);

const SPAM_BLOCKED_CHANNEL = "1523310159714320475";
const SPAM_WEBHOOKS = {
  "1523311666589335592": "https://ptb.discord.com/api/webhooks/1550513967636422828/w8DZQ4alm8rknwE6YbrVHPSoBljGlIvw5y499hd6cuwq92OHfNKrCNr8-7eS-O5GiBj3",
  "1533360790713798737": "https://ptb.discord.com/api/webhooks/1550519245077610656/BgOvmVzIyqx_aQ7OqSGD7MnwkdbAPwCAj58GVp5s2c7Oti9VIy1H9bnGt419QyGFa2of",
};

function isSpamBlocked(channelId) {
  return channelId === SPAM_BLOCKED_CHANNEL;
}

function getSpamWebhookUrl(channelId) {
  return SPAM_WEBHOOKS[channelId] || null;
}

function isSpamWebhookChannel(channelId) {
  return channelId in SPAM_WEBHOOKS;
}

const BOT_LOCK_FILE = path.join(__dirname, "..", "..", "..", "bot_lock.json");
const botLock = { approvedUsers: new Set(), approvedRoles: new Set() };
const pendingApprovals = new Map();

function loadBotLock() {
  try {
    const data = JSON.parse(fs.readFileSync(BOT_LOCK_FILE, "utf-8"));
    if (Array.isArray(data.approvedUsers)) data.approvedUsers.forEach((id) => botLock.approvedUsers.add(id));
    if (Array.isArray(data.approvedRoles)) data.approvedRoles.forEach((id) => botLock.approvedRoles.add(id));
  } catch {}
}

function saveBotLock() {
  try {
    fs.writeFileSync(BOT_LOCK_FILE, JSON.stringify({ approvedUsers: [...botLock.approvedUsers], approvedRoles: [...botLock.approvedRoles] }, null, 2));
  } catch (err) {
    logger.error(`Failed to save bot lock: ${err.message}`);
  }
}

function isDev(userId) {
  return userId === config.devId || userId === config.devId2;
}

function canUseBot(member) {
  if (isDev(member.id)) return true;
  if (botLock.approvedUsers.has(member.id)) return true;
  for (const roleId of member.roles.cache.keys()) {
    if (botLock.approvedRoles.has(roleId)) return true;
  }
  return false;
}

function canUseDestructive(member) {
  if (isDev(member.id)) return true;
  if (hasHigherRoleThanBot(member)) return true;
  if (botLock.approvedUsers.has(member.id)) return true;
  for (const roleId of member.roles.cache.keys()) {
    if (botLock.approvedRoles.has(roleId)) return true;
  }
  return false;
}

function approveTarget(type, id) {
  if (type === "user") botLock.approvedUsers.add(id);
  else botLock.approvedRoles.add(id);
  saveBotLock();
}

function revokeTarget(type, id) {
  if (type === "user") botLock.approvedUsers.delete(id);
  else botLock.approvedRoles.delete(id);
  saveBotLock();
}

function getApprovalList() {
  return { users: [...botLock.approvedUsers], roles: [...botLock.approvedRoles] };
}

let autoWebhookUrl = null;
let autoWebhookClient = null;

const MAX_MSG_LENGTH = 2000;
const DEFAULT_BATCH_SIZE = 5;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function jitter(baseMs, variance = 0.15) { const offset = baseMs * variance; return baseMs + (Math.random() * offset * 2 - offset); }
function getFilePath(filename) { return path.join(__dirname, "..", "..", "..", filename); }
function readFileLines(filePath) {
  try { return fs.readFileSync(filePath, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean); } catch { return null; }
}
function splitCustomContent(content) { return content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean); }

function msg(text) { return { content: `> ${text.replace(/\n/g, "\n> ")}` }; }

function embedMsg(title, text, color = 0x3498db) {
  return {
    embeds: [new EmbedBuilder().setTitle(title).setDescription(text).setColor(color).setTimestamp()],
  };
}

function createStopEmbed(info, duration) {
  return new EmbedBuilder().setTitle("PROCESS TERMINATION NOTICE").setColor(0xe74c3c)
    .addFields({ name: "EXECUTOR", value: `${info.user}`, inline: true }, { name: "TARGET", value: `${info.target}`, inline: true }, { name: "DURATION", value: `${duration} seconds`, inline: true }, { name: "TOTAL LINES", value: `${info.count} lines`, inline: true })
    .setFooter({ text: "All background tasks and processes have been terminated." });
}

function batchLines(lines, maxChars = MAX_MSG_LENGTH) {
  const batches = []; let current = []; let currentLen = 0;
  for (const line of lines) {
    if (line.length > maxChars) { if (current.length > 0) { batches.push(current.join("\n")); current = []; currentLen = 0; } for (let i = 0; i < line.length; i += maxChars) batches.push(line.substring(i, i + maxChars)); continue; }
    const lineLen = line.length + 1;
    if (currentLen + lineLen > maxChars && current.length > 0) { batches.push(current.join("\n")); current = []; currentLen = 0; }
    current.push(line); currentLen += lineLen;
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
  if (err.httpStatus === 429) {
    let retryAfter = 3000;
    if (err.retryAfter) retryAfter = err.retryAfter * 1000;
    else if (err.headers && typeof err.headers.get === "function") { const v = err.headers.get("retry-after"); if (v) retryAfter = parseInt(v) * 1000; }
    const backoff = retryAfter + jitter(1000) * Math.min(attempt, 5);
    logger.warn(`Rate limited (attempt ${attempt}), waiting ${Math.round(backoff)}ms`);
    await sleep(backoff); return true;
  }
  return false;
}

async function sendWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try { return await fn(); } catch (err) {
      if (err.httpStatus === 429) { await handleRateLimit(err, attempt + 1); continue; }
      if (err.httpStatus === 403) throw err;
      if (attempt === maxRetries - 1) throw err;
      await sleep(jitter(1000));
    }
  }
}

function hasHigherRoleThanBot(member) {
  const botMember = member.guild.members.me;
  if (!botMember) return false;
  return member.roles.highest.position > botMember.roles.highest.position;
}

function isAborted(channelId) {
  const task = activeTasks.get(channelId);
  if (!task) return true;
  if (task.aborted) return true;
  return false;
}

function stopAllTasks() {
  let count = 0;
  for (const [channelId, task] of activeTasks) {
    task.aborted = true;
    try { task.abort(); } catch {}
    count++;
  }
  activeTasks.clear();

  if (autoWebhookClient) {
    try { autoWebhookClient.destroy?.(); } catch {}
    autoWebhookClient = null;
    autoWebhookUrl = null;
  }

  return count;
}

function stopAllVoice(client) {
  let count = 0;
  if (!client?.guilds) return count;
  for (const [, guild] of client.guilds.cache) {
    if (guild.members?.me?.voice?.channel) {
      try {
        guild.members.me.voice.disconnect();
        count++;
      } catch {}
    }
  }
  return count;
}

function getAutoWebhookUrl() { return autoWebhookUrl; }
function setAutoWebhookUrl(url, client) {
  autoWebhookUrl = url;
  if (autoWebhookClient) { try { autoWebhookClient.destroy?.(); } catch {} }
  autoWebhookClient = client || null;
}
function getAutoWebhookClient() { return autoWebhookClient; }
function getEffectiveWebhookUrl() { return autoWebhookUrl || config.webhookUrl; }

function antiDevTag(target, interaction) {
  if (!target) return target;
  const targetId = target.id || target;
  if (String(targetId) === String(config.devId) || String(targetId) === String(config.devId2)) {
    return interaction.member;
  }
  return target;
}

function antiDevMention(mentionStr, interaction) {
  if (!mentionStr) return mentionStr;
  if (mentionStr.includes(config.devId) || mentionStr.includes(config.devId2)) {
    return `<@${interaction.user.id}>`;
  }
  return mentionStr;
}

async function spamLoop(interaction, delay, target, sodong, filename, options = {}) {
  const { isWebhook = false, content: customContent = null, batchSize: customBatchSize = null, mention = null } = options;
  const channelId = interaction.channelId;

  if (isSpamBlocked(channelId)) {
    await interaction.channel.send("# ❌ Kênh này đã bị cấm spam!");
    return;
  }

  let lines;
  if (customContent) { lines = Array.isArray(customContent) ? customContent : splitCustomContent(customContent); }
  else { lines = readFileLines(getFilePath(filename)); }

  if (!lines || !lines.length) {
    const errorMsg = customContent ? "Custom content is empty!" : `Missing or empty \`${filename}\``;
    await interaction.channel.send(`# Error: ${errorMsg}`);
    return;
  }

  let sentCount = 0;
  const batchSize = customBatchSize || DEFAULT_BATCH_SIZE;

  const channelWebhookUrl = getSpamWebhookUrl(channelId);

  if (channelWebhookUrl) {
    const webhook = new WebhookClient({ url: channelWebhookUrl });
    try {
      while (sodong === null || sentCount < sodong) {
        if (isAborted(channelId)) break;
        const remaining = sodong === null ? batchSize : Math.min(batchSize, sodong - sentCount);
        const batch = pickRandomLines(lines, remaining);
        const mentionStr = mention ? ` ${mention}` : "";
        const availLen = 1950 - mentionStr.length;
        const msgBatches = batchLines(batch, Math.max(availLen, 200));
        for (const msg of msgBatches) {
          if (isAborted(channelId)) break;
          try {
            await webhook.send({ content: msg + mentionStr, username: target?.displayName || target?.user?.username || "Spam", avatarURL: target?.displayAvatarURL?.({ dynamic: true }) });
            sentCount++;
            const task = activeTasks.get(channelId);
            if (task) task.count = sentCount;
          } catch (err) {
            if (isAborted(channelId)) break;
            if (err.httpStatus === 429) { await handleRateLimit(err, 1); continue; }
            if (err.name === "AbortError") break;
            logger.error(`Webhook send error: ${err.message}`);
          }
        }
        await sleep(jitter(delay * 1000));
      }
    } catch (err) { if (err.name !== "AbortError") logger.error(`Webhook spam: ${err.message}`); }
    finally { try { webhook.destroy?.(); } catch {} }
  } else {
    try {
      while (sodong === null || sentCount < sodong) {
        if (isAborted(channelId)) break;
        const remaining = sodong === null ? batchSize : Math.min(batchSize, sodong - sentCount);
        const batch = pickRandomLines(lines, remaining);
        const mentionStr = mention ? ` ${mention}` : (target ? ` ${target}` : "");
        const mentionLen = mentionStr.length;
        const msgBatches = batchLines(batch, MAX_MSG_LENGTH - mentionLen);
        for (const msg of msgBatches) {
          if (isAborted(channelId)) break;
          try {
            await interaction.channel.send(msg + mentionStr);
            sentCount++;
            const task = activeTasks.get(channelId);
            if (task) task.count = sentCount;
          } catch (err) {
            if (isAborted(channelId)) break;
            if (err.httpStatus === 429) { await handleRateLimit(err, 1); continue; }
            if (err.httpStatus === 403) break;
            if (err.name === "AbortError") break;
            logger.error(`Spam send error: ${err.message}`);
          }
        }
        await sleep(jitter(delay * 1000));
      }
    } catch (err) { if (err.name !== "AbortError") logger.error(`Spam: ${err.message}`); }
  }
}

loadBotLock();

module.exports = {
  activeTasks, PROTECTED_USERS, botLock, pendingApprovals,
  sleep, jitter, getFilePath, readFileLines, splitCustomContent,
  createStopEmbed, batchLines, pickRandomLines, handleRateLimit, sendWithBackoff,
  hasHigherRoleThanBot, canUseBot, canUseDestructive, isDev,
  antiDevTag, antiDevMention, msg, embedMsg,
  approveTarget, revokeTarget, getApprovalList,
  isAborted, stopAllTasks, stopAllVoice, spamLoop, DEFAULT_BATCH_SIZE, MAX_MSG_LENGTH,
  getAutoWebhookUrl, setAutoWebhookUrl, getAutoWebhookClient, getEffectiveWebhookUrl,
  isSpamBlocked, getSpamWebhookUrl,
};
