const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const logger = require("./utils/logger");
const { ALLOWED_GUILD } = require("./utils/duatop");

// Lệnh chỉ được deploy vào 1 server duy nhất
const GUILD_ONLY = new Set(["duatop"]);

async function collect() {
  const global = [];
  const guild = [];

  // Chỉ deploy slash command. Lệnh phá hoại dùng prefix ? / n? nên không deploy.
  for (const dirName of ["general", "spam", "dev", "game"]) {
    const dir = path.join(__dirname, "commands", dirName);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "shared.js");
    for (const file of files) {
      try {
        const mod = require(path.join(dir, file));
        const list = Array.isArray(mod) ? mod : [mod];
        for (const command of list) {
          if (!command.data) continue;
          const json = command.data.toJSON();
          (GUILD_ONLY.has(json.name) ? guild : global).push(json);
        }
      } catch (err) {
        logger.error(`Failed to load ${file} for deploy: ${err.message}`);
      }
    }
  }

  return { global, guild };
}

async function deploy() {
  const { global, guild } = await collect();
  const rest = new REST({ version: "10" }).setToken(config.token);

  try {
    await rest.put(Routes.applicationCommands(config.clientId), { body: global });
    logger.success(`Deployed ${global.length} global commands (${global.map((c) => c.name).join(", ")}).`);

    if (guild.length) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, ALLOWED_GUILD), { body: guild });
      logger.success(`Deployed ${guild.length} guild commands for ${ALLOWED_GUILD} (${guild.map((c) => c.name).join(", ")}).`);
    }
  } catch (err) {
    logger.error(`Deploy failed: ${err.message}`);
  }
}

deploy();
