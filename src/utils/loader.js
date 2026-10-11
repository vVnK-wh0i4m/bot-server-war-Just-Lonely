const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const logger = require("./logger");

const COMMAND_DIRS = ["general", "spam", "dev", "game"];
const SKIP_FILES = ["shared.js"]; // file helper, không phải lệnh

function register(client, command) {
  if (command.data && command.execute) {
    // Slash command (/help, /dev_only)
    client.commands.set(command.data.name, command);
    logger.info(`Loaded slash: /${command.data.name}`);
  } else if (command.name && command.execute) {
    // Prefix command (?spam, ?ngon, n?nuk3...)
    const prefix = command.prefix || "?";
    client.prefixCommands.set(prefix + command.name.toLowerCase(), command);
    logger.info(`Loaded prefix: ${prefix}${command.name}`);
  } else {
    logger.warn(`Skipped invalid command export: ${command?.name || "?"}`);
  }
}

function loadCommands(client) {
  client.commands = new Collection();
  client.prefixCommands = new Collection();

  for (const dirName of COMMAND_DIRS) {
    const dir = path.join(__dirname, "..", "commands", dirName);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") && !SKIP_FILES.includes(f));
    for (const file of files) {
      try {
        // Xóa cache để reload mới khi restart
        delete require.cache[require.resolve(path.join(dir, file))];
        const mod = require(path.join(dir, file));
        const commands = Array.isArray(mod) ? mod : [mod];
        for (const command of commands) register(client, command);
      } catch (err) {
        logger.error(`Failed to load ${file}: ${err.message}`);
      }
    }
  }
}

function loadEvents(client) {
  const eventsDir = path.join(__dirname, "..", "events");
  if (!fs.existsSync(eventsDir)) return;

  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    try {
      const event = require(path.join(eventsDir, file));
      if (event.name && event.execute) {
        // Bắt lỗi đồng bộ VÀ bất đồng bộ — không được để event làm sập bot
        const run = (...args) => {
          try {
            Promise.resolve(event.execute(...args)).catch((err) =>
              logger.error(`event ${event.name} failed: ${err?.stack || err?.message || err}`),
            );
          } catch (err) {
            logger.error(`event ${event.name} threw: ${err.message}`);
          }
        };
        if (event.once) client.once(event.name, run);
        else client.on(event.name, run);
        logger.info(`Loaded event: ${event.name}`);
      }
    } catch (err) {
      logger.error(`Failed to load event ${file}: ${err.message}`);
    }
  }
}

module.exports = { loadCommands, loadEvents };
