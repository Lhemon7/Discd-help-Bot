require('dotenv').config();
const { 
  Client, GatewayIntentBits, ActionRowBuilder, 
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
  EmbedBuilder, Events, PermissionsBitField, ChannelType 
} = require('discord.js');

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
    description: "Our 2-of-3 Multi-Sig protocol ensures that no single person can move funds alone. Safety is our #1 priority.",
    options: [
      { 
        label: "How am I protected?", 
        value: "🛡️ **Major Lazer Security Protocol**\n\nAll trades are conducted via a **2-of-3 Secure Escrow**. This means the Buyer, Seller, and Admin all hold keys, but **two signatures** are required to release funds. This prevents 'exit scams' and ensures your money stays in the vault until the deal is verified. **Never trade in DMs; always use an official server ticket!**" 
      },
      { 
        label: "Transaction Fees", 
        value: "📊 **Fee Structure**\n\nWe charge a small percentage to maintain the security of the Multi-Sig network. Fees are always deducted from the total amount held in escrow to ensure a smooth payout for the seller. Check <#fees> for current rates." 
      }
    ]
  },
  conduct: {
    label: "⚖️ Server Rules & Conduct", 
    description: "Read our rules to avoid being banned from the Major Lazer ecosystem.",
    options: [
      { 
        label: "What are the core rules?", 
        value: "🚫 **Zero Tolerance Policy**\n\n1. **No DM Trading:** Anyone asking to trade outside a ticket is likely a scammer. Report them immediately.\n2. **Respect:** Harassment or hate speech results in an instant ban.\n3. **Links:** Posting malicious or unverified phishing links will get you blacklisted." 
      }
    ]
  }
};

// --- SETUP COMMAND ---
client.on(Events.MessageCreate, async (message) => {
  // Only works in the support center channel
  if (message.channel.name !== "🛠-support-center") return;

  if (message.content.toLowerCase() === "!setup-help" && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const embed = new EmbedBuilder()
      .setTitle("🆘 Major Lazer Support Center")
      .setDescription("Welcome to the official support hub. Use the buttons below to browse detailed guides or open a **Private Ticket** with our moderator team.")
      .setColor(0x5865F2)
      .setFooter({ text: "Major Lazer • Secure Trading Environment" });

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
  
  // 1. HELP MENU LOGIC
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
      .setPlaceholder("Select a specific detail...")
      .addOptions(category.options.map(o => ({ label: o.label, value: o.value.substring(0, 100), description: category.label })));

    await interaction.update({
      content: `### ${category.label}\n${category.description}`,
      components: [new ActionRowBuilder().addComponents(subMenu)]
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "help_option") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_help").setLabel("Back to Topics").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("contact_staff").setLabel("Still Need Help?").setStyle(ButtonStyle.Danger)
    );
    await interaction.update({ content: interaction.values, components: [row] });
  }

  // 2. PRIVATE TICKET LOGIC
  if (interaction.isButton() && interaction.customId === "contact_staff") {
    try {
      await interaction.reply({ content: "🔐 Creating your private ticket...", ephemeral: true });

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Hide from everyone
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: MOD_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        ],
      });

      const welcomeEmbed = new EmbedBuilder()
        .setTitle("🎟️ Private Support Ticket")
        .setDescription(`Hello ${interaction.user}, a moderator (<@&${1397207463387857036}>) will assist you shortly. Please describe your issue in detail here.\n\n**Note:** This channel is private between you and the staff.`)
        .setColor(0x57F287);

      await ticketChannel.send({ content: `<@&${1397207463387857036}> | New support request!`, embeds: [welcomeEmbed] });

      await interaction.editReply({ 
        content: `✅ Your private ticket has been created here: <#${ticketChannel.id}>. Please head over there to chat with us!` 
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: "❌ Error: I cannot create channels. Please ensure I have 'Manage Channels' permission in my role settings!" });
    }
  }
});

client.once('ready', () => { console.log(`✅ Major Lazer Bot is online!`); });
client.login(process.env.DISCORD_TOKEN);