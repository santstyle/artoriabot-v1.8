async function clearCommand(sock, chatId) {
    try {
        const message = await sock.sendMessage(chatId, {
            text: 'Bentar ya, lagi aku bersihin pesanku~'
        });
        const messageKey = message.key;

        await sock.sendMessage(chatId, { delete: messageKey });

    } catch (error) {
        console.error('Error di clear command:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, gagal bersihin pesan nih. Coba lagi ya~'
        });
    }
}

module.exports = { clearCommand };