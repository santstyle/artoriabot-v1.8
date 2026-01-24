const isAdmin = require('../lib/isAdmin');

async function kickCommand(sock, chatId, senderId, mentionedJids, message) {
    const isOwner = message.key.fromMe;
    if (!isOwner) {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Aku harus jadi admin dulu biar bisa kick member~'
            }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Wah, cuma admin yang bisa kick member nih~'
            }, { quoted: message });
            return;
        }
    }

    let usersToKick = [];

    if (mentionedJids && mentionedJids.length > 0) {
        usersToKick = mentionedJids;
    }
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        usersToKick = [message.message.extendedTextMessage.contextInfo.participant];
    }

    if (usersToKick.length === 0) {
        await sock.sendMessage(chatId, {
            text: 'Sebutin dong usernya yang mau di-kick? Mention atau reply chatnya~'
        }, { quoted: message });
        return;
    }

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    if (usersToKick.includes(botId)) {
        await sock.sendMessage(chatId, {
            text: "Wah, aku ga bisa kick diri sendiri dong~"
        }, { quoted: message });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, usersToKick, "remove");

        const usernames = await Promise.all(usersToKick.map(async jid => {
            return `@${jid.split('@')[0]}`;
        }));

        await sock.sendMessage(chatId, {
            text: `${usernames.join(', ')} udah di-kick dari grup ya~`,
            mentions: usersToKick
        });
    } catch (error) {
        console.error('Error di kick command:', error);
        await sock.sendMessage(chatId, {
            text: 'Gagal kick member nih, coba lagi ya~'
        });
    }
}

module.exports = kickCommand;