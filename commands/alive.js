const settings = require("../settings");
const langHelper = require("../lib/lang");

async function aliveCommand(sock, chatId, message) {
    try {
        const lang = langHelper.getLang(chatId);
        // Cek apakah pesan alive ada di language pack
        const aliveMessage = lang.general?.alive?.message || `Aku masih hidup dan sehat! Versi ${settings.version}~`;

        // Tambahkan pesan yang lebih imut jika tidak ada di language pack
        const message1 = aliveMessage.replace('{version}', settings.version);

        await sock.sendMessage(chatId, {
            text: message1
        }, { quoted: message });
    } catch (error) {
        console.error('Error di alive command:', error);
        // Default error message yang imut
        const errorMessage = 'Aduh, ada yang error nih. Tapi jangan khawatir, aku masih hidup kok~';
        await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: message });
    }
}

module.exports = aliveCommand;