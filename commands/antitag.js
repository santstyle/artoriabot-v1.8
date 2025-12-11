const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Wah, cuma admin yang bisa atur antitag nih~'
            });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `SETTINGAN ANTITAG\n\n${prefix}antitag on\n${prefix}antitag set delete | kick\n${prefix}antitag off`;
            await sock.sendMessage(chatId, { text: usage });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntitag(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: 'Antitag udah aktif dari tadi lho~'
                    });
                    return;
                }
                const result = await setAntitag(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    text: result ? 'Yeay! antitag udah aku nyalain~' : 'Aduh, gagal nyalain antitag nih'
                });
                break;

            case 'off':
                await removeAntitag(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: 'Oke, antitag udah aku matiin~'
                });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `Sebutin dong aksinya: ${prefix}antitag set delete | kick`
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: 'Wah, aksinya ga sesuai nih. Pilih delete atau kick aja ya~'
                    });
                    return;
                }
                const setResult = await setAntitag(chatId, 'on', setAction);
                await sock.sendMessage(chatId, {
                    text: setResult ? `Hore! aksi antitag diatur jadi: ${setAction}` : 'Gagal atur aksi antitag nih'
                });
                break;

            case 'get':
                const status = await getAntitag(chatId, 'on');
                const actionConfig = await getAntitag(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: `Status Antitag:\nStatus: ${status ? 'ON' : 'OFF'}\nAksi: ${actionConfig ? actionConfig.action : 'Belum diatur'}`
                });
                break;

            default:
                await sock.sendMessage(chatId, {
                    text: `Coba ketik ${prefix}antitag aja ya buat lihat caranya~`
                });
        }
    } catch (error) {
        console.error('Error di antitag command:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, ada error waktu atur antitag nih'
        });
    }
}

async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        const antitagSetting = await getAntitag(chatId, 'on');
        if (!antitagSetting || !antitagSetting.enabled) return;

        // Check if message contains mentions
        const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
            message.message?.conversation?.match(/@\d+/g) ||
            [];

        // Check if it's a group message and has multiple mentions
        if (mentions.length > 0 && mentions.length >= 3) {
            // Get group participants to check if it's tagging most/all members
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants || [];

            // If mentions are more than 50% of group members, consider it as tagall
            const mentionThreshold = Math.ceil(participants.length * 0.5);

            if (mentions.length >= mentionThreshold) {
                console.log(`Antitag: Deteksi tagall di grup ${chatId} oleh ${senderId}`);

                const action = antitagSetting.action || 'delete';

                if (action === 'delete') {
                    // Delete the message
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: false,
                            id: message.key.id,
                            participant: senderId
                        }
                    });

                    // Send warning
                    await sock.sendMessage(chatId, {
                        text: `Hai, jangan tag semua member ya~`
                    }, { quoted: message });

                } else if (action === 'kick') {
                    // Kick the user
                    await sock.groupParticipantsUpdate(chatId, [senderId], "remove");

                    // Send notification
                    await sock.sendMessage(chatId, {
                        text: `@${senderId.split('@')[0]} di-kick karena tag semua member~`
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error di tag detection:', error);
    }
}

module.exports = {
    handleAntitagCommand,
    handleTagDetection
};