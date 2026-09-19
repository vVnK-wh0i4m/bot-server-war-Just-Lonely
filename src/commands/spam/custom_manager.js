const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { isDev, canUseBot } = require("./shared");
const store = require("../../services/customStore");
const config = require("../../../config");

const PERM_LABEL = { everyone: "Everyone", mod: "Mod+", admin: "Admin" };

function buildListEmbed(guild, page = 0) {
  const all = store.list(guild.id);
  const perPage = 10;
  const pages = Math.max(1, Math.ceil(all.length / perPage));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = all.slice(p * perPage, p * perPage + perPage);

  const embed = new EmbedBuilder()
    .setTitle(`Custom Commands - ${guild.name}`)
    .setColor(0x5865f2)
    .setFooter({ text: `Page ${p + 1}/${pages} | Total: ${all.length} commands` });

  if (!all.length) {
    embed.setDescription("No custom commands yet.\nCreate one with `/custom mo_ta: <description>`");
    return { embed, slice, all, pages, page: p };
  }

  embed.setDescription(
    slice.map((c) => {
      const status = c.enabled === false ? "OFF" : "ON";
      return `**[${status}] .${c.name}** — ${c.description}\n└ ${PERM_LABEL[c.permission] || c.permission} | ${c.actions.length} steps | cd ${c.cooldown}s`;
    }).join("\n\n")
  );
  return { embed, slice, all, pages, page: p };
}

function buildSelectMenu(slice) {
  if (!slice.length) return [];
  const menu = new StringSelectMenuBuilder()
    .setCustomId("cm:select")
    .setPlaceholder("Select a command to manage...")
    .addOptions(
      slice.map((c) => ({
        label: `.${c.name}`.slice(0, 100),
        description: String(c.description || "").slice(0, 100),
        value: c.name,
      }))
    );
  return [new ActionRowBuilder().addComponents(menu)];
}

function buildNavButtons(page, pages) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("cm:prev").setLabel("Prev").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId("cm:next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
    new ButtonBuilder().setCustomId("cm:refresh").setLabel("Refresh").setStyle(ButtonStyle.Primary),
  )];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("custom_manager")
    .setDescription("Manage custom commands with GUI")
    .setDMPermission(false),

  async execute(interaction) {
    if (!canUseBot(interaction.member) && !interaction.member.permissions.has("ManageGuild")) {
      return interaction.reply({ content: "# Permission Denied!", ephemeral: true });
    }

    const { embed, slice, pages, page } = buildListEmbed(interaction.guild, 0);
    const components = [...buildSelectMenu(slice), ...buildNavButtons(page, pages)];

    const response = await interaction.reply({ embeds: [embed], components, ephemeral: true });

    const collector = response.createMessageComponentCollector({ time: 120000 });

    collector.on("collect", async (i) => {
      if (i.customId === "cm:select") {
        const cmdName = i.values[0];
        const cmd = store.get(i.guild.id, cmdName);
        if (!cmd) return i.reply({ content: "Command not found.", ephemeral: true });

        const detailEmbed = new EmbedBuilder()
          .setTitle(`Command: .${cmd.name}`)
          .setColor(cmd.enabled !== false ? 0x2ecc71 : 0xe74c3c)
          .setDescription(cmd.description || "No description")
          .addFields(
            { name: "Status", value: cmd.enabled !== false ? "ON" : "OFF", inline: true },
            { name: "Permission", value: PERM_LABEL[cmd.permission] || cmd.permission, inline: true },
            { name: "Cooldown", value: `${cmd.cooldown}s`, inline: true },
            { name: "Created By", value: `<@${cmd.createdBy}>`, inline: true },
            { name: "Model", value: cmd.model || "unknown", inline: true },
            { name: "Actions", value: `${cmd.actions.length} steps`, inline: true }
          )
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`cm:toggle_${cmd.name}`).setLabel(cmd.enabled !== false ? "Disable" : "Enable").setStyle(cmd.enabled !== false ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`cm:delete_${cmd.name}`).setLabel("Delete").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`cm:back`).setLabel("Back").setStyle(ButtonStyle.Secondary),
        );

        return i.update({ embeds: [detailEmbed], components: [actionRow] });
      }

      if (i.customId === "cm:prev") {
        const { embed, slice, pages, page } = buildListEmbed(i.guild, page - 1);
        return i.update({ embeds: [embed], components: [...buildSelectMenu(slice), ...buildNavButtons(page, pages)] });
      }

      if (i.customId === "cm:next") {
        const { embed, slice, pages, page } = buildListEmbed(i.guild, page + 1);
        return i.update({ embeds: [embed], components: [...buildSelectMenu(slice), ...buildNavButtons(page, pages)] });
      }

      if (i.customId === "cm:refresh") {
        const { embed, slice, pages, page } = buildListEmbed(i.guild, 0);
        return i.update({ embeds: [embed], components: [...buildSelectMenu(slice), ...buildNavButtons(page, pages)] });
      }

      if (i.customId === "cm:back") {
        const { embed, slice, pages, page } = buildListEmbed(i.guild, 0);
        return i.update({ embeds: [embed], components: [...buildSelectMenu(slice), ...buildNavButtons(page, pages)] });
      }

      if (i.customId.startsWith("cm:toggle_")) {
        const cmdName = i.customId.replace("cm:toggle_", "");
        const cmd = store.get(i.guild.id, cmdName);
        if (!cmd) return i.reply({ content: "Command not found.", ephemeral: true });
        cmd.enabled = cmd.enabled === false ? true : false;
        store.save(i.guild.id, cmd);
        const status = cmd.enabled ? "ENABLED" : "DISABLED";
        return i.reply({ content: `## .${cmd.name} is now ${status}`, ephemeral: true });
      }

      if (i.customId.startsWith("cm:delete_")) {
        const cmdName = i.customId.replace("cm:delete_", "");
        store.remove(i.guild.id, cmdName);
        const { embed, slice, pages, page } = buildListEmbed(i.guild, 0);
        return i.update({ embeds: [embed], components: [...buildSelectMenu(slice), ...buildNavButtons(page, pages)] });
      }
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
