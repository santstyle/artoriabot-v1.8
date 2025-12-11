const { ttdl } = require("ruhend-scraper");
const axios = require('axios');

// Store processed message IDs untuk anti-duplikat
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);

        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: "❌ Tolong kasih link TikTok untuk diunduh.\n\nContoh: `.tiktok https://vt.tiktok.com/...`"
            }, { quoted: message });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, {
                text: "❌ Tolong kasih link TikTok yang valid."
            }, { quoted: message });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, {
                text: "⚠️ Itu bukan link TikTok yang valid."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        try {
            const apis = [
                `https://api.princetechn.com/api/download/tiktok?apikey=prince&url=${encodeURIComponent(url)}`,
                `https://api.princetechn.com/api/download/tiktokdlv2?apikey=prince&url=${encodeURIComponent(url)}`,
                `https://api.princetechn.com/api/download/tiktokdlv3?apikey=prince&url=${encodeURIComponent(url)}`,
                `https://api.princetechn.com/api/download/tiktokdlv4?apikey=prince&url=${encodeURIComponent(url)}`,
                `https://api.dreaded.site/api/tiktok?url=${encodeURIComponent(url)}`
            ];

            let videoUrl = null;
            let audioUrl = null;
            let title = null;

            for (const apiUrl of apis) {
                try {
                    const response = await axios.get(apiUrl, { timeout: 10000 });
                    if (response.data) {
                        if (response.data.result && response.data.result.videoUrl) {
                            videoUrl = response.data.result.videoUrl;
                            audioUrl = response.data.result.audioUrl;
                            title = response.data.result.title;
                            break;
                        } else if (response.data.tiktok && response.data.tiktok.video) {
                            videoUrl = response.data.tiktok.video;
                            break;
                        } else if (response.data.video) {
                            videoUrl = response.data.video;
                            break;
                        }
                    }
                } catch {
                    continue;
                }
            }

            if (!videoUrl) {
                let downloadData = await ttdl(url);
                if (downloadData && downloadData.data && downloadData.data.length > 0) {
                    for (let media of downloadData.data.slice(0, 5)) {
                        const mediaUrl = media.url;
                        const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || media.type === 'video';

                        if (isVideo) {
                            await sock.sendMessage(chatId, {
                                video: { url: mediaUrl },
                                mimetype: "video/mp4",
                                caption: "✅ Video TikTok berhasil diunduh!\n\n_Downloaded by Artoria Bot_"
                            }, { quoted: message });
                        } else {
                            await sock.sendMessage(chatId, {
                                image: { url: mediaUrl },
                                caption: "✅ Gambar TikTok berhasil diunduh!\n\n_Downloaded by Artoria Bot_"
                            }, { quoted: message });
                        }
                    }
                    return;
                }
            }

            if (videoUrl) {
                try {
                    const videoResponse = await axios.get(videoUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });

                    const videoBuffer = Buffer.from(videoResponse.data);
                    const caption = title
                        ? `✅ Video TikTok berhasil diunduh!\n\n📝 Judul: ${title}\n\n_Downloaded by Artoria Bot_`
                        : "✅ Video TikTok berhasil diunduh!\n\n_Downloaded by Artoria Bot_";

                    await sock.sendMessage(chatId, {
                        video: videoBuffer,
                        mimetype: "video/mp4",
                        caption
                    }, { quoted: message });

                    if (audioUrl) {
                        const audioResponse = await axios.get(audioUrl, {
                            responseType: 'arraybuffer',
                            timeout: 30000
                        });
                        const audioBuffer = Buffer.from(audioResponse.data);
                        await sock.sendMessage(chatId, {
                            audio: audioBuffer,
                            mimetype: "audio/mp3",
                            caption: "🎵 Audio dari TikTok\n\n_Downloaded by Artoria Bot_"
                        }, { quoted: message });
                    }
                    return;
                } catch {
                    await sock.sendMessage(chatId, {
                        video: { url: videoUrl },
                        mimetype: "video/mp4",
                        caption: "✅ Video TikTok berhasil diunduh!\n\n_Downloaded by Artoria Bot_"
                    }, { quoted: message });
                    return;
                }
            }

            return await sock.sendMessage(chatId, {
                text: "❌ Gagal mengunduh video TikTok. Semua metode gagal. Coba lagi dengan link lain."
            }, { quoted: message });

        } catch (error) {
            console.error('Error TikTok API:', error);
            await sock.sendMessage(chatId, {
                text: "❌ Terjadi error saat download TikTok. Coba lagi nanti."
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error TikTok command:', error);
        await sock.sendMessage(chatId, {
            text: "❌ Ada error di sistem. Coba lagi nanti."
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
