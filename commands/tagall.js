const isAdmin = require('../lib/isAdmin');

async function tagAllCommand(sock, chatId, senderId) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin && !isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Wah, cuma admin yang bisa pake command tagall nih'
            });
            return;
        }

        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, {
                text: 'Grupnya kosong nih, ga ada yang bisa di-tag'
            });
            return;
        }

        // Create message with each member on a new line
        let message = 'Tag buat semua member grup:\n\n';
        participants.forEach((participant, index) => {
            message += `${index + 1}. @${participant.id.split('@')[0]}\n`;
        });

        // Send message with mentions
        await sock.sendMessage(chatId, {
            text: message,
            mentions: participants.map(p => p.id)
        });

    } catch (error) {
        console.error('Error di tagall:', error);
        await sock.sendMessage(chatId, {
            text: 'Gagal nge-tag member, coba lagi ya'
        });
    }
}

module.exports = tagAllCommand;