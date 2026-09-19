const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const logger = require("./utils/logger");

async function deploy() {
  const commands = [];
  const commandDirs = [
    path.join(__dirname, "commands", "general"),
    path.join(__dirname, "commands", "spam"),
    path.join(__dirname, "commands", "voice"),
    path.join(__dirname, "commands", "music"),
  ];

  for (const dir of commandDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      try {
        const mod = require(path.join(dir, file));
        if (mod.data) {
          commands.push(mod.data.toJSON());
        }
        // Exported sub-commands (e.g. nhay, stop, etc.)
        for (const key of Object.keys(mod)) {
          if (mod[key]?.data && key !== "data") {
            commands.push(mod[key].data.toJSON());
          }
        }
      } catch (err) {
        logger.error(`Failed to load ${file} for deploy: ${err.message}`);
      }
    }
  }

  logger.info(`Deploying ${commands.length} commands...`);

  const rest = new REST({ version: "10" }).setToken(config.token);

  try {
    await rest.put(Routes.applicationCommands(config.clientId), {
      body: commands,
    });
    logger.success(`Successfully deployed ${commands.length} commands.`);
  } catch (err) {
    logger.error(`Deploy failed: ${err.message}`);
  }
}

deploy();
