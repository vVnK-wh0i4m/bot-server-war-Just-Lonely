const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const logger = require("./logger");

function loadCommands(client) {
  client.commands = new Collection();
  const commandDirs = [
    path.join(__dirname, "..", "commands", "general"),
    path.join(__dirname, "..", "commands", "moderation"),
    path.join(__dirname, "..", "commands", "spam"),
    path.join(__dirname, "..", "commands", "voice"),
    path.join(__dirname, "..", "commands", "music"),
  ];

  for (const dir of commandDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      try {
        const command = require(path.join(dir, file));
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          logger.info(`Loaded command: ${command.data.name}`);
        }
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
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
        logger.info(`Loaded event: ${event.name}`);
      }
    } catch (err) {
      logger.error(`Failed to load event ${file}: ${err.message}`);
    }
  }
}

module.exports = { loadCommands, loadEvents };
