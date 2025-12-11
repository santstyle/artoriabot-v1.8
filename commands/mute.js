const isAdmin = require('../lib/isAdmin');

async function muteCommand(sock, chatId, senderId, durationInMinutes) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, {
            text: 'Aku harus jadi admin dulu biar bisa mute grup~'
        });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, {
            text: 'Wah, cuma admin yang bisa mute grup nih~'
        });
        return;
    }

    const durationInMilliseconds = durationInMinutes * 60 * 1000;
    try {
        await sock.groupSettingUpdate(chatId, 'announcement'); // Mute the group
        await sock.sendMessage(chatId, {
            text: `Grup dimute untuk ${durationInMinutes} menit ya~`
        });

        setTimeout(async () => {
            await sock.groupSettingUpdate(chatId, 'not_announcement'); // Unmute after the duration
            await sock.sendMessage(chatId, {
                text: 'Waktunya selesai~ grup udah di-unmute!'
            });
        }, durationInMilliseconds);
    } catch (error) {
        console.error('Error mute/unmute grup:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, gagal mute/unmute grup nih. Coba lagi ya~'
        });
    }
}

module.exports = muteCommand;