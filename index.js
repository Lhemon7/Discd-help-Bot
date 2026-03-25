require('dotenv').config();
const { 
  Client, GatewayIntentBits, ActionRowBuilder, 
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
  EmbedBuilder, Events, PermissionsBitField, ChannelType 
} = require('discord.js');
const express = require('express'); // <--- ADDED THIS

const app = express();
const port = process.env.PORT || 3000;

// This creates a tiny website for Render to "see"
app.get('/', (req, res) => res.send('Major Lazer Bot is Awake! 🛡️'));
app.listen(port, () => console.log(`Web server running on port ${port}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent 
  ]
});

// --- CONFIGURATION ---
const MOD_ROLE_ID = "1397207463387857036"; 

const HELP_DATA = {
  escrow: {
    label: "🛡️ Secure Escrow & Multi-Sig", 
    description: "Our 2-of-3 Multi-Sig protocol ensures that no single person can move funds alone.",
    options: [
      { label: "How am I protected?", value: "🛡️ **Major Lazer Security**\n\nAll trades use a **2-of-3 Secure Escrow**. This prevents 'exit scams' and ensures your money stays in the vault until the deal is verified." },
      { label: "Transaction Fees", value: "📊 **Fees**\n\nStandard escrow fee is 5%. This covers the network security and moderator mediation." }
    ]
  },
  conduct: {
    label: "⚖️ Server Rules & Conduct", 
    description: "Read our rules to avoid being banned.",
    options: [
      { label: "What are the core rules?", value: "🚫 **Zero Tolerance**\n\n1. No DM Trading.\n2. Respect others.\n3. No phishing links." }
    ]
  }
};

// --- SETUP COMMAND ---
client.on(Events.MessageCreate, async (message) => {
  if (message.channel.name !== "🛠-support-center") return;
  if (message.content.toLowerCase() === "!setup-help" && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const embed = new EmbedBuilder()
      .setTitle("🆘 Major Lazer Support Center")
      .setDescription("Welcome! Use the buttons below to browse guides or open a **Private Ticket**.")
      .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_help").setLabel("Browse Help Topics").setStyle(ButtonStyle.Primary).setEmoji("📚"),
      new ButtonBuilder().setCustomId("contact_staff").setLabel("Contact Moderator").setStyle(ButtonStyle.Danger).setEmoji("🛡️")
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }
});

// --- INTERACTION HANDLER ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === "open_help") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("help_category")
      .setPlaceholder("Choose a category...")
      .addOptions(Object.entries(HELP_DATA).map(([key, data]) => ({ label: data.label, value: key })));
    await interaction.reply({ content: "Select a topic:", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "help_category") {
    const category = HELP_DATA[interaction.values[0]];
    const subMenu = new StringSelectMenuBuilder()
      .setCustomId("help_option")
      .setPlaceholder("Select a detail...")
      .addOptions(category.options.map(o => ({ label: o.label, value: o.value.substring(0, 100), description: category.label })));
    await interaction.update({ content: `### ${category.label}\n${category.description}`, components: [new ActionRowBuilder().addComponents(subMenu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "help_option") {
    await interaction.update({ content: interaction.values[0], components: [] });
  }

  if (interaction.isButton() && interaction.customId === "contact_staff") {
    try {
      await interaction.reply({ content: "🔐 Creating your private ticket...", ephemeral: true });
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: MOD_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        ],
      });
      const welcomeEmbed = new EmbedBuilder().setTitle("🎟️ Private Support Ticket").setDescription(`Hello ${interaction.user}, a moderator will assist you shortly.`).setColor(0x57F287);
      await ticketChannel.send({ content: `<@&${MOD_ROLE_ID}>`, embeds: [welcomeEmbed] });
      await interaction.editReply({ content: `✅ Ticket created: <#${ticketChannel.id}>` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: "❌ Error: I cannot create channels!" });
    }
  }
});

client.once('ready', () => { console.log(`✅ Major Lazer Bot is online!`); });
client.login(process.env.DISCORD_TOKEN);
