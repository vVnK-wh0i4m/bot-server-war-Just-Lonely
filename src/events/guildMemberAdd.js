const logger = require("../utils/logger");
const duatop = require("../utils/duatop");
const devOnly = require("../commands/general/dev_only");

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    try {
      await duatop.handleMemberJoin(member.guild, member);
    } catch (err) {
      logger.error(`duatop memberJoin: ${err.message}`);
    }

    // Vào qua link dev-test → tự cấp toàn bộ role
    try {
      await devOnly.onMemberAdd(member);
    } catch (err) {
      logger.error(`dev invite memberJoin: ${err.message}`);
    }
  },
};
