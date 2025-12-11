/**
 * .setlang command
 * Usage:
 *   .setlang en - Set language to English
 *   .setlang id - Set language to Indonesian
 */

const langHelper = require('../lib/lang');

async function setLangCommand(sock, chatId, message, args) {
    try {
        if (!args || args.length === 0) {
            await sock.sendMessage(chatId, {
                text: 'Cara pakai: .setlang <en/id>\nContoh: .setlang id\n\nen = English\nid = Indonesia'
            }, { quoted: message });
            return;
        }

        const selectedLang = args[0].toLowerCase();
        const availableLangs = langHelper.getAvailableLangs();

        if (!availableLangs.includes(selectedLang)) {
            await sock.sendMessage(chatId, {
                text: `Wah, kode bahasa nya ga ada nih~ Pilihan yang ada: ${availableLangs.join(', ')}`
            }, { quoted: message });
            return;
        }

        const success = langHelper.setLang(chatId, selectedLang);
        if (!success) {
            await sock.sendMessage(chatId, {
                text: 'Aduh, gagal atur bahasa nih. Coba lagi ya~'
            }, { quoted: message });
            return;
        }

        // Confirmation messages for English and Indonesian
        const confirmationMessages = {
            en: 'Yeay! Now I speak English~',
            id: 'Hore! Sekarang aku pakai bahasa Indonesia~'
        };

        const confirmationText = confirmationMessages[selectedLang] || 'Bahasa sudah diatur~';

        await sock.sendMessage(chatId, {
            text: confirmationText
        }, { quoted: message });

    } catch (error) {
        console.error('Error di setlang command:', error);
        await sock.sendMessage(chatId, {
            text: 'Wah, ada error waktu atur bahasa nih. Coba lagi ya~'
        }, { quoted: message });
    }
}

module.exports = setLangCommand;