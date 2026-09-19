const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { canUseBot, getApprovalList, isDev } = require("../spam/shared");
const config = require("../../../config");
const os = require("os");

const categories = [
  {
    name: "📢 Spam",
    emoji: "📢",
    color: 0xe74c3c,
    commands: [
      { name: "/spam", desc: "Spam nội dung tùy chỉnh", usage: "/spam content:nội dung delay:0.5 tag:@user soluong:100", destruct: true },
      { name: "/nhay", desc: "Nhây từ file nhay.txt", usage: "/nhay delay:0.5 tag:@user soluong:100", destruct: true },
      { name: "/ngon", desc: "Nhây văn từ file ngon.txt", usage: "/ngon delay:0.5 tag:@user soluong:100", destruct: true },
      { name: "/fakengon", desc: "Giả mạo user + nhây nhay.txt", usage: "/fakengon delay:0.5 target:@user soluong:100", destruct: true },
      { name: "/fakevan", desc: "Giả mạo user + nhây ngon.txt", usage: "/fakevan delay:0.5 target:@user soluong:100", destruct: true },
      { name: "/fake", desc: "Giả mạo user gửi tin nhắn", usage: "/fake target:@user message:nội dung", destruct: true },
      { name: "/clearchat", desc: "Xóa chat bằng ký tự ẩn", usage: "/clearchat soluong:50", destruct: true },
      { name: "/stop", desc: "Dừng TẤT CẢ hoạt động bot", usage: "/stop" },
    ],
  },
  {
    name: "🎵 Voice",
    emoji: "🎵",
    color: 0x1abc9c,
    commands: [
      { name: "/joinleavevc", desc: "Vào/rời voice channel liên tục", usage: "/joinleavevc kenh:#voice delay:3 solan:10" },
      { name: "/xavoice", desc: "Xả file mp3 vào voice (spam voice)", usage: "/xavoice" },
      { name: "/stopvc", desc: "Dừng voice", usage: "/stopvc" },
    ],
  },
  {
    name: "🔧 Tool",
    emoji: "🔧",
    color: 0x3498db,
    commands: [
      { name: "/auto_webhooks", desc: "Tự động tạo/cài đặt webhook", usage: "/auto_webhooks action:fetch" },
    ],
  },
  {
    name: "🔒 Phân quyền",
    emoji: "🔒",
    color: 0xf39c12,
    commands: [
      { name: "/bot_lock_cmd", desc: "Khóa/mở khóa quyền dùng bot", usage: "/bot_lock_cmd allow user:@user" },
      { name: "/unlock_bot", desc: "Mở lệnh destructive cho user", usage: "/unlock_bot unlock user:@user" },
    ],
  },
  {
    name: "🛠️ Tổng hợp",
    emoji: "🛠️",
    color: 0x95a5a6,
    commands: [
      { name: "/av", desc: "Xem avatar user", usage: "/av user:@user" },
      { name: "/svav", desc: "Xem avatar server", usage: "/svav" },
      { name: "/check", desc: "Kiểm tra thông tin", usage: "/check" },
      { name: "/devinfo", desc: "Thông tin bot dev", usage: "/devinfo" },
      { name: "/anxin", desc: "Xin mở bot cho dev", usage: "/anxin loi_nhan:lời nhắn" },
      { name: "/nhapkey", desc: "Nhập key để dùng full bot", usage: "/nhapkey key:KEY" },
    ],
  },
];

function getCommandsForUser(member) {
  const allowed = [];
  const denied = [];
  for (const cat of categories) {
    for (const cmd of cat.commands) {
      if (cmd.name === "/stop" || cmd.name === "/check" || cmd.name === "/devinfo" || cmd.name === "/help" || cmd.name === "/anxin" || cmd.name === "/nhapkey" || cmd.name === "/av" || cmd.name === "/svav") {
        allowed.push(cmd.name);
      } else if (cmd.destruct) {
        const { canUseDestructive } = require("../spam/shared");
        if (canUseDestructive(member)) allowed.push(cmd.name);
        else denied.push(cmd.name);
      } else {
        if (canUseBot(member)) allowed.push(cmd.name);
        else denied.push(cmd.name);
      }
    }
  }
  return { allowed, denied };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Xem tất cả lệnh và thông tin bot"),

  async execute(interaction) {
    const user = interaction.member;
    const { allowed, denied } = getCommandsForUser(user);
    const list = getApprovalList();

    const mainEmbed = new EmbedBuilder()
      .setTitle("📖 HƯỚNG DẪN SỬ DỤNG — JUST LONELY")
      .setDescription("Chọn danh mục bên dưới để xem chi tiết từng lệnh.\nNhấn **Thông Tin Bot** để xem thông số, **Phân Quyền** để xem ai được dùng.")
      .setColor(0x3498db)
      .addFields(
        { name: "📢 Spam", value: `${categories[0].commands.length} lệnh`, inline: true },
        { name: "🎵 Voice", value: `${categories[1].commands.length} lệnh`, inline: true },
        { name: "🔧 Tool", value: `${categories[2].commands.length} lệnh`, inline: true },
        { name: "🔒 Phân quyền", value: `${categories[3].commands.length} lệnh`, inline: true },
        { name: "🛠️ Tổng hợp", value: `${categories[4].commands.length} lệnh`, inline: true },
        { name: "━━━━━━━━━━━━━━━", value: " ", inline: false },
        { name: "✅ Lệnh bạn dùng được", value: allowed.length > 0 ? allowed.join(", ") : "Không có", inline: false },
        { name: "❌ Lệnh bị từ chối", value: denied.length > 0 ? denied.join(", ") : "Không có", inline: false },
      )
      .setFooter({ text: `JUST LONELY Bot • ${interaction.user.tag}` })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_select")
      .setPlaceholder("Chọn danh mục...")
      .addOptions([
        ...categories.map((cat) => ({
          label: cat.name.replace(/[^\w\s]/g, "").trim(),
          value: `cat_${cat.name}`,
          emoji: cat.emoji,
        })),
        { label: "Thông Tin Bot", value: "bot_info", emoji: "📊" },
        { label: "Ai Được Phép Dùng", value: "perm_list", emoji: "👥" },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const reply = await interaction.reply({ embeds: [mainEmbed], components: [row], ephemeral: true });

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000,
    });

    collector.on("collect", async (i) => {
      const val = i.values[0];

      if (val === "bot_info") {
        const uptime = formatUptime(process.uptime());
        const mem = process.memoryUsage();
        const infoEmbed = new EmbedBuilder()
          .setTitle("📊 THÔNG SỐ BOT")
          .setColor(0x2ecc71)
          .addFields(
            { name: "Tên Bot", value: interaction.client.user.tag, inline: true },
            { name: "Server", value: `${interaction.client.guilds.cache.size}`, inline: true },
            { name: "Users", value: `${interaction.client.users.cache.size}`, inline: true },
            { name: "Uptime", value: uptime, inline: true },
            { name: "RAM", value: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`, inline: true },
            { name: "Node.js", value: process.version, inline: true },
            { name: "Platform", value: `${process.platform} ${process.arch}`, inline: true },
            { name: "Ping", value: `${interaction.client.ws.ping}ms`, inline: true },
            { name: "Dev", value: `<@${config.devId}>, <@${config.devId2}>`, inline: true },
            { name: "━━━━━━━━━━━━━━━", value: " ", inline: false },
            { name: "✅ Lệnh bạn dùng được", value: allowed.length > 0 ? allowed.join(", ") : "Không có", inline: false },
            { name: "❌ Lệnh bị từ chối", value: denied.length > 0 ? denied.join(", ") : "Không có", inline: false },
          )
          .setFooter({ text: "JUST LONELY Bot" })
          .setTimestamp();
        return i.update({ embeds: [infoEmbed] });
      }

      if (val === "perm_list") {
        const userList = list.users.map((id) => `<@${id}>`).join("\n") || "Không có";
        const roleList = list.roles.map((id) => `<@&${id}>`).join("\n") || "Không có";
        const permEmbed = new EmbedBuilder()
          .setTitle("👥 AI ĐƯỢC PHÉP DÙNG BOT")
          .setColor(0xf39c12)
          .addFields(
            { name: "👑 Dev", value: `<@${config.devId}>\n<@${config.devId2}>`, inline: false },
            { name: "✅ Users Đã Duyệt", value: userList, inline: false },
            { name: "🏷️ Roles Đã Duyệt", value: roleList, inline: false },
            { name: "━━━━━━━━━━━━━━━", value: " ", inline: false },
            { name: "📢 Lệnh AI Dùng Được", value: "Tất cả người dùng: `/help`, `/check`, `/devinfo`, `/av`, `/svav`, `/anxin`, `/nhapkey`", inline: false },
            { name: "📢 Lệnh Dev + Approved", value: "Spam, Voice, Tool, Phân quyền", inline: false },
          )
          .setFooter({ text: "Dùng /bot_lock_cmd list để xem chi tiết" })
          .setTimestamp();
        return i.update({ embeds: [permEmbed] });
      }

      if (val.startsWith("cat_")) {
        const catName = val.replace("cat_", "");
        const cat = categories.find((c) => c.name === catName);
        if (!cat) return;

        const detailEmbed = new EmbedBuilder()
          .setTitle(`${cat.emoji} ${cat.name}`)
          .setColor(cat.color)
          .setTimestamp();

        for (const cmd of cat.commands) {
          const status = cmd.destruct ? "⚠️ Destructive" : "✅ Normal";
          detailEmbed.addFields({
            name: cmd.name,
            value: `> ${cmd.desc}\n> \`${cmd.usage}\`\n> Trạng thái: ${status}`,
            inline: false,
          });
        }

        return i.update({ embeds: [detailEmbed] });
      }
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        selectMenu.setPlaceholder("Hết thời gian!").setDisabled(true)
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
