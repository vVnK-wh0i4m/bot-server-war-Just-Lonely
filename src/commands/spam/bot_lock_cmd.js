const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { isDev, approveTarget, revokeTarget, getApprovalList, pendingApprovals } = require("./shared");
const config = require("../../../config");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bot_lock_cmd")
    .setDescription("Lock/unlock bot access for users or roles")
    .addSubcommand((sub) =>
      sub.setName("allow")
        .setDescription("Request or grant bot access")
        .addUserOption((o) => o.setName("user").setDescription("User to grant access (dev only)"))
        .addRoleOption((o) => o.setName("role").setDescription("Role to grant access (dev only)"))
    )
    .addSubcommand((sub) =>
      sub.setName("revoke")
        .setDescription("Revoke bot access from a user or role")
        .addUserOption((o) => o.setName("user").setDescription("User to revoke"))
        .addRoleOption((o) => o.setName("role").setDescription("Role to revoke"))
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("List all approved users and roles")
    )
    .addSubcommand((sub) =>
      sub.setName("requests")
        .setDescription("View pending access requests (dev only)")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "allow") {
      const user = interaction.options.getUser("user");
      const role = interaction.options.getRole("role");

      if (!user && !role) {
        if (isDev(interaction.user.id)) {
          return interaction.reply({ content: "# Provide a user or role to grant access!", ephemeral: true });
        }
        const pendingEmbed = new EmbedBuilder()
          .setTitle("ACCESS REQUEST")
          .setColor(0xf39c12)
          .setDescription(`${interaction.user} is requesting bot access.\nDev must approve with \`/bot_lock_cmd requests\`.`)
          .setTimestamp();

        pendingApprovals.set(interaction.user.id, {
          user: interaction.user,
          timestamp: Date.now(),
          type: "self",
        });

        try {
          const devUser = await interaction.client.users.fetch(config.devId);
          await devUser.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("NEW ACCESS REQUEST")
                .setColor(0xf39c12)
                .setDescription(`${interaction.user} (${interaction.user.id}) wants to use the bot.`)
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

        return interaction.reply({ embeds: [pendingEmbed], ephemeral: true });
      }

      if (!isDev(interaction.user.id)) {
        return interaction.reply({ content: "# Only the bot developer can grant access!", ephemeral: true });
      }

      if (user) {
        approveTarget("user", user.id);
        const embed = new EmbedBuilder().setTitle("ACCESS GRANTED").setColor(0x2ecc71).setDescription(`${user} can now use the bot.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (role) {
        approveTarget("role", role.id);
        const embed = new EmbedBuilder().setTitle("ACCESS GRANTED").setColor(0x2ecc71).setDescription(`Role **${role.name}** can now use the bot.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "revoke") {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({ content: "# Only the bot developer can revoke access!", ephemeral: true });
      }
      const user = interaction.options.getUser("user");
      const role = interaction.options.getRole("role");
      if (!user && !role) {
        return interaction.reply({ content: "# Provide a user or role to revoke!", ephemeral: true });
      }
      if (user) {
        revokeTarget("user", user.id);
        const embed = new EmbedBuilder().setTitle("ACCESS REVOKED").setColor(0xe74c3c).setDescription(`${user} can no longer use the bot.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (role) {
        revokeTarget("role", role.id);
        const embed = new EmbedBuilder().setTitle("ACCESS REVOKED").setColor(0xe74c3c).setDescription(`Role **${role.name}** can no longer use the bot.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "list") {
      const list = getApprovalList();
      const userList = list.users.map((id) => `<@${id}>`).join(", ") || "None";
      const roleList = list.roles.map((id) => `<@&${id}>`).join(", ") || "None";
      const embed = new EmbedBuilder()
        .setTitle("BOT ACCESS LIST")
        .setColor(0x3498db)
        .addFields({ name: "Approved Users", value: userList, inline: false }, { name: "Approved Roles", value: roleList, inline: false })
        .setFooter({ text: "Only dev + approved users/roles can use the bot." })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "requests") {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({ content: "# Only the bot developer can view requests!", ephemeral: true });
      }

      if (pendingApprovals.size === 0) {
        return interaction.reply({ content: "# No pending requests.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("PENDING ACCESS REQUESTS")
        .setColor(0xf39c12)
        .setTimestamp();

      for (const [userId, data] of pendingApprovals) {
        embed.addFields({
          name: `${data.user.tag} (${userId})`,
          value: `Requested: <t:${Math.floor(data.timestamp / 1000)}:R>`,
          inline: false,
        });
      }

      const row = new ActionRowBuilder();
      for (const [userId] of pendingApprovals) {
        row.addComponents(
          new ButtonBuilder().setCustomId(`botlock_approve_${userId}`).setLabel(`Allow ${userId}`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`botlock_deny_${userId}`).setLabel(`Deny ${userId}`).setStyle(ButtonStyle.Danger)
        );
        if (row.components.length >= 5) break;
      }

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  },
};
