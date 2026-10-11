const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const duatop = require("../../utils/duatop");
const history = require("../../utils/history");

// Tin ẩn tự xóa sau 1 phút
const EPHEMERAL_LIFETIME = 60 * 1000;

async function sendEphemeral(interaction, payload) {
  const opts = { ...payload, ephemeral: true };
  let msg;
  if (interaction.deferred && !interaction.replied) {
    msg = await interaction.editReply(opts);
  } else if (interaction.replied) {
    msg = await interaction.followUp(opts);
  } else {
    msg = await interaction.reply(opts);
  }

  setTimeout(() => {
    if (msg?.delete) msg.delete().catch(() => {});
    else interaction.deleteReply().catch(() => {});
  }, EPHEMERAL_LIFETIME);

  return msg;
}

function isAllowedGuild(interaction) {
  return interaction.guildId === duatop.ALLOWED_GUILD;
}

function isAdmin(interaction) {
  return !!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("duatop")
    .setDescription("Tạo / cập nhật bảng xếp hạng mời tương tác (chỉ server được phép, dev/admin)"),

  // Chỉ dev/admin gõ được lệnh, và chỉ ở server được phép
  async execute(interaction, client) {
    if (!isAllowedGuild(interaction)) {
      return interaction.reply({
        content: `❌ Lệnh này chỉ dùng trong server \`${duatop.ALLOWED_GUILD}\`.`,
        ephemeral: true,
      });
    }
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "❌ Chỉ dev/admin mới gõ được lệnh này.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { channel } = await duatop.publishBoard(interaction.guild, client);
      history.record("duatop", "board.publish", {
        user: interaction.user.tag,
        guild: interaction.guildId,
        detail: `#${channel.name}`,
      });
      await interaction.editReply({
        content: `✅ Đã đăng/cập nhật bảng xếp hạng tại ${channel} (tin được ghim, tương tác được).`,
      });
    } catch (err) {
      history.record("duatop", "board.publish", {
        user: interaction.user.tag,
        guild: interaction.guildId,
        detail: err.message,
        ok: false,
      });
      await interaction.editReply(`❌ Lỗi: \`${err.message}\``);
    }
  },

  // Nút / ô chọn trên bảng — mọi thành viên đều bấm được
  async onComponent(interaction, client) {
    const id = interaction.customId;

    try {
      if (id === "duatop_create") {
        if (!isAllowedGuild(interaction)) {
          return sendEphemeral(interaction, { content: "❌ Chỉ dùng trong server được phép." });
        }

        let created;
        try {
          created = await duatop.createInvite(interaction.guild, interaction.user.id, interaction.user.tag);
        } catch (err) {
          history.record("duatop", "invite.create", {
            user: interaction.user.tag,
            guild: interaction.guildId,
            detail: err.message,
            ok: false,
          });
          return sendEphemeral(interaction, { content: `❌ Không tạo được link: \`${err.message}\`` });
        }

        const payload = duatop.renderTopEmbed(client, interaction.guildId, interaction.user.id);
        payload.content = `🔗 Link mời của bạn (đã thêm vào danh sách quản lý):\n${created.url}`;
        await sendEphemeral(interaction, payload);
        await duatop.refreshBoard(client, interaction.guildId);
        return;
      }

      if (id === "duatop_board") {
        return sendEphemeral(interaction, duatop.renderTopEmbed(client, interaction.guildId, interaction.user.id));
      }

      if (id === "duatop_members") {
        return sendEphemeral(interaction, duatop.renderMembersEmbed(interaction.guildId, interaction.user.id));
      }

      if (id === "duatop_select") {
        const target = interaction.values?.[0]?.replace("duatop_user_", "");
        if (!target) return;
        return sendEphemeral(interaction, duatop.renderCreatorEmbed(interaction.guildId, target));
      }

      return sendEphemeral(interaction, { content: "❓ Không rõ thao tác." });
    } catch (err) {
      history.record("duatop", id, {
        user: interaction.user.tag,
        guild: interaction.guildId,
        detail: err.message,
        ok: false,
      });
      return sendEphemeral(interaction, { content: `❌ Lỗi: \`${err.message}\`` });
    }
  },
};
