require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  Events,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');
const express = require('express');

// --- WEB SERVER (keeps Render alive) ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (_req, res) => res.send('Major Lazer Bot is Awake! 🛡️'));
app.listen(port, () => console.log(`Web server running on port ${port}`));

// --- CLIENT ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // Required for permission checks
  ],
});

// --- CONFIGURATION ---
const MOD_ROLE_ID = "1397207463387857036";
const SUPPORT_CHANNEL_NAME = "🛠-support-center";

// Help content stored separately so select menu values stay short (Discord limit: 100 chars)
const HELP_CONTENT = {
  escrow_protection: "🛡️ **Major Lazer Security**\n\nAll trades use a **2-of-3 Secure Escrow**. This prevents exit scams and ensures your money stays locked until the deal is fully verified by both parties.",
  escrow_fees: "📊 **Transaction Fees**\n\nThe standard escrow fee is **5%**. This covers network security costs and moderator mediation for the duration of your trade.",
  conduct_rules: "🚫 **Core Rules — Zero Tolerance**\n\n1. No DM trading under any circumstances.\n2. Treat all members with respect.\n3. No phishing links or scam attempts.\n\nViolations result in an immediate permanent ban.",
};

const HELP_DATA = {
  escrow: {
    label: "🛡️ Secure Escrow & Multi-Sig",
    description: "Our 2-of-3 Multi-Sig protocol ensures no single person can move funds alone.",
    options: [
      { label: "How am I protected?",  value: "escrow_protection" },
      { label: "Transaction Fees",     value: "escrow_fees" },
    ],
  },
  conduct: {
    label: "⚖️ Server Rules & Conduct",
    description: "Read our rules carefully to avoid moderation action.",
    options: [
      { label: "What are the core rules?", value: "conduct_rules" },
    ],
  },
};

// --- HELPER: find an existing open ticket for a user ---
function findExistingTicket(guild, userId) {
  return guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.startsWith("ticket-") &&
      ch.permissionOverwrites.cache.has(userId)
  );
}

// --- SETUP COMMAND ---
client.on(Events.MessageCreate, async (message) => {
  if (message.channel.name !== SUPPORT_CHANNEL_NAME) return;
  if (message.content.toLowerCase() !== "!setup-help") return;
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const embed = new EmbedBuilder()
    .setTitle("🆘 Major Lazer Support Center")
    .setDescription(
      "Welcome! Use the buttons below to browse guides or open a **Private Ticket**."
    )
    .setColor(0x5865f2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_help")
      .setLabel("Browse Help Topics")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📚"),
    new ButtonBuilder()
      .setCustomId("contact_staff")
      .setLabel("Contact Moderator")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🛡️")
  );

  await message.channel.send({ embeds: [embed], components: [row] });
  await message.delete().catch(() => {});
});

// --- INTERACTION HANDLER ---
client.on(Events.InteractionCreate, async (interaction) => {

  // --- Browse Help Topics button ---
  if (interaction.isButton() && interaction.customId === "open_help") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("help_category")
      .setPlaceholder("Choose a category...")
      .addOptions(
        Object.entries(HELP_DATA).map(([key, data]) => ({
          label: data.label,
          value: key,
        }))
      );

    return interaction.reply({
      content: "Select a topic below:",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  }

  // --- Category selected ---
  if (interaction.isStringSelectMenu() && interaction.customId === "help_category") {
    const category = HELP_DATA[interaction.values[0]];
    if (!category) return interaction.update({ content: "Unknown category.", components: [] });

    const subMenu = new StringSelectMenuBuilder()
      .setCustomId("help_option")
      .setPlaceholder("Select a detail...")
      .addOptions(
        category.options.map((o) => ({
          label: o.label,
          value: o.value, // Short key, not truncated content
          description: category.label,
        }))
      );

    return interaction.update({
      content: `### ${category.label}\n${category.description}`,
      components: [new ActionRowBuilder().addComponents(subMenu)],
    });
  }

  // --- Detail selected — look up full content by key ---
  if (interaction.isStringSelectMenu() && interaction.customId === "help_option") {
    const content = HELP_CONTENT[interaction.values[0]];
    return interaction.update({
      content: content ?? "Content not found.",
      components: [],
    });
  }

  // --- Contact Moderator button ---
  if (interaction.isButton() && interaction.customId === "contact_staff") {
    // Check for an existing open ticket first
    const existing = findExistingTicket(interaction.guild, interaction.user.id);
    if (existing) {
      return interaction.reply({
        content: `⚠️ You already have an open ticket: <#${existing.id}>`,
        ephemeral: true,
      });
    }

    // Defer so we have time to create the channel
    await interaction.deferReply({ ephemeral: true });

    try {
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          // Block everyone by default
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          // Allow the ticket creator
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          // Allow mods
          {
            id: MOD_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          // Allow the bot itself (critical — without this the bot may lose access)
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒")
      );

      const welcomeEmbed = new EmbedBuilder()
        .setTitle("🎟️ Private Support Ticket")
        .setDescription(
          `Hello ${interaction.user}, a moderator will assist you shortly.\n\nPlease describe your issue and wait — do **not** DM staff directly.`
        )
        .setColor(0x57f287)
        .setFooter({ text: "Click 'Close Ticket' when your issue is resolved." });

      await ticketChannel.send({
        content: `<@&${MOD_ROLE_ID}> — new ticket from ${interaction.user}`,
        embeds: [welcomeEmbed],
        components: [closeRow],
      });

      return interaction.editReply({
        content: `✅ Your private ticket has been created: <#${ticketChannel.id}>`,
      });
    } catch (error) {
      console.error("Ticket creation error:", error);
      return interaction.editReply({
        content:
          "❌ Failed to create your ticket. Please make sure the bot has **Manage Channels** permission.",
      });
    }
  }

  // --- Close Ticket button ---
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    const isMod = interaction.member.roles.cache.has(MOD_ROLE_ID);
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

    // Allow the ticket owner OR a mod/admin to close
    const channelHasUser = interaction.channel.permissionOverwrites.cache.some(
      (ow) => ow.id === interaction.user.id
    );

    if (!isMod && !isAdmin && !channelHasUser) {
      return interaction.reply({
        content: "❌ Only the ticket owner or a moderator can close this ticket.",
        ephemeral: true,
      });
    }

    await interaction.reply({ content: "🔒 Closing ticket in 5 seconds..." });
    setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
  }
});

// --- READY ---
client.once(Events.ClientReady, () => {
  console.log(`✅ Major Lazer Bot is online as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
