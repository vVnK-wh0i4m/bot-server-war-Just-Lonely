const logger = require("../utils/logger");
const duatop = require("../utils/duatop");
const gate = require("../utils/gate");
const game = require("../utils/game");

const BOARD_REFRESH_MS = 60 * 1000;

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    logger.success(`Logged in as ${client.user.tag}`);
    client.user.setActivity("JUST LONELY", { type: 3 });

    // Đồng bộ lượt dùng invite + làm mới bảng ở mọi server bot đang giữ bảng
    let boards = 0;
    for (const guild of client.guilds.cache.values()) {
      try {
        await duatop.cacheInvites(guild);
        if (await duatop.refreshBoard(client, guild.id)) boards++;
      } catch (err) {
        logger.warn(`ready: sync ${guild.name} lỗi — bỏ qua (${err.message})`);
      }
    }
    logger.info(`duatop: đã đồng bộ ${client.guilds.cache.size} server • ${boards} bảng đang hoạt động (cập nhật mỗi 60s)`);

    // Bảng realtime: làm mới định kỳ
    setInterval(() => {
      duatop.refreshAllBoards(client).catch((err) => logger.warn(`refresh board: ${err.message}`));
    }, BOARD_REFRESH_MS);

    // Cổng bắt buộc vào server: đọc guild từ invite một lần khi start
    await gate.resolveGuildId(client).catch(() => {});

    // Mini game AURA: ticker 1s (sở hữu / tầng hầm / khống chế)
    game.start(client);
  },
};
