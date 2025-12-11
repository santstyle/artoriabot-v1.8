const isAdmin = require('../lib/isAdmin');

async function deleteCommand(sock, chatId, message, senderId) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, {
            text: 'Aku harus jadi admin dulu biar bisa hapus pesan~'
        });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, {
            text: 'Wah, cuma admin yang bisa hapus pesan nih~'
        });
        return;
    }

    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

    if (quotedMessage) {
        await sock.sendMessage(chatId, {
            delete: {
                remoteJid: chatId,
                fromMe: false,
                id: quotedMessage,
                participant: quotedParticipant
            }
        });
    } else {
        await sock.sendMessage(chatId, {
            text: 'Reply pesan yang mau dihapus dong~'
        });
    }
}

module.exports = deleteCommand;