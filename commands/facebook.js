const axios = require("axios");

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(" ").slice(1).join(" ").trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: "❌ Tolong kasih link video Facebook.\n\nContoh: `.fb https://www.facebook.com/...`"
            }, { quoted: message });
        }

        if (!url.includes("facebook.com")) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Itu bukan link Facebook yang valid."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: "⏳ Sedang memproses video Facebook..." }, { quoted: message });

        // Ambil data video dari API
        const response = await axios.get(`https://api.dreaded.site/api/facebook?url=${url}`);
        const data = response.data;

        if (!data || data.status !== 200 || !data.facebook) {
            return await sock.sendMessage(chatId, {
                text: "❌ Gagal mendapatkan data video. Coba lagi nanti!"
            }, { quoted: message });
        }

        const fbvid = data.facebook.hdVideo || data.facebook.sdVideo; // pilih HD kalau ada
        if (!fbvid) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Video tidak ditemukan atau tidak bisa diunduh."
            }, { quoted: message });
        }

        // Kirim video langsung tanpa simpan ke file
        await sock.sendMessage(chatId, {
            video: { url: fbvid },
            mimetype: "video/mp4",
            caption: "✅ Video Facebook berhasil diunduh!\n\n_Downloaded by Artoria Bot_"
        }, { quoted: message });

    } catch (error) {
        console.error("Error di Facebook command:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Terjadi error saat ambil video Facebook. API mungkin down.\n\nError: " + error.message
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
