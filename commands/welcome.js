const { handleWelcome } = require('../lib/welcome');

async function welcomeCommand(sock, chatId, message, match) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, {
            text: 'Hmm, command ini cuma bisa dipakai di grup aja lho~ Kirim ke grup ya biar bisa dipakai'
        });
        return;
    }

    const text = message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

module.exports = welcomeCommand;