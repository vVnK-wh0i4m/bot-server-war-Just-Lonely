const { SlashCommandBuilder } = require("discord.js");
const game = require("../../utils/game");

async function doEscape(interaction) {
  const guild = interaction.guild;
  if (!guild) {
    return game.replyErr(interaction, "❌ Chỉ trong server", "Trốn thoát cần một server để đào hầm!");
  }

  const userId = interaction.user.id;
  const rec = game.prisonOf(guild.id, userId);
  if (!rec) {
    return game.replyErr(interaction, "🕊️ Không trong tù", "Bạn hiện **không** bị nhốt ở tầng hầm nào. Cứ yên tâm quậy!");
  }

  // Defer cả slash lẫn nút — attemptEscape có nhiều API call (giải ngục, quả báo, tạo kênh)
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply().catch(() => {});
  }

  try {
    const res = await game.attemptEscape(guild, userId, interaction.channelId);
    if (!res.ok) {
      return game.replyErr(interaction, "🧱 Chưa thoát được", res.reason);
    }
    const payload = { content: res.content, embeds: [res.embed] };
    if (interaction.deferred && !interaction.replied) return interaction.editReply(payload);
    if (interaction.replied) return interaction.followUp(payload);
    return interaction.reply(payload);
  } catch (err) {
    return game.replyErr(interaction, "❌ Lỗi trốn thoát", `\`${err.message}\``);
  }
}

// 💸 Trả aura để thoát ngay (nút trong kênh tầng hầm)
async function doPay(interaction) {
  const guild = interaction.guild;
  if (!guild) {
    return game.replyErr(interaction, "❌ Chỉ trong server", "Thoát tù cần một server!");
  }
  const userId = interaction.user.id;
  const rec = game.prisonOf(guild.id, userId);
  if (!rec) {
    return game.replyErr(interaction, "🕊️ Không trong tù", "Bạn hiện **không** bị nhốt — chẳng cần trả aura!");
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply().catch(() => {});
  }

  try {
    const res = await game.buyFreedom(guild, userId);
    if (!res.ok) {
      return game.replyErr(interaction, "💸 Chưa đủ aura", res.reason);
    }
    const payload = { content: res.content, embeds: [res.embed] };
    if (interaction.deferred && !interaction.replied) return interaction.editReply(payload);
    if (interaction.replied) return interaction.followUp(payload);
    return interaction.reply(payload);
  } catch (err) {
    return game.replyErr(interaction, "❌ Lỗi mua tự do", `\`${err.message}\``);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tronthoat")
    .setDescription("Trốn thoát khỏi tầng hầm — 25% (thử sai +5%), hồi chiêu 10s, thoát được thì QUẢ BÁO người nhốt"),

  async execute(interaction) {
    return doEscape(interaction);
  },

  // Nút 🏃 "Thử trốn thoát" và 💸 "Trả aura thoát" trong kênh tầng hầm
  async onComponent(interaction) {
    if (interaction.customId === "tronthoat_pay") return doPay(interaction);
    if (interaction.customId !== "tronthoat_try") return;
    return doEscape(interaction);
  },
};
