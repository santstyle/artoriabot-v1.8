const yts = require('yt-search');
const axios = require('axios');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: "🎶 Mau download lagu apa? Contoh: *.play judul lagu*"
            }, { quoted: message });
        }

        // Cari lagu di YouTube
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "❌ Lagu tidak ditemukan di YouTube."
            }, { quoted: message });
        }

        // Ambil hasil pertama
        const video = videos[0];
        const urlYt = video.url;

        // Kirim pesan loading
        await sock.sendMessage(chatId, {
            text: `⏳ Sedang menyiapkan lagu *${video.title}*...\nDurasi: ${video.timestamp}\nChannel: ${video.author.name}`
        }, { quoted: message });

        // Ambil audio dari API
        const response = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`);
        const data = response.data;

        if (!data || !data.status || !data.result || !data.result.downloadUrl) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Gagal ambil audio dari API. Coba lagi nanti ya."
            }, { quoted: message });
        }

        const audioUrl = data.result.downloadUrl;
        const title = data.result.title;

        // Kirim file audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            caption: `✅ Berhasil download!\n\n🎵 Judul: ${title}\n🔗 YouTube: ${urlYt}`
        }, { quoted: message });

    } catch (error) {
        console.error('Error di play command:', error);
        await sock.sendMessage(chatId, {
            text: "❌ Download gagal, coba lagi nanti."
        }, { quoted: message });
    }
}

module.exports = playCommand;

