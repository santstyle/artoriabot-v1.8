const os = require('os');
const settings = require('../settings.js');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds %= (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds %= (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}hari `;
    if (hours > 0) time += `${hours}jam `;
    if (minutes > 0) time += `${minutes}menit `;
    if (seconds > 0 || time === '') time += `${seconds}detik`;

    return time.trim();
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();
        await sock.sendMessage(chatId, { text: 'Cek ping dulu ya~' }, { quoted: message });
        const end = Date.now();
        const ping = Math.round(end - start);

        const uptimeFormatted = formatTime(process.uptime());

        // RAM usage info
        const usedMemory = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const totalMemory = (os.totalmem() / 1024 / 1024).toFixed(2);

        const botInfo = `
Status Artoria Bot

Ping     : ${ping} ms
Uptime   : ${uptimeFormatted}
Memory   : ${usedMemory} MB / ${totalMemory} MB
Version  : v${settings.version}

Aku masih sehat dan siap bantu!`.trim();

        await sock.sendMessage(chatId, { text: botInfo }, { quoted: message });
    } catch (error) {
        console.error('Error di ping command:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, gagal cek status nih. Coba lagi ya~'
        });
    }
}

module.exports = pingCommand;