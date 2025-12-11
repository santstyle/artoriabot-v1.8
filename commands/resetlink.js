async function resetlinkCommand(sock, chatId, senderId) {
    try {
        // Check if sender is admin
        const groupMetadata = await sock.groupMetadata(chatId);
        const isAdmin = groupMetadata.participants
            .filter(p => p.admin)
            .map(p => p.id)
            .includes(senderId);

        // Check if bot is admin
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotAdmin = groupMetadata.participants
            .filter(p => p.admin)
            .map(p => p.id)
            .includes(botId);

        if (!isAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Wah, cuma admin yang bisa reset link grup nih~'
            });
            return;
        }

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Aku harus jadi admin dulu biar bisa reset linknya~'
            });
            return;
        }

        // Kasih tau kalau lagi proses
        await sock.sendMessage(chatId, {
            text: 'Bentar ya, lagi aku reset linknya~'
        });

        // Reset the group link
        const newCode = await sock.groupRevokeInvite(chatId);

        // Send the new link
        await sock.sendMessage(chatId, {
            text: `Yeay! Link grup udah direset~\n\nLink baru:\nhttps://chat.whatsapp.com/${newCode}\n\nShare link yang ini ya, yang lama udah ga bisa dipakai~`
        });

    } catch (error) {
        console.error('Error di resetlink command:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, gagal reset link grup nih. Coba lagi ya~'
        });
    }
}

module.exports = resetlinkCommand;