const { handleAntiBadwordCommand } = require('../lib/antibadword');

async function antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        // Extract match from message
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        // Ambil argumen setelah .antibadword
        const match = text.split(' ').slice(1).join(' ');

        await handleAntiBadwordCommand(sock, chatId, message, match, senderId);

    } catch (error) {
        console.error('Error di antibadword command:', error);

        await sock.sendMessage(chatId, {
            text: '❌ *TERJADI KESALAHAN!*\n\n' +
                'Terjadi error saat memproses perintah antibadword.\n' +
                'Silakan coba lagi beberapa saat.'
        });
    }
}

module.exports = antibadwordCommand;