const { Events, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../../../config");
const logger = require("../../utils/logger");

// Track appealed users to prevent spam
const appealedUsers = new Set();

// Persistent button collectors per channel
const activeModPanels = new Map();

function hasModRole(member) {
  return member.roles.cache.some((r) =>
    config.modRoleIds.includes(r.id)
  );
}

function isStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    hasModRole(member)
  );
}

function isProtected(userId) {
  return (config.protectedUserIds || []).includes(userId);
}

/**
 * Create the ModButtons action row for a muted user.
 */
function createModButtons(targetMember) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mod_unmute_${targetMember.id}`)
      .setLabel("Unmute")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mod_kick_${targetMember.id}`)
      .setLabel("Kick")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`mod_mute24h_${targetMember.id}`)
      .setLabel("Add 24h Mute")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`mod_blacklist_${targetMember.id}`)
      .setLabel("Blacklist (Role)")
      .setStyle(ButtonStyle.Primary)
  );
  return row;
}

/**
 * Create the UserAppealView button row for DM appeal.
 */
function createAppealButtons() {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("user_appeal_submit")
      .setLabel("Submit Appeal")
      .setStyle(ButtonStyle.Primary)
  );
}

/**
 * Create the admin appeal review buttons.
 */
function createAppealAdminButtons(targetUserId) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`appeal_approve_${targetUserId}`)
      .setLabel("Approve Appeal")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`appeal_deny_${targetUserId}`)
      .setLabel("Deny Appeal")
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Setup event listeners for moderation interactions.
 */
function setupModeration(client) {
  // Handle button interactions for mod panel, appeal, etc.
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;

    // --- MOD PANEL BUTTONS ---
    if (customId.startsWith("mod_unmute_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Error: Unauthorized personnel.",
          ephemeral: true,
        });
      }
      const targetId = customId.replace("mod_unmute_", "");
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.timeout(null);
        await interaction.reply({
          content: `✅ Unmuted ${member}.`,
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: "❌ Không có quyền unmute.",
          ephemeral: true,
        });
      }
    }

    if (customId.startsWith("mod_kick_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Error: Unauthorized personnel.",
          ephemeral: true,
        });
      }
      const targetId = customId.replace("mod_kick_", "");
      if (isProtected(targetId)) {
        return interaction.reply({
          content: "❌ Không thể thao tác trên tài khoản được bảo vệ.",
          ephemeral: true,
        });
      }
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.kick("Moderator action via Just Lonely panel.");
        await interaction.reply({
          content: `👢 ${member.user.username} đã bị kick.`,
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: "❌ Lỗi: Hierarchy restriction.",
          ephemeral: true,
        });
      }
    }

    if (customId.startsWith("mod_mute24h_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Error: Unauthorized personnel.",
          ephemeral: true,
        });
      }
      const targetId = customId.replace("mod_mute24h_", "");
      if (isProtected(targetId)) {
        return interaction.reply({
          content: "❌ Không thể thao tác trên tài khoản được bảo vệ.",
          ephemeral: true,
        });
      }
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.timeout(24 * 60 * 60 * 1000, "Extended mute.");
        await interaction.reply({
          content: `⏱️ Timeout 24h cho ${member}.`,
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: "❌ Không có quyền mute.",
          ephemeral: true,
        });
      }
    }

    if (customId.startsWith("mod_blacklist_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Error: Unauthorized personnel.",
          ephemeral: true,
        });
      }
      const targetId = customId.replace("mod_blacklist_", "");
      if (isProtected(targetId)) {
        return interaction.reply({
          content: "❌ Không thể thao tác trên tài khoản được bảo vệ.",
          ephemeral: true,
        });
      }
      const role = interaction.guild.roles.cache.find(
        (r) => r.name === "Blacklist"
      );
      if (!role) {
        return interaction.reply({
          content: "❌ Role 'Blacklist' không tồn tại.",
          ephemeral: true,
        });
      }
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.roles.add(role);
        await interaction.reply({
          content: `🚫 Đã blacklist ${member}.`,
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: "❌ Không có quyền gán role.",
          ephemeral: true,
        });
      }
    }

    // --- USER APPEAL SUBMIT ---
    if (customId === "user_appeal_submit") {
      if (appealedUsers.has(interaction.user.id)) {
        return interaction.reply({
          content:
            "⚠️ Bạn đã gửi appeal rồi. Vui lòng chờ staff xem xét.",
          ephemeral: true,
        });
      }

      appealedUsers.add(interaction.user.id);

      // Disable the button
      const row = interaction.message.components[0];
      if (row) {
        const disabledRow = {
          type: 1,
          components: row.components.map((c) => ({
            ...c.data,
            disabled: true,
            label: c.data.label + " ✓",
          })),
        };
        await interaction.update({ components: [disabledRow] });
      } else {
        await interaction.update({});
      }

      // Send appeal embed to the channel
      const embed = new EmbedBuilder()
        .setTitle("📩 MODERATION APPEAL RECEIVED")
        .setColor(0xffd700)
        .setTimestamp()
        .addFields(
          {
            name: "User",
            value: `${interaction.user} (\`${interaction.user.id}\`)`,
            inline: false,
          },
          { name: "Type", value: "Mute Review Request", inline: true }
        );

      const adminRow = createAppealAdminButtons(interaction.user.id);
      await interaction.channel.send({
        embeds: [embed],
        components: [adminRow],
      });

      await interaction.followUp({
        content: "✅ Appeal của bạn đã được gửi đến staff team.",
        ephemeral: true,
      });
    }

    // --- APPEAL APPROVE ---
    if (customId.startsWith("appeal_approve_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Permission Denied: Unauthorized account.",
          ephemeral: true,
        });
      }
      const targetId = customId.replace("appeal_approve_", "");
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.timeout(null);
        appealedUsers.delete(targetId);

        // Disable all buttons
        const row = interaction.message.components[0];
        if (row) {
          const disabledRow = {
            type: 1,
            components: row.components.map((c) => ({
              ...c.data,
              disabled: true,
            })),
          };
          await interaction.update({
            content: `✅ **Approved**: ${member} đã được unmute bởi ${interaction.user}.`,
            components: [disabledRow],
          });
        } else {
          await interaction.update({
            content: `✅ **Approved**: ${member} đã được unmute bởi ${interaction.user}.`,
          });
        }

        // DM the user
        try {
          const dmEmbed = new EmbedBuilder()
            .setTitle("Appeal Approved")
            .setDescription(
              "Appeal của bạn đã được **chấp thuận**. Bạn đã được unmute."
            )
            .setColor(0x2ecc71);
          await member.send({ embeds: [dmEmbed] });
        } catch {
          // User DMs disabled
        }
      } catch {
        await interaction.reply({
          content: "❌ Member không còn trong server.",
          ephemeral: true,
        });
      }
    }

    // --- APPEAL DENY ---
    if (customId.startsWith("appeal_deny_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Permission Denied: Unauthorized account.",
          ephemeral: true,
        });
      }
      const targetId = customId.replace("appeal_deny_", "");

      const row = interaction.message.components[0];
      if (row) {
        const disabledRow = {
          type: 1,
          components: row.components.map((c) => ({
            ...c.data,
            disabled: true,
          })),
        };
        await interaction.update({
          content: `❌ **Denied**: Appeal bị từ chối bởi ${interaction.user}.`,
          components: [disabledRow],
        });
      } else {
        await interaction.update({
          content: `❌ **Denied**: Appeal bị từ chối bởi ${interaction.user}.`,
        });
      }

      // DM the user
      try {
        const member = await interaction.guild.members.fetch(targetId);
        const dmEmbed = new EmbedBuilder()
          .setTitle("Appeal Denied")
          .setDescription("Appeal của bạn đã bị **từ chối**.")
          .setColor(0xe74c3c);
        await member.send({ embeds: [dmEmbed] });
      } catch {
        // User DMs disabled or not found
      }
    }
  });

  // --- INVITE LINK GUARD ---
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content) return;

    // Skip if user is admin or has mod role
    if (
      message.member.permissions.has(PermissionFlagsBits.Administrator) ||
      hasModRole(message.member) ||
      isProtected(message.author.id)
    )
      return;

    // Check for invite links
    if (!config.inviteRegex.test(message.content)) return;

    // Delete message
    try {
      await message.delete();
    } catch {
      return;
    }

    const reason = "Spamming unauthorized Discord invites.";

    // Mute 12h
    try {
      await message.member.timeout(12 * 60 * 60 * 1000, reason);
    } catch {
      return; // No permission
    }

    // Public log embed
    const emb = new EmbedBuilder()
      .setDescription("**AUTOMATED MODERATION**")
      .setColor(0x2b2d31)
      .setTimestamp()
      .setAuthor({
        name: "JUST LONELY SECURITY",
        iconURL: message.client.user.displayAvatarURL({ dynamic: true }),
      })
      .addFields(
        { name: "User", value: `${message.author}`, inline: true },
        { name: "Action", value: "`Mute (12h)`", inline: true },
        { name: "Reason", value: `*${reason}*`, inline: false }
      )
      .setFooter({ text: "JUST LONELY • Security Module" });

    const modRow = createModButtons(message.member);
    await message.channel.send({ embeds: [emb], components: [modRow] });

    // DM appeal
    try {
      const dm = new EmbedBuilder()
        .setTitle("MODERATION NOTICE")
        .setDescription(
          `Your account has been restricted in **${message.guild.name}**.`
        )
        .setColor(0xe74c3c)
        .addFields(
          { name: "Duration", value: "12 Hours", inline: true },
          { name: "Reason", value: reason, inline: true }
        )
        .setFooter({ text: "Click below to submit a one-time appeal." });

      const appealRow = createAppealButtons();
      await message.author.send({
        embeds: [dm],
        components: [appealRow],
      });
    } catch {
      // User DMs disabled
    }
  });

  // --- WELCOME BUTTONS ---
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    const { customId } = interaction;

    // Greet button
    if (customId.startsWith("welcome_greet_")) {
      const targetId = customId.replace("welcome_greet_", "");
      if (interaction.user.id === targetId) {
        return interaction.reply({ content: "😅 Bạn không thể tự chào chính mình!", ephemeral: true });
      }
      // Check if already greeted (use a simple set per message)
      const msgId = interaction.message.id;
      if (!interaction.message._greeted) interaction.message._greeted = new Set();
      if (interaction.message._greeted.has(interaction.user.id)) {
        return interaction.reply({ content: "Bạn đã chào rồi!", ephemeral: true });
      }
      interaction.message._greeted.add(interaction.user.id);
      await interaction.reply({
        content: `👋 ${interaction.user} đã chào đón <@${targetId}>! Chào mừng bạn đến với server! 🎉`,
      });
    }

    // Verify button (staff only)
    if (customId.startsWith("welcome_verify_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "❌ Bạn không có quyền dùng nút này.", ephemeral: true });
      }
      const targetId = customId.replace("welcome_verify_", "");
      // Disable button
      const row = interaction.message.components[0];
      if (row) {
        const disabledRow = {
          type: 1,
          components: row.components.map((c) => ({
            ...c.data,
            disabled: true,
            label: c.data.label ? `✅ Xác nhận bởi ${interaction.user.displayName}` : c.data.label,
            style: 2, // Secondary
          })),
        };
        await interaction.update({ components: [disabledRow] });
      } else {
        await interaction.update({});
      }
      await interaction.followUp(`✅ <@${targetId}> đã được **${interaction.user}** xác nhận!`);
    }

    // Kick button (staff only)
    if (customId.startsWith("welcome_kick_")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "❌ Bạn không có quyền dùng nút này.", ephemeral: true });
      }
      const targetId = customId.replace("welcome_kick_", "");
      if (isProtected(targetId)) {
        return interaction.reply({ content: "❌ Không thể kick tài khoản được bảo vệ.", ephemeral: true });
      }
      try {
        const member = await interaction.guild.members.fetch(targetId);
        await member.kick(`Kicked by ${interaction.user} via Welcome panel.`);
        // Disable all buttons
        const row = interaction.message.components[0];
        if (row) {
          const disabledRow = {
            type: 1,
            components: row.components.map((c) => ({ ...c.data, disabled: true })),
          };
          await interaction.update({ components: [disabledRow] });
        } else {
          await interaction.update({});
        }
        await interaction.followUp(`👢 **${member.user.username}** đã bị kick bởi ${interaction.user}.`);
      } catch {
        await interaction.reply({ content: "❌ Bot không có quyền kick.", ephemeral: true });
      }
    }
  });
}

module.exports = { setupModeration, createModButtons };
