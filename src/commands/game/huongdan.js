const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const game = require("../../utils/game");
const aura = require("../../utils/aura");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("huongdan")
    .setDescription("📖 Hướng dẫn chơi game AURA — bắt đầu từ đây nếu bạn mới!"),

  async execute(interaction) {
    const cd = game.COOLDOWNS;
    const T = game.TUNE;

    const e1 = new EmbedBuilder()
      .setTitle("📖 AURA GAME — BẮT ĐẦU NHANH")
      .setColor(0x9b59b6)
      .setDescription(
        "**AURA** là điểm sức mạnh của bạn trong server. Càng nhiều AURA → càng mạnh, càng khó bị bắt nạt, càng nhiều đặc quyền.\n" +
          "Chơi theo 3 bước đơn giản:",
      )
      .addFields(
        {
          name: "1️⃣ CÀY AURA (an toàn, không mất gì)",
          value:
            `> 💬 Chat bình thường trong server: **+2 aura/45s**\n` +
            `> 🎁 \`/hangngay\` — nhận **miễn phí mỗi 24h**\n` +
            `> 🎁 \`/mayman\` — hộp quà **miễn phí mỗi 10 phút**\n` +
            `> 📦 \`/aurabox\` — rương ngẫu nhiên mỗi 5 phút`,
          inline: false,
        },
        {
          name: "2️⃣ MUA ĐỒ & DÙNG (tuỳ chọn)",
          value:
            `> 🛍️ \`/aurashop\` — mỗi lần stock **5 món** (mỗi món 1-30 sp), restock **90s**, ❕ **0.001%**\n` +
            `> 🎒 \`/tuido\` — xem túi đồ rồi **chọn đồ dùng** ngay (khiên, bùa, vé thoát...)`,
          inline: false,
        },
        {
          name: "3️⃣ QUẬY PHÁ (vui là chính, có rủi ro)",
          value:
            `> 🦹 \`/batcocloli\` — bắt cóc, giữ người **${T.batcoc.minutes} phút**\n` +
            `> ⚡ \`/chichdien\`, \`/leuleucay\`, \`/cudamsamset\` — mute vui người khác\n` +
            `> 🕳️ \`/nhothamloli\` — nhốt người đã bắt xuống tầng hầm\n` +
            `> 🏃 \`/tronthoat\` — nếu bạn bị nhốt, thử trốn hoặc trả aura ra ngay`,
          inline: false,
        },
        {
          name: "🛡️ AN TOÀN CHO NGƯỜI MỚI",
          value:
            `> Nếu aura của bạn còn **thấp**, người chơi mạnh hơn nhiều sẽ **không thể** nhắm vào bạn.\n` +
            `> Cứ thoải mái cày aura và học luật chơi trước — không ai bắt nạt được bạn ngay từ đầu!`,
          inline: false,
        },
      )
      .setFooter({ text: "JUST LONELY · AURA GAME · Trang 1/3" })
      .setTimestamp();

    const e2 = new EmbedBuilder()
      .setTitle("🎮 CHI TIẾT LỆNH GAME")
      .setColor(0x3498db)
      .addFields(
        {
          name: "🦹 Tấn công & bắt giữ",
          value:
            `\`/batcocloli <người>\` — **${T.batcoc.chance}%** cơ hội, giữ **${T.batcoc.minutes} phút** (cd ${cd.batcocloli / 1000}s)\n` +
            `\`/chichdien <người>\` — mute **${T.mute.chich}s** (cd ${cd.chichdien / 1000}s)\n` +
            `\`/cudamsamset <người>\` — cướp hết role + mute **${T.mute.cudam}s** (cd ${cd.cudamsamset / 1000}s)\n` +
            `\`/leuleucay <người>\` — mute **${T.mute.leuleu}s**, nhẹ nhàng (cd ${cd.leuleucay / 1000}s)\n` +
            `\`/nhothamloli <người>\` — nhốt tầng hầm **${T.prison.minutes} phút** (chỉ người **bạn đang sở hữu**), tù nhân trừ **5-200 aura/phút**\n` +
            `\`/cuopaura <người>\` — cướp **100%** aura mục tiêu, **nghèo càng dễ cướp** (5-50%), cd **120s**`,
          inline: false,
        },
        {
          name: "🏃 Khi bạn là nạn nhân",
          value:
            `\`/tronthoat\` — thử trốn **${T.prison.escape}%**, hoặc bấm nút 💸 trả aura thoát ngay\n` +
            `> Thoát thành công = **QUẢ BÁO** — người nhốt bạn sẽ bị nhốt ngược lại!`,
          inline: false,
        },
        {
          name: "💫 Quản lý AURA",
          value:
            "`/flexaura [người]` — xem hồ sơ: tier, slot, miễn khống chế, thành tích\n" +
            "`/topaura` — bảng xếp hạng server\n" +
            "`/danhsachloli` — chi tiết danh sách người mình đang bắt\n" +
            "`/duaura <người> <số>` — chuyển aura cho người khác\n" +
            "`/gacha_aura <cược>` — gacha chuỗi thắng: **90% đầu, mỗi thắng band ↓10 nhưng bonus +20%/lần**, thua reset • 🎰 jackpot role • 🎁 vật phẩm 🔴/❕",
          inline: false,
        },
        {
          name: "⚖️ Về tỉ lệ thành công",
          value:
            `• Mục tiêu role cao hơn bạn → tỉ lệ **giảm** theo mỗi bậc — sàn **5%** (CC) / **2.5%** (bắt cóc)\n` +
            `• Aura của bạn càng cao → càng ít bị ảnh hưởng bởi chênh lệch role\n` +
            `• ⚖️ Aura cao **được ưu ái** mọi phép thử — nhưng **khó kiếm aura hơn** (gacha bonus theo chuỗi thắng, tù bị trừ nặng hơn)`,
          inline: false,
        },
        {
          name: "🏆 Phân hạng & newbie",
          value:
            `• 15 bậc: **Thấp → Tân Binh → Lính Mới → Tinh Anh → Lão Luyện → Trung Bình → Khá Giả → Giàu Có → Thượng Lưu → Cao → Cao Cấp → Siêu Cấp → Hắc Hoàng → Chân Thần → Vô Cực**\n` +
            `• 🆕 Aura thấp cày được **nhân bonus**: ×10 (<100K) · ×5 (<1M) · ×2 (<5M) — lên 1M mau hơn\n` +
            `• 🎯 30 role bậc theo mốc: \`Aura 1K\` → \`Aura 1B\` (tự gán khi đạt)\n` +
            `• 🎨 Từ **15M** aura: đặt tên role riêng **AURA &lt;tên&gt;** qua nút trong \`/flexaura\``,
          inline: false,
        },
      )
      .setFooter({ text: "JUST LONELY · AURA GAME · Trang 2/3" })
      .setTimestamp();

    const e3 = new EmbedBuilder()
      .setTitle("🎒 VẬT PHẨM & CƠ CHẾ AURA")
      .setColor(0xf1c40f)
      .addFields(
        {
          name: "🛍️ AURA SHOP — mua gì, để làm gì?",
          value:
            `Mỗi lần stock **5 món ngẫu nhiên** (mỗi món **1-30** sp) theo 6 bậc (⚪ 🟢 🔵 🟡 🔴 ❕), restock **90s**:\n` +
            `> Mua = đổi aura → đồ rơi vào **túi đồ** (\`/tuido\`) — **chọn đồ dùng ngay** ở đó\n` +
            `> Vật phẩm có **hiệu ứng thật**: khiên miễn khống chế, bùa may mắn, vé thoát tù, reset cd...\n` +
            `> ❕ **Tinh Thể Hỗn Mang** (15000✨, spawn **0.001%**): sở hữu = **phản đòn** mọi lệnh tấn công (20 lần/ngày)`,
          inline: false,
        },
        {
          name: "🛡️ Miễn khống chế (từ AURA)",
          value: `Mỗi **100 aura** → **+5%** giảm thời gian mute (tối đa **60%**).`,
          inline: false,
        },
        {
          name: "👥 Slot sở hữu",
          value: `Cơ bản **${aura.BASE_SLOTS}** + mỗi **100 aura +1** (tối đa +${aura.MAX_SLOT_BONUS}).`,
          inline: false,
        },
        {
          name: "🔥 Chuỗi thắng (streak)",
          value: `Thắng liên tiếp → nhân thêm aura nhận được (tối đa x2). Thua là mất chuỗi.`,
          inline: false,
        },
        {
          name: "🏷️ Role game (bot tự tạo)",
          value:
            ["👑 Chủ Chiếm", "Bị Sở Hữu", "Tù Nhân Tầng Hầm", "Bị Chích Điện", "Mất Đồ"].join(" • ") +
            "\n" +
            aura.TIERS.map((t) => `${t.icon}${t.name}`).join(" → "),
          inline: false,
        },
        {
          name: "⚠️ Lưu ý",
          value:
            "• Bot cần quyền: Quản lý vai trò, Quản lý kênh, Hạn chế thành viên\n" +
            "• Role bot nên cao nhất server để hoạt động trơn tru\n" +
            "• Dữ liệu (aura, túi đồ) sống sót qua restart bot",
          inline: false,
        },
      )
      .setFooter({ text: "JUST LONELY · AURA GAME · Trang 3/3" })
      .setTimestamp();

    return interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [e1, e2, e3] });
  },
};
