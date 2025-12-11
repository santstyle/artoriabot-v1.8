
const settings = require('../settings');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function broadcastCommand(sock, chatId, message, args) {
    const sender = message.key?.participant || message.key?.remoteJid;
    const ownerJid = settings.ownerNumber + '@s.whatsapp.net';

    if (sender !== ownerJid) {
        return sock.sendMessage(chatId, { text: '❌ Kamu tidak punya akses untuk broadcast!' }, { quoted: message });
    }

    // Ambil teks tambahan (caption) tanpa ikut command .bc
    let bcText = args.join(' ') || '';
    if (bcText.startsWith('.bc')) bcText = bcText.replace(/^\.bc\s*/, '');

    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    // Ambil semua grup
    const allGroups = await sock.groupFetchAllParticipating();
    const groupIds = Object.keys(allGroups);

    let success = 0;
    let failed = 0;

    for (const groupId of groupIds) {
        try {
            let msgOptions = {};

            if (quotedMsg) {
                const type = Object.keys(quotedMsg)[0];
                let buffer;

                // Download media kalau bukan teks
                if (!['conversation', 'extendedTextMessage'].includes(type)) {
                    buffer = await downloadMediaMessage({ message: quotedMsg }, 'buffer', {}, { logger: console });
                }

                switch (type) {
                    case 'imageMessage':
                        msgOptions = {
                            image: buffer,
                            caption: `*Broadcast dari SantStyle*\n\n${bcText || quotedMsg.imageMessage?.caption || ''}`
                        };
                        break;
                    case 'videoMessage':
                        msgOptions = {
                            video: buffer,
                            caption: `*Broadcast dari SantStyle*\n\n${bcText || quotedMsg.videoMessage?.caption || ''}`
                        };
                        break;
                    case 'audioMessage':
                        msgOptions = {
                            audio: buffer,
                            mimetype: quotedMsg.audioMessage?.mimetype || 'audio/mp4',
                            ptt: quotedMsg.audioMessage?.ptt || false
                        };
                        break;
                    case 'stickerMessage':
                        msgOptions = { sticker: buffer };
                        break;
                    case 'documentMessage':
                        msgOptions = {
                            document: buffer,
                            mimetype: quotedMsg.documentMessage?.mimetype,
                            fileName: quotedMsg.documentMessage?.fileName || 'file'
                        };
                        break;
                    default:
                        msgOptions = { text: `*Broadcast dari SantStyle*\n\n${bcText}` };
                }
            } else {
                msgOptions = { text: `*Broadcast dari SantStyle*\n\n${bcText}` };
            }

            await sock.sendMessage(groupId, msgOptions);
            success++;
        } catch (err) {
            console.error(`Gagal broadcast ke ${groupId}:`, err);
            failed++;
        }
    }

    await sock.sendMessage(chatId, {
        text: `✅ Broadcast selesai!\nSukses: ${success}, Gagal: ${failed}`
    }, { quoted: message });
}

module.exports = broadcastCommand;
