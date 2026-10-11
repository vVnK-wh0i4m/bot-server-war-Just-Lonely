const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

// Giữ tên file cũ (src/commands/general/help.js) — lệnh /help GUI embed
const categories = [
  {
    id: "spam",
    name: "📢 Spam (prefix ? + webhook)",
    emoji: "📢",
    color: 0xe74c3c,
    commands: [
      { name: "?spam", desc: "Spam nội dung tùy chỉnh (chữ TO có # ở đầu)", usage: "?spam <delay> <sodong|inf> <nội dung>\nVD: ?spam 0.5 20 hello ae\nNhiều dòng: ?spam 0.5 10 dòng1 | dòng2" },
      { name: "?ngon", desc: "Spam văn từ ngon.txt (chữ TO có # ở đầu)", usage: "?ngon <delay> <sodong|inf> [@tag]\nVD: ?ngon 0.5 50\nVD: ?ngon 0.3 inf @ai-đó" },
      { name: "?nhay", desc: "Spam text từ nhay.txt", usage: "?nhay <delay> <sodong|inf> [@tag]\nVD: ?nhay 0.5 50" },
      { name: "?clearchat", desc: "Đẩy trôi chat bằng ký tự ẩn", usage: "?clearchat <sodong>\nVD: ?clearchat 50" },
      { name: "?stop", desc: "Dừng TẤT CẢ spam đang chạy", usage: "?stop" },
    ],
  },
  {
    id: "game",
    name: "🎮 Game AURA",
    emoji: "🎮",
    color: 0x9b59b6,
    commands: [
      { name: "/batcocloli", desc: "Bắt cóc 50% — giữ 30 phút, slot 5+bonus theo aura, cd 30s", usage: "/batcocloli nguoi:@ai" },
      { name: "/chichdien", desc: "Chích điện — mute 5s, hồi chiêu 10s", usage: "/chichdien nguoi:@ai" },
      { name: "/cudamsamset", desc: "Cú đấm sấm sét — cướp hết role + mute 15s, hồi chiêu 30s", usage: "/cudamsamset nguoi:@ai" },
      { name: "/leuleucay", desc: "Lêu lêu cay — mute 3s, hồi chiêu 6s", usage: "/leuleucay nguoi:@ai" },
      { name: "/nhothamloli", desc: "Nhốt hầm loli — ticket chỉ thấy hầm, 10 phút, trừ 5-200 aura/phút, cd 60s", usage: "/nhothamloli nguoi:@ai" },
      { name: "/tronthoat", desc: "Trốn 25% (cd 10s) hoặc 💸 trả aura thoát ngay", usage: "/tronthoat (hoặc nút 🏃 / 💸 trong kênh tù)" },
      { name: "/cuopaura", desc: "Cướp 100% aura mục tiêu — nghèo dễ cướp hơn (5-50%), cd 120s", usage: "/cuopaura nguoi:@ai" },
      { name: "/flexaura", desc: "Xem hồ sơ AURA: tier, slot, miễn khống chế, thành tích", usage: "/flexaura [nguoi]" },
      { name: "/topaura", desc: "Bảng xếp hạng AURA của server", usage: "/topaura" },
      { name: "/danhsachloli", desc: "Danh sách người mình đang bắt · ô chọn 🔓 bỏ sở hữu (bù 100-500 aura cho họ)", usage: "/danhsachloli" },
      { name: "/duaura", desc: "Chuyển aura cho người khác", usage: "/duaura nguoichoi:@ai soluong:100" },
      { name: "/aurabox", desc: "Mở rương AURA nhận 5-50 (7% jackpot x3), hồi 5 phút", usage: "/aurabox" },
      { name: "/aurashop", desc: "AURA SHOP — 5 món/lần (mỗi món 1-30 sp), ❕ 0.001%, restock 90s", usage: "/aurashop" },
      { name: "/tuido", desc: "Túi đồ — xem và chọn đồ DÙNG ngay (khiên, bùa, vé thoát...)", usage: "/tuido" },
      { name: "/hangngay", desc: "Nhận aura hằng ngày FREE — +30, chuỗi +20/ngày (max +130)", usage: "/hangngay" },
      { name: "/mayman", desc: "Hộp quà may mắn FREE — +5 đến +100 aura, cd 10 phút", usage: "/mayman" },
      { name: "/gacha_aura", desc: "Gacha — 90% đầu, chuỗi thắng: band ↓ bonus +20%/lần, jackpot role, cd 8s", usage: "/gacha_aura cuoc:100" },
      { name: "/huongdan", desc: "Hướng dẫn toàn bộ game AURA", usage: "/huongdan" },
    ],
  },
  {
    id: "info",
    name: "ℹ️ Thông tin",
    emoji: "ℹ️",
    color: 0x3498db,
    commands: [
      { name: "/help", desc: "Xem bảng hướng dẫn này", usage: "/help" },
    ],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Xem tất cả lệnh và cú pháp"),

  async execute(interaction) {
    const mainEmbed = new EmbedBuilder()
      .setTitle("📖 HƯỚNG DẪN — JUST LONELY")
      .setDescription(
        "⚠️ **Tất cả lệnh phá hoại dùng `?` ở trước** (không phải `/`).\n" +
        "🔗 **Tất cả lệnh spam đều gửi qua webhook** (bot cần quyền ManageWebhooks).\n" +
        "🔠 **?spam và ?ngon tự thêm `# ` ở đầu** để chữ hiện TO.\n\n" +
        "Chọn danh mục bên dưới để xem cú pháp chi tiết."
      )
      .setColor(0x3498db)
      .addFields(
        { name: "📢 Spam", value: "`?spam` `?ngon` `?nhay` `?clearchat` `?stop`", inline: false },
        { name: "🎮 Game AURA", value: "`/batcocloli` `/chichdien` `/cudamsamset` `/leuleucay` `/nhothamloli` `/tronthoat` `/cuopaura` `/flexaura` `/topaura` `/danhsachloli` `/duaura` `/aurabox` `/aurashop` `/tuido` `/hangngay` `/mayman` `/gacha_aura` `/huongdan`", inline: false },
        { name: "ℹ️ Thông tin", value: "`/help`", inline: false },
      )
      .setFooter({ text: `JUST LONELY • ${interaction.user.tag}` })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_select")
      .setPlaceholder("Chọn danh mục...")
      .addOptions(
        categories.map((cat) => ({
          label: cat.name.replace(/[^\w\s]/g, "").trim().slice(0, 100) || cat.id,
          value: `cat_${cat.id}`,
          emoji: cat.emoji,
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const reply = await interaction.reply({ embeds: [mainEmbed], components: [row], ephemeral: true });

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000,
    });

    collector.on("collect", async (i) => {
      const val = i.values[0];
      if (!val.startsWith("cat_")) return;
      const cat = categories.find((c) => `cat_${c.id}` === val);
      if (!cat) return;

      const detailEmbed = new EmbedBuilder()
        .setTitle(cat.name)
        .setColor(cat.color)
        .setTimestamp();
      for (const cmd of cat.commands) {
        detailEmbed.addFields({ name: cmd.name, value: `> ${cmd.desc}\n> \`${cmd.usage}\``, inline: false });
      }
      return i.update({ embeds: [detailEmbed] });
    });

    collector.on("end", async () => {
      try {
        const disabledRow = new ActionRowBuilder().addComponents(
          selectMenu.setPlaceholder("Hết thời gian!").setDisabled(true)
        );
        await interaction.editReply({ components: [disabledRow] }).catch(() => {});
      } catch {}
    });
  },
};

module.exports.categories = categories;
