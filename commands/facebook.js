const axios = require("axios");

// List API yang lebih reliable
const facebookApis = [
    {
        name: "API 1",
        url: "https://api.akuari.my.id/downloader/fbdownload",
        method: "POST",
        parse: (data) => data.hasil?.hd || data.hasil?.sd
    },
    {
        name: "API 2",
        url: "https://api.siputzx.my.id/api/download/fb",
        method: "GET",
        parse: (data) => data.result?.hd || data.result?.sd
    },
    {
        name: "API 3",
        url: "https://api-fg.vercel.app/api/v1/facebook",
        method: "GET",
        parse: (data) => data.result?.url_hd || data.result?.url
    },
    {
        name: "API 4",
        url: "https://api.dreaded.site/api/facebook",
        method: "GET",
        parse: (data) => data.facebook?.hdVideo || data.facebook?.sdVideo
    }
];

async function getFacebookVideo(url) {
    for (const api of facebookApis) {
        try {
            console.log(`Trying ${api.name}...`);

            let response;
            if (api.method === "POST") {
                response = await axios.post(api.url, { url }, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            } else {
                response = await axios.get(`${api.url}?url=${encodeURIComponent(url)}`, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            }

            const videoUrl = api.parse(response.data);
            if (videoUrl) {
                return {
                    success: true,
                    url: videoUrl,
                    api: api.name
                };
            }
        } catch (error) {
            console.log(`${api.name} failed:`, error.message);
            continue;
        }
    }

    return { success: false, error: "All APIs failed" };
}

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        // Ambil URL dari command .fb
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `📱 *Facebook Downloader*\n\n` +
                    `Gunakan: \`.fb <link>\`\n\n` +
                    `Contoh:\n` +
                    `\`.fb https://fb.watch/abc123xyz/\`\n` +
                    `\`.fb https://facebook.com/reel/12345\`\n\n` +
                    `Support:\n` +
                    `• Facebook videos\n` +
                    `• Facebook reels\n` +
                    `• FB Watch videos`
            }, { quoted: message });
        }

        // Validasi URL Facebook
        if (!url.includes('facebook.com') && !url.includes('fb.watch') && !url.includes('fb.com')) {
            return await sock.sendMessage(chatId, {
                text: "❌ Bukan link Facebook yang valid!\nPastikan link berasal dari Facebook."
            }, { quoted: message });
        }

        // Kirim status processing
        const processingMsg = await sock.sendMessage(chatId, {
            text: "⏳ Sedang memproses video Facebook..."
        }, { quoted: message });

        // Dapatkan video URL
        const videoData = await getFacebookVideo(url);

        if (!videoData.success) {
            await sock.sendMessage(chatId, {
                text: "❌ Gagal mendapatkan video!\nMungkin video private atau API down.",
                edit: processingMsg.key
            });
            return;
        }

        // Update status
        await sock.editMessage(chatId, processingMsg, {
            text: "✅ Video ditemukan!\n⬇️ Mengirim ke WhatsApp..."
        });

        // Kirim video langsung
        await sock.sendMessage(chatId, {
            video: { url: videoData.url },
            mimetype: "video/mp4",
            caption: `✅ Berhasil didownload via ${videoData.api}\n\n_Downloaded by Bot_`
        });

        // Hapus pesan processing
        await sock.deleteMessage(chatId, processingMsg.key);

    } catch (error) {
        console.error("Facebook command error:", error);

        await sock.sendMessage(chatId, {
            text: "❌ Error: " + (error.message || "Terjadi kesalahan")
        }, { quoted: message });
    }
}

module.exports = {
    fb: facebookCommand,
    facebook: facebookCommand
};