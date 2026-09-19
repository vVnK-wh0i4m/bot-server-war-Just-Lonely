const { Events, EmbedBuilder } = require("discord.js");
const config = require("../../config");
const logger = require("../utils/logger");

module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    logger.success(`Logged in as ${client.user.tag}`);
    client.user.setActivity("JUST LONELY", { type: 3 });

    // Setup moderation button handlers
    const { setupModeration } = require("../commands/moderation/moderation");
    setupModeration(client);

    // Setup music button handlers (module không tồn tại trong bản build này,
    // nên bọc try/catch để tránh crash toàn bộ bot khi thiếu thư mục music/)
    try {
      const { setupMusicButtons } = require("../commands/music/shared");
      setupMusicButtons(client);
    } catch (err) {
      logger.warn(`Bỏ qua music buttons (module không tồn tại): ${err.message}`);
    }
  },
};
