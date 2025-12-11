// commands/ytmp4.js
const yt = require('../ytmp4');
const fs = require('fs');

module.exports = async function (sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const args = text.split(' ');
        const query = args.slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                text: 'Haii~ kasih tahu dong mau download video YouTube apa?\nKetik link atau judul videonya, ya!\n\nContoh: *.ytmp4 Alan Walker Faded*'
            }, { quoted: message });
            return;
        }

        // Kasih tahu kalau lagi proses
        await sock.sendMessage(chatId, {
            text: 'Tunggu sebentar ya, aku cariin dulu videonya~'
        }, { quoted: message });

        // Ambil data video
        const data = await yt.mp4(query, 134);
        if (!data || !data.videoUrl) {
            await sock.sendMessage(chatId, {
                text: 'Aduh, videonya ga ketemu nih. Coba cek lagi judul atau linknya, ya~'
            }, { quoted: message });
            return;
        }

        // Kasih preview dulu
        await sock.sendMessage(chatId, {
            image: { url: data.thumb.url },
            caption: `🎬 *${data.title}*\n📺 Channel: ${data.channel}\n⏳ Durasi: ${data.duration} detik\n📅 Rilis: ${data.date}\n\nBentar ya, lagi aku download dulu~`
        }, { quoted: message });

        // Kasih tau lagi kalau lagi proses download
        await sock.sendMessage(chatId, {
            text: 'Hmm, videonya lumayan besar nih. Sabar ya, lagi aku ambil pelan-pelan~'
        }, { quoted: message });

        // Kirim file video
        await sock.sendMessage(chatId, {
            video: { url: data.videoUrl },
            mimetype: 'video/mp4',
            caption: `🎬 *${data.title}*\n\nYeayy! video nya udah siap, nih~ Jangan lupa subscribe channel ${data.channel} ya!\n\n> *_Downloaded by Artoria Bot_*`
        }, { quoted: message });

    } catch (error) {
        console.error('[YTMP4 Error]', error);
        await sock.sendMessage(chatId, {
            text: 'Wah, ada yang error nih. Kayaknya YouTube lagi moody deh. Coba lagi ya nanti~'
        }, { quoted: message });
    }
};