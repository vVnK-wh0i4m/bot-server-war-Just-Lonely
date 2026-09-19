const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const logger = require("./utils/logger");
const { loadCommands, loadEvents } = require("./utils/loader");
const { isDev, canUseBot, approveTarget, pendingApprovals } = require("./commands/spam/shared");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

loadCommands(client);
loadEvents(client);

const EXEMPT_COMMANDS = new Set(["bot_lock_cmd", "unlock_bot", "check", "devinfo", "help", "anxin", "nhapkey", "keymanager"]);

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    logger.cmd(`${interaction.user.tag} -> /${interaction.commandName}`);

    if (!EXEMPT_COMMANDS.has(interaction.commandName) && interaction.guild) {
      if (!canUseBot(interaction.member)) {
        const embed = new EmbedBuilder()
          .setTitle("ACCESS DENIED")
          .setColor(0xe74c3c)
          .setDescription("You don't have permission to use this bot.\nOnly the bot developer or approved users can use it.")
          .setFooter({ text: "Ask the dev to approve you with /bot_lock_cmd" })
          .setTimestamp();

        try {
          const devUser = await client.users.fetch(config.devId);
          await devUser.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("ACCESS ATTEMPT")
                .setColor(0xf39c12)
                .setDescription(`${interaction.user} (${interaction.user.id}) tried to use \`/${interaction.commandName}\`.`)
                .addFields({ name: "Server", value: interaction.guild?.name || "DM", inline: true })
                .setTimestamp(),
            ],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`botlock_approve_${interaction.user.id}`).setLabel("Allow").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`botlock_deny_${interaction.user.id}`).setLabel("Deny").setStyle(ButtonStyle.Danger)
              ),
            ],
          }).catch(() => {});
        } catch {}

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    try {
      await command.execute(interaction, client);
    } catch (err) {
      logger.error(`Error in /${interaction.commandName}: ${err.message}`);
      const reply = { content: `Error: ${err.message}`, ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  }

  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId.startsWith("botlock_approve_")) {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({ content: "# Only the bot developer can approve!", ephemeral: true });
      }
      const targetId = customId.replace("botlock_approve_", "");
      approveTarget("user", targetId);
      pendingApprovals.delete(targetId);

      const embed = new EmbedBuilder().setTitle("ACCESS GRANTED").setColor(0x2ecc71).setDescription(`User <@${targetId}> can now use the bot.`).setTimestamp();

      const row = interaction.message.components[0];
      if (row) {
        const disabledRow = { type: 1, components: row.components.map((c) => ({ ...c.data, disabled: true })) };
        await interaction.update({ embeds: [embed], components: [disabledRow] });
      } else {
        await interaction.update({ embeds: [embed] });
      }

      try {
        const targetUser = await client.users.fetch(targetId);
        await targetUser.send({
          embeds: [new EmbedBuilder().setTitle("ACCESS GRANTED").setColor(0x2ecc71).setDescription(`Your access request for the bot has been **approved**!`).setTimestamp()],
        }).catch(() => {});
      } catch {}
    }

    if (customId.startsWith("botlock_deny_")) {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({ content: "# Only the bot developer can deny!", ephemeral: true });
      }
      const targetId = customId.replace("botlock_deny_", "");
      pendingApprovals.delete(targetId);

      const embed = new EmbedBuilder().setTitle("ACCESS DENIED").setColor(0xe74c3c).setDescription(`User <@${targetId}>'s request was denied.`).setTimestamp();

      const row = interaction.message.components[0];
      if (row) {
        const disabledRow = { type: 1, components: row.components.map((c) => ({ ...c.data, disabled: true })) };
        await interaction.update({ embeds: [embed], components: [disabledRow] });
      } else {
        await interaction.update({ embeds: [embed] });
      }
    }

    if (customId.startsWith("anxin_approve_")) {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({ content: "# Only the bot developer can approve!", ephemeral: true });
      }
      const targetId = customId.replace("anxin_approve_", "");
      approveTarget("user", targetId);
      pendingApprovals.delete(targetId);

      const embed = new EmbedBuilder().setTitle("✅ ĐÃ DUYỆT").setColor(0x2ecc71).setDescription(`User <@${targetId}> đã được mở quyền dùng bot.`).setTimestamp();

      const row = interaction.message.components[0];
      if (row) {
        const disabledRow = { type: 1, components: row.components.map((c) => ({ ...c.data, disabled: true })) };
        await interaction.update({ embeds: [embed], components: [disabledRow] });
      } else {
        await interaction.update({ embeds: [embed] });
      }

      try {
        const targetUser = await client.users.fetch(targetId);
        await targetUser.send({
          embeds: [new EmbedBuilder().setTitle("✅ YÊU CẦU ĐÃ ĐƯỢC DUYỆT").setColor(0x2ecc71).setDescription("Yêu cầu mở bot của bạn đã được dev duyệt! Bây giờ bạn có thể dùng bot.").setTimestamp()],
        }).catch(() => {});
      } catch {}
    }

    if (customId.startsWith("anxin_deny_")) {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({ content: "# Only the bot developer can deny!", ephemeral: true });
      }
      const targetId = customId.replace("anxin_deny_", "");
      pendingApprovals.delete(targetId);

      const embed = new EmbedBuilder().setTitle("❌ ĐÃ TỪ CHỐI").setColor(0xe74c3c).setDescription(`User <@${targetId}>'s request was denied.`).setTimestamp();

      const row = interaction.message.components[0];
      if (row) {
        const disabledRow = { type: 1, components: row.components.map((c) => ({ ...c.data, disabled: true })) };
        await interaction.update({ embeds: [embed], components: [disabledRow] });
      } else {
        await interaction.update({ embeds: [embed] });
      }

      try {
        const targetUser = await client.users.fetch(targetId);
        await targetUser.send({
          embeds: [new EmbedBuilder().setTitle("❌ YÊU CẦU BỊ TỪ CHỐI").setColor(0xe74c3c).setDescription("Yêu cầu mở bot của bạn đã bị dev từ chối.").setTimestamp()],
        }).catch(() => {});
      } catch {}
    }
  }
});

client.login(config.token);
