require("dotenv").config();
const path = require("path");

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  webhookUrl: process.env.WEBHOOK_URL,

  customPrefix: process.env.CUSTOM_PREFIX || ".",

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    chains: {
      low: (process.env.GEMINI_MODELS_LOW || ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"].join(",")).split(",").map((s) => s.trim()).filter(Boolean),
      med: (process.env.GEMINI_MODELS_MED || ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"].join(",")).split(",").map((s) => s.trim()).filter(Boolean),
      high: (process.env.GEMINI_MODELS_HIGH || ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"].join(",")).split(",").map((s) => s.trim()).filter(Boolean),
    },
    classifierModel: process.env.GEMINI_CLASSIFIER_MODEL || "gemini-3.5-flash-lite",
    minIntervalMs: parseInt(process.env.GEMINI_MIN_INTERVAL_MS || "7000", 10),
    softDailyCap: parseInt(process.env.GEMINI_DAILY_CAP || "180", 10),
    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS || "60000", 10),
  },

  guildId: process.env.GUILD_ID || "",

  dirs: {
    root: path.resolve(__dirname, ".."),
    music: path.resolve(__dirname, "..", "music"),
    data: path.resolve(__dirname, ".."),
  },

  welcome: {
    welcomeChannelId: "1484963734333030430",
    logChannelId: "1472825642620813315",
    autoRoleId: "1475407525028302898",
  },

  channels: {
    welcome: "1484963734333030430",
    rule: "1484920775877328906",
    noti: "1485290711388655777",
    chatting: "1472825642620813315",
    bot: "1485290711388655777",
    share: "1485644556958568448",
    music: "1484945514943349067",
    musicVc: "1485575096050384948",
    sell: "1485307271700283634",
  },

  devId: "1376022909096689668",
  devId2: "1485881926383308951",

  staffRoleIds: [
    "1475407197453156372",
    "1484916165112369192",
    "1484955956566819027",
  ],

  modRoleIds: [
    "1475407197453156372",
    "1484916165112369192",
    "1484955956566819027",
    "1485300192700796958",
  ],

  inviteRegex: /(discord\.gg\/|discord\.com\/invite\/)[a-zA-Z0-9]+/,

  protectedUserIds: ["1376022909096689668"],
};
