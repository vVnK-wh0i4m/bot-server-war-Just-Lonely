const duatop = require("../../utils/duatop");
const history = require("../../utils/history");

const PASSWORD = "Quenmkroi2806";

module.exports = {
  name: "duatop",
  prefix: "n?",
  description: "Tạo/cập nhật bảng BXH mời: n?duatop <matkhau> [id sv]",
  usage: "n?duatop <matkhau> [id sv]",
  maskArgs: true, // không ghi mật khẩu vào lịch sử

  async execute(message, args, client) {
    const [mk, idArg] = args;

    if (mk !== PASSWORD) {
      const m = await message.reply("❌ Sai mật khẩu! Bạn không phải Dev.");
      setTimeout(() => m.delete().catch(() => {}), 10000);
      return;
    }

    // Không nhập id → lấy server đang gõ lệnh
    const wanted = (idArg || "").replace(/[^\d]/g, "") || message.guildId;
    const guild =
      client.guilds.cache.get(wanted) || (idArg ? await client.guilds.fetch(wanted).catch(() => null) : null);
    if (!guild) {
      return message.reply("❌ Không tìm thấy server — bot chưa ở đó hoặc ID sai.");
    }

    const status = await message.channel.send("⏳ Đang đăng/cập nhật bảng xếp hạng…");

    try {
      const { channel } = await duatop.publishBoard(guild, client);
      await status.edit(
        `✅ Đã đăng/cập nhật bảng xếp hạng tại #${channel.name} của **${guild.name}**\n` +
          `> Server: \`${guild.id}\` · tổng vào: \`${duatop.totalJoins(guild.id)}\` · link hoạt động: \`${
            Object.keys(duatop.getState().guilds[guild.id]?.invites || {}).length
          }\``,
      );
      history.record("duatop", "board.publish", {
        user: message.author.tag,
        guild: guild.id,
        detail: `n?duatop → #${channel.name}`,
      });
    } catch (err) {
      await status.edit(`❌ Lỗi: \`${err.message}\``);
      history.record("duatop", "board.publish", {
        user: message.author.tag,
        guild: guild.id,
        detail: err.message,
        ok: false,
      });
    }
  },
};
