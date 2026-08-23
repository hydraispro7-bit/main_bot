import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

const QUEUE_FILE = 'queue_data.json';
const USERS_FILE = 'registered_users.json';
const RANKS_FILE = 'ranks_data.json';

function getAllQueues() {
    if (!fs.existsSync(QUEUE_FILE)) return {};
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}

function getQueue(gamemode) {
    let queues = getAllQueues();
    if (!queues[gamemode]) {
        queues[gamemode] = { queue: [], status: 'Closed' };
    }
    return queues[gamemode];
}

function saveQueue(gamemode, data) {
    let queues = getAllQueues();
    queues[gamemode] = data;
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queues, null, 2));
}

function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getRanks() {
    if (!fs.existsSync(RANKS_FILE)) return {};
    return JSON.parse(fs.readFileSync(RANKS_FILE, 'utf8'));
}

function saveRanks(ranks) {
    fs.writeFileSync(RANKS_FILE, JSON.stringify(ranks, null, 2));
}

app.get('/api/data', (req, res) => {
    try {
        const queuesData = getAllQueues();
        const usersData = getUsers();
        const ranksData = getRanks();
        res.json({ queues: queuesData, users: usersData, ranks: ranksData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load database data' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.login(process.env.DISCORD_TOKEN);

const ALLOWED_ROLE_IDS = ['1533808158131224837', '1533102895967502437', '1534156059252359218'];
const CATEGORY_ID = '1534521022068559882';
const RESULT_CHANNEL_ID = '1533097700998910082';

const GAMEMODE_ROLES = {
    'sword': '1533126270777294868',
    'nethpot': '1533126045744627902',
    'smp': '1533126015310758108',
    'diapot': '1533125958649774364',
    'crystal': '1536760686602883122',
    'mace': '1533125879767630095',
    'spear': '1533125792865980506',
    'uhc': '1533126165458452594',
    'axe': '1533126117425152131',
    'cart': '1533125910402695258'
};

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

async function updateQueueMessage(gamemode) {
    const qData = getQueue(gamemode);
    const gmDisplayName = gamemode.toUpperCase();
    
    if (qData.status === 'Closed') {
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle(`🔒 ${gmDisplayName} Queue Closed`)
            .setDescription('This testing session has ended. You will be notified here when a new queue opens.')
            .addFields(
                { name: '📋 Reason', value: 'Queue manually ended by command', inline: false },
                { name: '⏱️ Session Ended', value: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }), inline: false }
            )
            .setFooter({ text: 'Thank you for testing!' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`q_open_${gamemode}`).setLabel('Open Queue').setStyle(ButtonStyle.Success)
        );

        return { embeds: [embed], components: [row] };
    } else {
        let queueListText = 'No players in queue.';
        if (qData.queue.length > 0) {
            queueListText = qData.queue.map((p, index) => `${index + 1}. <@${p.userId}>`).join('\n');
        }

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`✅ ${gmDisplayName} Queue Open!`)
            .setDescription(`The queue is now open and updates in real-time.\n\n📋 **Queue (${qData.queue.length}/20)**\n${queueListText}\n\n💡 **Thanks for waiting. We will get to everyone in order, so please hang tight for your turn.**`);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`q_close_${gamemode}`).setLabel('Close Queue').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`q_join_${gamemode}`).setLabel('Join Queue').setStyle(ButtonStyle.Success)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`q_leave_${gamemode}`).setLabel('Leave Queue').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`q_next_${gamemode}`).setLabel('Next Player').setStyle(ButtonStyle.Primary)
        );

        return { embeds: [embed], components: [row1, row2] };
    }
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!registersetup') {
        const hasRole = message.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));
        if (!hasRole) return message.reply('❌ You do not have permission to use this command!');

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('OceanTiers Evaluation Tests')
            .setDescription(
                'OceanTiers Evaluation Tests 🏆\n\n' +
                'Upon applying, you will be added to a waitlist channel.\n' +
                'Here you will be pinged when a tester of your region is available.\n\n' +
                '🟢 **Register Your Profile** ⭐\n' +
                'Click **Register / Update Profile** to set your in-game username, region, and account type before joining any queue.\n\n' +
                '🟡 **Select a Gamemode** 📱\n' +
                'Click any gamemode button below to receive the corresponding waitlist role.'
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('register_modal').setLabel('Register / Update Profile').setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        message.delete().catch(() => {});
    }

    // 10 Gamemode Queue Setup Commands
    const gamemodeCommands = {
        '!swordqueue': 'sword',
        '!nethpotqueue': 'nethpot',
        '!smpqueue': 'smp',
        '!diapotqueue': 'diapot',
        '!crystalqueue': 'crystal',
        '!macequeue': 'mace',
        '!spearqueue': 'spear',
        '!uhcqueue': 'uhc',
        '!axequeue': 'axe',
        '!cartqueue': 'cart'
    };

    if (gamemodeCommands[message.content]) {
        const hasRole = message.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));
        if (!hasRole) return message.reply('❌ You do not have permission to use this command!');

        const gm = gamemodeCommands[message.content];
        const payload = await updateQueueMessage(gm);
        await message.channel.send(payload);
        message.delete().catch(() => {});
    }
});

client.on('interactionCreate', async interaction => {
    try {
        const userId = interaction.user.id;
        let users = getUsers();

        if (interaction.isButton() && interaction.customId === 'register_modal') {
            const modal = new ModalBuilder().setCustomId('register_form').setTitle('Player Registration');
            const ignInput = new TextInputBuilder().setCustomId('ign_input').setLabel('Minecraft Username (IGN)').setStyle(TextInputStyle.Short).setRequired(true);
            const regionInput = new TextInputBuilder().setCustomId('region_input').setLabel('Region (AS, NA, EU)').setStyle(TextInputStyle.Short).setRequired(true);
            const accInput = new TextInputBuilder().setCustomId('acc_input').setLabel('Account Type').setPlaceholder('Cracked or Premium').setStyle(TextInputStyle.Short).setRequired(true);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(ignInput),
                new ActionRowBuilder().addComponents(regionInput),
                new ActionRowBuilder().addComponents(accInput)
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'register_form') {
            const ign = interaction.fields.getTextInputValue('ign_input');
            const region = interaction.fields.getTextInputValue('region_input').toUpperCase();
            const accountType = interaction.fields.getTextInputValue('acc_input');
            
            users[userId] = { ign, region, accountType };
            saveUsers(users);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_gamemode')
                .setPlaceholder('Select your gamemode...')
                .addOptions([
                    { label: 'Sword', value: 'sword', emoji: '⚔️' },
                    { label: 'NethPot', value: 'nethpot', emoji: '🧪' },
                    { label: 'SMP', value: 'smp', emoji: '🌍' },
                    { label: 'DiaPot', value: 'diapot', emoji: '💎' },
                    { label: 'Crystal', value: 'crystal', emoji: '🔮' },
                    { label: 'Mace', value: 'mace', emoji: '🔨' },
                    { label: 'Spear', value: 'spear', emoji: '🔱' },
                    { label: 'UHC', value: 'uhc', emoji: '❤️' },
                    { label: 'Axe', value: 'axe', emoji: '🪓' },
                    { label: 'Cart', value: 'cart', emoji: '🛒' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            return await interaction.reply({
                content: `✅ Your profile has been saved successfully!\n\nSelect the gamemode you want to get the role for below:`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'select_gamemode') {
            const selectedValue = interaction.values[0];
            const roleId = GAMEMODE_ROLES[selectedValue];

            if (roleId) {
                try {
                    await interaction.member.roles.add(roleId);
                    return await interaction.reply({ content: `✅ You have been given the **${selectedValue.toUpperCase()}** role and added to the waitlist!`, flags: MessageFlags.Ephemeral });
                } catch (err) {
                    return await interaction.reply({ content: `❌ Bot lacks permission to assign this role!`, flags: MessageFlags.Ephemeral });
                }
            }
        }

        if (interaction.isButton()) {
            const hasAllowedRole = interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));
            const customId = interaction.customId;

            // Handle Dynamic Queue Buttons (e.g. q_open_sword, q_join_mace, etc.)
            if (customId.startsWith('q_open_') || customId.startsWith('q_close_') || customId.startsWith('q_join_') || customId.startsWith('q_leave_') || customId.startsWith('q_next_')) {
                const parts = customId.split('_');
                const action = parts[1]; // open, close, join, leave, next
                const gamemode = parts.slice(2).join('_');
                let qData = getQueue(gamemode);

                if (action === 'open') {
                    if (!hasAllowedRole) return interaction.reply({ content: '❌ You do not have permission to open the queue!', flags: MessageFlags.Ephemeral });
                    qData.status = 'Open';
                    saveQueue(gamemode, qData);
                    const payload = await updateQueueMessage(gamemode);
                    return await interaction.update(payload);
                }

                if (action === 'close') {
                    if (!hasAllowedRole) return interaction.reply({ content: '❌ You do not have permission to close the queue!', flags: MessageFlags.Ephemeral });
                    qData.status = 'Closed';
                    saveQueue(gamemode, qData);
                    const payload = await updateQueueMessage(gamemode);
                    return await interaction.update(payload);
                }

                if (action === 'join') {
                    if (qData.status !== 'Open') return interaction.reply({ content: '❌ Queue is currently closed!', flags: MessageFlags.Ephemeral });
                    if (!users[userId]) return interaction.reply({ content: '❌ Please register your profile first using the registration panel!', flags: MessageFlags.Ephemeral });
                    if (qData.queue.some(p => p.userId === userId)) return interaction.reply({ content: '⚠️ You are already in the queue!', flags: MessageFlags.Ephemeral });
                    if (qData.queue.length >= 20) return interaction.reply({ content: '❌ Queue is full (20/20)!', flags: MessageFlags.Ephemeral });

                    qData.queue.push({ userId, ign: users[userId].ign, region: users[userId].region });
                    saveQueue(gamemode, qData);
                    
                    const payload = await updateQueueMessage(gamemode);
                    await interaction.message.edit(payload);
                    return interaction.reply({ content: '✅ You have successfully joined the queue!', flags: MessageFlags.Ephemeral });
                }

                if (action === 'leave') {
                    const index = qData.queue.findIndex(p => p.userId === userId);
                    if (index === -1) return interaction.reply({ content: '❌ You are not in the queue!', flags: MessageFlags.Ephemeral });

                    qData.queue.splice(index, 1);
                    saveQueue(gamemode, qData);

                    const payload = await updateQueueMessage(gamemode);
                    await interaction.message.edit(payload);
                    return interaction.reply({ content: '✅ You have left the queue.', flags: MessageFlags.Ephemeral });
                }

                if (action === 'next') {
                    if (!hasAllowedRole) return interaction.reply({ content: '❌ You do not have permission to pull the next player!', flags: MessageFlags.Ephemeral });
                    if (qData.queue.length === 0) return interaction.reply({ content: '❌ Queue is empty!', flags: MessageFlags.Ephemeral });

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const removedPlayer = qData.queue.shift();
                    saveQueue(gamemode, qData);

                    const payload = await updateQueueMessage(gamemode);
                    await interaction.message.edit(payload);

                    try {
                        const guild = interaction.guild;
                        const channelName = `test-${removedPlayer.ign.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
                        
                        const ticketChannel = await guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: CATEGORY_ID,
                            permissionOverwrites: [
                                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                { id: removedPlayer.userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                                ...ALLOWED_ROLE_IDS.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
                            ]
                        });

                        const rankRow1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_HT1_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('HT1').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_LT1_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('LT1').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_HT2_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('HT2').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_LT2_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('LT2').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_HT3_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('HT3').setStyle(ButtonStyle.Success)
                        );

                        const rankRow2 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_LT3_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('LT3').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_HT4_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('HT4').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_LT4_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('LT4').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_HT5_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('HT5').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`rank_${gamemode}_LT5_${removedPlayer.userId}_${removedPlayer.ign}`).setLabel('LT5').setStyle(ButtonStyle.Secondary)
                        );

                        await ticketChannel.send({
                            content: `Testing ticket has been created for **${removedPlayer.ign.toUpperCase()}** (${gamemode.toUpperCase()}) <@${removedPlayer.userId}>\n\nPlease select the earned rank below:`,
                            components: [rankRow1, rankRow2]
                        });

                        return await interaction.editReply({ content: `✅ Next player pulled successfully! Channel created: <#${ticketChannel.id}>` });
                    } catch (err) {
                        console.error(err);
                        return await interaction.editReply({ content: `⚠️ Failed to create ticket channel. Check category ID and bot permissions.` });
                    }
                }
            }

            if (customId.startsWith('rank_')) {
                if (!hasAllowedRole) return interaction.reply({ content: '❌ You do not have permission to assign ranks!', flags: MessageFlags.Ephemeral });

                const parts = customId.split('_');
                const gamemode = parts[1];
                const earnedRankShort = parts[2];
                const targetUserId = parts[3];
                const targetIgn = parts[4];

                const rankMapping = {
                    'HT1': 'High Tier 1', 'LT1': 'Low Tier 1',
                    'HT2': 'High Tier 2', 'LT2': 'Low Tier 2',
                    'HT3': 'High Tier 3', 'LT3': 'Low Tier 3',
                    'HT4': 'High Tier 4', 'LT4': 'Low Tier 4',
                    'HT5': 'High Tier 5', 'LT5': 'Low Tier 5'
                };
                const earnedRankFull = rankMapping[earnedRankShort] || earnedRankShort;

                let ranks = getRanks();
                const rankKey = `${targetIgn}_${gamemode}`;
                const previousRank = ranks[rankKey] ? ranks[rankKey].rank : 'Unranked';
                
                ranks[rankKey] = {
                    ign: targetIgn,
                    userId: targetUserId,
                    rank: earnedRankFull,
                    previousRank: previousRank,
                    region: users[targetUserId] ? users[targetUserId].region : 'NA',
                    gamemode: gamemode
                };
                saveRanks(ranks);

                const resultChannel = interaction.guild.channels.cache.get(RESULT_CHANNEL_ID) || interaction.channel;
                const resultEmbed = new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setTitle(`${targetIgn}'s Tier Update (${gamemode.toUpperCase()}) 🏆`)
                    .addFields(
                        { name: 'Tester', value: `<@${interaction.user.id}>`, inline: false },
                        { name: 'Minecraft Username', value: `\`${targetIgn}\``, inline: false },
                        { name: 'Game Mode', value: `\`${gamemode.toUpperCase()}\``, inline: false },
                        { name: 'Previous Rank', value: `\`${previousRank}\``, inline: false },
                        { name: 'Rank Earned', value: `\`${earnedRankFull}\``, inline: false }
                    )
                    .setTimestamp();

                await resultChannel.send({ embeds: [resultEmbed] });
                await interaction.reply({ content: `✅ Rank updated to **${earnedRankFull}** for **${gamemode.toUpperCase()}**! Deleting ticket channel...`, flags: MessageFlags.Ephemeral });

                setTimeout(async () => {
                    try {
                        if (interaction.channel && interaction.channel.deletable) {
                            await interaction.channel.delete('Testing completed and rank assigned.');
                        }
                    } catch (err) {
                        console.error('Failed to delete channel:', err);
                    }
                }, 3000);

                return;
            }
        }

    } catch (error) { console.error(error); }
});

client.login(TOKEN);