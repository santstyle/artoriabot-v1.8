const { igdl } = require("ruhend-scraper");

// Store processed message IDs untuk anti-duplikat
const processedMessages = new Set();

function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();

    for (const media of mediaData) {
        if (!media.url) continue;
        if (!seenUrls.has(media.url)) {
            seenUrls.add(media.url);
            uniqueMedia.push(media);
        }
    }
    return uniqueMedia;
}

async function instagramCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);

        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: "❌ Tolong kasih link Instagram.\n\nContoh: `.ig https://www.instagram.com/reel/...`"
            }, { quoted: message });
        }

        // Validasi URL IG
        const igPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//,
        ];
        if (!igPatterns.some(pattern => pattern.test(text))) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Itu bukan link Instagram yang valid."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: "⏳ Sedang memproses video Instagram..." }, { quoted: message });

        const downloadData = await igdl(text);
        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "❌ Tidak ada media ditemukan. Mungkin akun private atau link salah."
            }, { quoted: message });
        }

        const mediaData = extractUniqueMedia(downloadData.data).slice(0, 10); // ambil max 10

        for (let i = 0; i < mediaData.length; i++) {
            const media = mediaData[i];
            const mediaUrl = media.url;

            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) ||
                media.type === "video" ||
                text.includes("/reel/") ||
                text.includes("/tv/");

            if (isVideo) {
                await sock.sendMessage(chatId, {
                    video: { url: mediaUrl },
                    mimetype: "video/mp4",
                    caption: "✅ Video Instagram berhasil diunduh!\n\n_Downloaded by Artoria Bot_"
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    image: { url: mediaUrl },
                    caption: "✅ Foto Instagram berhasil diunduh!\n\n_Downloaded by Artoria Bot_"
                }, { quoted: message });
            }

            if (i < mediaData.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (error) {
        console.error("Error di Instagram command:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Terjadi error saat ambil media Instagram. Coba lagi nanti.\n\nError: " + error.message
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
