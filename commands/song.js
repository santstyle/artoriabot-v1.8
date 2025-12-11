const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { text: "🎶 Mau download lagu apa? Contoh: *.song judul lagu*" }, { quoted: message });
        }

        // Kalau input link YouTube langsung
        let videoUrl;
        if (searchQuery.startsWith('http')) {
            videoUrl = searchQuery;
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                return await sock.sendMessage(chatId, { text: "❌ Lagu tidak ditemukan." }, { quoted: message });
            }
            videoUrl = videos[0].url;
        }

        // Kasih notif ke user
        await sock.sendMessage(chatId, { text: `⏳ Sedang mendownload lagu...` }, { quoted: message });

        // SaveTube API
        const api = `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(videoUrl)}`;
        const res = await axios.get(api);
        const data = res.data;

        if (!data?.status || !data?.result?.downloadUrl) {
            return await sock.sendMessage(chatId, { text: "⚠️ Gagal ambil link download. Coba lagi nanti." }, { quoted: message });
        }

        const audioUrl = data.result.downloadUrl;
        const title = data.result.title;

        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            caption: `✅ Lagu berhasil diunduh!\n\n🎵 Judul: ${title}\n🔗 YouTube: ${videoUrl}`
        }, { quoted: message });

    } catch (error) {
        console.error("[SONG ERROR]:", error);
        await sock.sendMessage(chatId, { text: "❌ Download gagal, coba lagi nanti." }, { quoted: message });
    }
}

module.exports = songCommand;
