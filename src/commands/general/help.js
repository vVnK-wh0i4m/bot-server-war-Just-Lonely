const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const categories = [
  {
    name: "📢 Spam",
    color: 0xe74c3c,
    commands: [
      { name: "/spam", desc: "Spam nội dung tùy chỉnh", usage: "/spam content: nội dung delay: 0.5 tag: @user" },
      { name: "/nhay", desc: "Nhây từ file nhay.txt", usage: "/nhay delay: 0.5 tag: @user sodong: 10" },
      { name: "/nhayvan", desc: "Nhây văn từ file ngon.txt", usage: "/nhayvan delay: 0.5 tag: @user sodong: 10" },
      { name: "/fakenhay", desc: "Giả mạo user + nhây nhay.txt", usage: "/fakenhay delay: 0.5 target: @user" },
      { name: "/fakevan", desc: "Giả mạo user + nhây ngon.txt", usage: "/fakevan delay: 0.5 target: @user" },
      { name: "/fake", desc: "Giả mạo user gửi tin nhắn", usage: "/fake target: @user message: tin nhắn" },
      { name: "/clearchat", desc: "Xóa chat bằng ký tự ẩn", usage: "/clearchat soluong: 50" },
      { name: "/stop", desc: "Dừng TẤT CẢ hoạt động bot", usage: "/stop" },
    ],
  },
  {
    name: "⚙️ Webhook",
    color: 0x3498db,
    commands: [
      { name: "/auto_webhooks", desc: "Tự động tạo/cài đặt webhook", usage: "/auto_webhooks action: fetch" },
    ],
  },
  {
    name: "🤖 Custom AI",
    color: 0x9b59b6,
    commands: [
      { name: "/custom", desc: "Tạo lệnh mới bằng AI", usage: "/custom mo_ta: mô tả lệnh" },
      { name: "/custom_list", desc: "Xem danh sách lệnh custom", usage: "/custom_list" },
      { name: "/custom_manager", desc: "Quản lý lệnh custom (GUI)", usage: "/custom_manager" },
    ],
  },
  {
    name: "🔒 Bảo mật",
    color: 0xf39c12,
    commands: [
      { name: "/bot_lock_cmd", desc: "Khóa/mở khóa quyền dùng bot", usage: "/bot_lock_cmd allow user: @user" },
      { name: "/unlock_bot", desc: "Mở lệnh destructive cho user", usage: "/unlock_bot unlock user: @user" },
    ],
  },
  {
    name: "🎵 Voice",
    color: 0x1abc9c,
    commands: [
      { name: "/joinleavevc", desc: "Vào/rời voice channel", usage: "/joinleavevc action: join" },
      { name: "/stopvc", desc: "Dừng voice", usage: "/stopvc" },
    ],
  },
  {
    name: "🛠️ General",
    color: 0x95a5a6,
    commands: [
      { name: "/av", desc: "Xem avatar user", usage: "/av user: @user" },
      { name: "/svav", desc: "Xem avatar server", usage: "/svav" },
      { name: "/check", desc: "Kiểm tra thông tin", usage: "/check" },
      { name: "/devinfo", desc: "Thông tin bot dev", usage: "/devinfo" },
      { name: "/help", desc: "Xem hướng dẫn sử dụng", usage: "/help" },
    ],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Xem tất cả lệnh và cách dùng"),

  async execute(interaction) {
    const主embed = new EmbedBuilder()
      .setTitle("📖 HƯỚNG DẪN SỬ DỤNG BOT")
      .setDescription("Chọn danh mục bên dưới để xem chi tiết")
      .setColor(0x3498db)
      .setTimestamp()
      .setFooter({ text: "JUST LONELY Bot" });

    for (const cat of categories) {
      const cmdList = cat.commands.map((c) => `**${c.name}**\n> ${c.desc}\n> \`${c.usage}\``).join("\n\n");
     主embed.addFields({ name: cat.name, value: cmdList, inline: false });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_select")
      .setPlaceholder("Chọn danh mục để xem chi tiết...")
      .addOptions(
        categories.map((cat) => ({
          label: cat.name.replace(/[^\w\s]/g, "").trim(),
          value: cat.name,
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const reply = await interaction.reply({ embeds: [主embed], components: [row], ephemeral: true });

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      const selected = categories.find((c) => c.name === i.values[0]);
      if (!selected) return;

      const detailEmbed = new EmbedBuilder()
        .setTitle(selected.name)
        .setColor(selected.color)
        .setTimestamp();

      for (const cmd of selected.commands) {
        detailEmbed.addFields({
          name: cmd.name,
          value: `> ${cmd.desc}\n> \`${cmd.usage}\``,
          inline: false,
        });
      }

      await i.update({ embeds: [detailEmbed] });
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        selectMenu.setPlaceholder("Hết thời gian chọn!").setDisabled(true)
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};
