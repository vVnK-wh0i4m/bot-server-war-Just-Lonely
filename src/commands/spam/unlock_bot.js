const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { hasHigherRoleThanBot, unlockTarget, lockTarget, unlockStore } = require("./shared");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock_bot")
    .setDescription("Unlock/lock bot destructive features for a user or role")
    .addSubcommand((sub) =>
      sub.setName("unlock")
        .setDescription("Grant a user/role access to destructive commands")
        .addUserOption((o) => o.setName("user").setDescription("User to unlock"))
        .addRoleOption((o) => o.setName("role").setDescription("Role to unlock"))
    )
    .addSubcommand((sub) =>
      sub.setName("lock")
        .setDescription("Revoke a user/role access to destructive commands")
        .addUserOption((o) => o.setName("user").setDescription("User to lock"))
        .addRoleOption((o) => o.setName("role").setDescription("Role to lock"))
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("List all unlocked users and roles")
    ),

  async execute(interaction) {
    if (!hasHigherRoleThanBot(interaction.member)) {
      return interaction.reply({ content: "# You need a role higher than the bot to manage unlock permissions!", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    if (sub === "unlock") {
      if (!user && !role) {
        return interaction.reply({ content: "# Provide a user or role to unlock!", ephemeral: true });
      }
      if (user) {
        unlockTarget("user", user.id);
        const embed = new EmbedBuilder().setTitle("UNLOCK SUCCESS").setColor(0x2ecc71).setDescription(`User ${user} can now use all bot commands.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (role) {
        unlockTarget("role", role.id);
        const embed = new EmbedBuilder().setTitle("UNLOCK SUCCESS").setColor(0x2ecc71).setDescription(`Role ${role.name} can now use all bot commands.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "lock") {
      if (!user && !role) {
        return interaction.reply({ content: "# Provide a user or role to lock!", ephemeral: true });
      }
      if (user) {
        lockTarget("user", user.id);
        const embed = new EmbedBuilder().setTitle("LOCK SUCCESS").setColor(0xe74c3c).setDescription(`User ${user} can no longer use destructive commands.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (role) {
        lockTarget("role", role.id);
        const embed = new EmbedBuilder().setTitle("LOCK SUCCESS").setColor(0xe74c3c).setDescription(`Role ${role.name} can no longer use destructive commands.`).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "list") {
      const userList = [...unlockStore.users].map((id) => `<@${id}>`).join(", ") || "None";
      const roleList = [...unlockStore.roles].map((id) => `<@&${id}>`).join(", ") || "None";
      const embed = new EmbedBuilder()
        .setTitle("UNLOCKED ACCESS LIST")
        .setColor(0x3498db)
        .addFields({ name: "Users", value: userList, inline: false }, { name: "Roles", value: roleList, inline: false })
        .setFooter({ text: "These users/roles can use destructive bot commands." })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
