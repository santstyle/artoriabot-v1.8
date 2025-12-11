const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: 'Hmm, cuma admin yang bisa atur antilink nih~'
            });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `SETTINGAN ANTILINK\n\n${prefix}antilink on\n${prefix}antilink set delete | kick | warn\n${prefix}antilink off`;
            await sock.sendMessage(chatId, { text: usage });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: 'Antilink udah aktif dari tadi lho di grup ini~'
                    });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    text: result ? 'Yeay! antilink udah aku nyalain~' : 'Aduh, gagal nyalain antilink nih'
                });
                break;

            case 'off':
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: 'Oke, antilink udah aku matiin di grup ini~'
                });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `Sebutin dong aksinya: ${prefix}antilink set delete | kick | warn`
                    });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: 'Wah, aksinya ga sesuai nih. Pilih delete, kick, atau warn aja ya~'
                    });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, {
                    text: setResult ? `Hore! aksi antilink diatur jadi: ${setAction}` : 'Gagal atur aksi antilink nih'
                });
                break;

            case 'get':
                const status = await getAntilink(chatId, 'on');
                const actionConfig = await getAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: `Status Antilink:\nStatus: ${status ? 'ON' : 'OFF'}\nAksi: ${actionConfig ? actionConfig.action : 'Belum diatur'}`
                });
                break;

            default:
                await sock.sendMessage(chatId, {
                    text: `Coba ketik ${prefix}antilink aja ya buat lihat caranya~`
                });
        }
    } catch (error) {
        console.error('Error di antilink command:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, ada error waktu atur antilink nih'
        });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        const antilinkSetting = await getAntilink(chatId, 'on');
        if (!antilinkSetting?.enabled) return;

        // Check if user is admin (admins can post links)
        let isUserAdmin = false;
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === senderId);
            isUserAdmin = participant?.admin;
        } catch (error) {
            console.error('Error cek admin status:', error);
        }

        // Admins can post links
        if (isUserAdmin) return;

        // Log the full message object to diagnose message structure
        console.log("Cek pesan untuk link:", userMessage);

        let shouldDelete = false;

        const linkPatterns = {
            whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
            whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
            telegram: /t\.me\/[A-Za-z0-9_]+/,
            allLinks: /https?:\/\/[^\s]+/,
        };

        // Detect WhatsApp Group links
        if (linkPatterns.whatsappGroup.test(userMessage)) {
            console.log('Ketemu link WhatsApp grup!');
            shouldDelete = true;
        } else if (linkPatterns.whatsappChannel.test(userMessage)) {
            shouldDelete = true;
        } else if (linkPatterns.telegram.test(userMessage)) {
            shouldDelete = true;
        } else if (linkPatterns.allLinks.test(userMessage)) {
            shouldDelete = true;
        }

        if (shouldDelete) {
            const quotedMessageId = message.key.id;
            const quotedParticipant = message.key.participant || senderId;

            console.log(`Coba hapus pesan dengan id: ${quotedMessageId}`);

            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: quotedMessageId,
                        participant: quotedParticipant
                    },
                });
                console.log(`Pesan berhasil dihapus`);
            } catch (error) {
                console.error('Gagal hapus pesan:', error);
            }

            const mentionedJidList = [senderId];

            // Pilih pesan berdasarkan aksi yang diatur
            const action = antilinkSetting.action || 'delete';
            let warningMessage = `Hai @${senderId.split('@')[0]}, jangan post link ya~`;

            if (action === 'warn') {
                warningMessage = `Hai @${senderId.split('@')[0]}, ini peringatan ya, jangan post link~`;
            } else if (action === 'kick') {
                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], "remove");
                    warningMessage = `@${senderId.split('@')[0]} di-kick karena post link~`;
                } catch (kickError) {
                    console.error('Gagal kick user:', kickError);
                    warningMessage = `Hai @${senderId.split('@')[0]}, post link ga boleh~`;
                }
            }

            await sock.sendMessage(chatId, {
                text: warningMessage,
                mentions: mentionedJidList
            });
        } else {
            console.log('Ga ada link yang ketemu atau proteksi ga aktif');
        }
    } catch (error) {
        console.error('Error di link detection:', error);
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
};