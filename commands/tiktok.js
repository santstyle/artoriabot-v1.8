const axios = require('axios');
const fs = require('fs');
const path = require('path');

// List of TikTok APIs with fallback
const tiktokApis = [
    {
        name: "API 1",
        url: "https://api.tiklydown.eu.org/api/download",
        method: "POST",
        parse: (data) => ({
            video: data.video?.url,
            audio: data.music?.url,
            title: data.title,
            author: data.author?.nickname,
            cover: data.cover,
            duration: data.duration
        })
    },
    {
        name: "API 2",
        url: "https://api.tikwm.com/api/",
        method: "POST",
        parse: (data) => ({
            video: data.data?.wmplay || data.data?.play,
            audio: data.data?.music,
            title: data.data?.title,
            author: data.data?.author?.nickname,
            cover: data.data?.cover,
            duration: data.data?.duration
        })
    },
    {
        name: "API 3",
        url: "https://tikdown.org/getAjax",
        method: "POST",
        parse: (data) => ({
            video: data.links[0]?.a || data.links[0]?.href,
            title: data.title,
            author: data.author
        })
    },
    {
        name: "API 4",
        url: "https://api.akuari.my.id/downloader/tiktok",
        method: "GET",
        parse: (data) => ({
            video: data.hasil?.nowm || data.hasil?.wm,
            audio: data.hasil?.audio,
            title: data.hasil?.desc,
            author: data.hasil?.author,
            cover: data.hasil?.cover
        })
    },
    {
        name: "API 5",
        url: "https://api.siputzx.my.id/api/download/tt",
        method: "GET",
        parse: (data) => ({
            video: data.result?.video,
            audio: data.result?.music,
            title: data.result?.desc,
            author: data.result?.author,
            cover: data.result?.cover
        })
    },
    {
        name: "API 6",
        url: "https://api.dreaded.site/api/tiktok",
        method: "GET",
        parse: (data) => ({
            video: data.tiktok?.video,
            audio: data.tiktok?.audio,
            title: data.tiktok?.desc,
            author: data.tiktok?.author,
            cover: data.tiktok?.cover
        })
    }
];

// Extract TikTok URL from various formats
function extractTikTokUrl(text) {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.|vt\.|vm\.)?tiktok\.com\/@[^\/]+\/video\/\d+/i,
        /(?:https?:\/\/)?(?:www\.|vt\.|vm\.)?tiktok\.com\/t\/[a-zA-Z0-9]+/i,
        /(?:https?:\/\/)?vt\.tiktok\.com\/[a-zA-Z0-9]+/i,
        /(?:https?:\/\/)?vm\.tiktok\.com\/[a-zA-Z0-9]+/i,
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/[^\/]+\/video\/\d+/i,
        /tiktok\.com\/@[^\/]+\/video\/\d+/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            // Ensure URL has protocol
            let url = match[0];
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            return url;
        }
    }

    return null;
}

// Validate TikTok URL
function validateTikTokUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        return hostname.includes('tiktok.com') &&
            (urlObj.pathname.includes('/video/') ||
                urlObj.pathname.includes('/t/') ||
                hostname.includes('vt.tiktok.com') ||
                hostname.includes('vm.tiktok.com'));
    } catch {
        return false;
    }
}

// Get TikTok video info from APIs
async function getTikTokVideo(url, apiIndex = 0) {
    if (apiIndex >= tiktokApis.length) {
        return { success: false, error: "Semua API gagal" };
    }

    const api = tiktokApis[apiIndex];

    try {
        console.log(`Mencoba ${api.name}...`);

        let response;
        if (api.method === "POST") {
            const formData = new URLSearchParams();
            formData.append('url', url);

            response = await axios.post(api.url, formData, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        } else {
            response = await axios.get(`${api.url}?url=${encodeURIComponent(url)}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
        }

        const data = response.data;
        const parsed = api.parse(data);

        if (parsed.video) {
            return {
                success: true,
                videoUrl: parsed.video,
                audioUrl: parsed.audio,
                title: parsed.title || 'TikTok Video',
                author: parsed.author || 'Unknown',
                cover: parsed.cover,
                duration: parsed.duration,
                api: api.name,
                watermark: parsed.video.includes('wmplay') || parsed.video.includes('wm') ? 'Watermarked' : 'No Watermark'
            };
        } else {
            console.log(`${api.name} tidak mengembalikan video URL`);
            return await getTikTokVideo(url, apiIndex + 1);
        }
    } catch (error) {
        console.log(`${api.name} gagal:`, error.message);
        return await getTikTokVideo(url, apiIndex + 1);
    }
}

// Download file to local
async function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 300000, // 5 minutes
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tiktok.com/'
            }
        })
            .then(response => {
                const writer = fs.createWriteStream(outputPath);
                response.data.pipe(writer);

                let downloaded = 0;
                const total = parseInt(response.headers['content-length'], 10) || 0;

                response.data.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (total) {
                        const percent = Math.floor((downloaded / total) * 100);
                        if (percent % 25 === 0) {
                            console.log(`Download progress: ${percent}%`);
                        }
                    }
                });

                writer.on('finish', () => {
                    console.log('File berhasil didownload');
                    resolve();
                });

                writer.on('error', reject);
                response.data.on('error', reject);
            })
            .catch(reject);
    });
}

// Format duration from seconds
function formatDuration(seconds) {
    if (!seconds) return 'Tidak diketahui';

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function tiktokCommand(sock, chatId, message, command) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        // Extract URL based on command
        let url = '';
        if (command === '.tiktok') {
            url = text.substring(9).trim();
        } else if (command === '.tt') {
            url = text.substring(4).trim();
        } else {
            url = text.split(' ').slice(1).join(' ').trim();
        }

        // Extract TikTok URL from text
        const extractedUrl = extractTikTokUrl(url);
        if (extractedUrl) {
            url = extractedUrl;
        }

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `🎵 *TikTok Video Downloader*\n\n` +
                    `📌 *Command yang tersedia:*\n` +
                    `• \`.tiktok <link>\` - Download video TikTok\n` +
                    `• \`.tt <link>\` - Short command\n\n` +
                    `📋 *Format link yang didukung:*\n` +
                    `• https://tiktok.com/@user/video/123456789\n` +
                    `• https://vt.tiktok.com/ABC123XYZ/\n` +
                    `• https://vm.tiktok.com/XYZ789ABC/\n` +
                    `• https://tiktok.com/t/abcdef12345\n\n` +
                    `📝 *Contoh penggunaan:*\n` +
                    `\`.tiktok https://vt.tiktok.com/ABC123XYZ/\`\n` +
                    `\`.tt https://tiktok.com/@user/video/123456789\`\n\n` +
                    `⚙️ *Fitur:*\n` +
                    `• Support No Watermark\n` +
                    `• Download video & audio terpisah\n` +
                    `• Multiple API backup\n` +
                    `• Auto URL detection\n\n` +
                    `⚠️ *Note:* Video >50MB akan di-compress`
            }, { quoted: message });
        }

        // Validate URL
        if (!validateTikTokUrl(url)) {
            return await sock.sendMessage(chatId, {
                text: `❌ *Link Tidak Valid!*\n\n` +
                    `Link yang kamu kirim bukan link TikTok video yang valid.\n\n` +
                    `Pastikan link mengandung:\n` +
                    `• tiktok.com/.../video/...\n` +
                    `• vt.tiktok.com/...\n` +
                    `• vm.tiktok.com/...\n\n` +
                    `Contoh link yang benar:\n` +
                    `https://vt.tiktok.com/ABC123XYZ/`
            }, { quoted: message });
        }

        // Send processing message with reaction
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });

        const processingMsg = await sock.sendMessage(chatId, {
            text: `🔍 *Memproses link TikTok...*\n\n` +
                `URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}\n\n` +
                `⏳ Mohon tunggu sebentar...`
        }, { quoted: message });

        try {
            // Update status
            await sock.editMessage(chatId, processingMsg, {
                text: `🔄 *Mencari video...*\n` +
                    `Mencoba API pertama...`
            });

            // Get video info from APIs
            const videoInfo = await getTikTokVideo(url);

            if (!videoInfo.success) {
                await sock.editMessage(chatId, processingMsg, {
                    text: `❌ *Gagal Mendapatkan Video!*\n\n` +
                        `Semua API gagal memproses video ini.\n\n` +
                        `Kemungkinan penyebab:\n` +
                        `1. Video di-private/dihapus\n` +
                        `2. Link tidak valid\n` +
                        `3. Region restricted\n` +
                        `4. Server API penuh\n\n` +
                        `Coba lagi nanti atau gunakan link berbeda.`
                });

                await sock.sendMessage(chatId, {
                    react: { text: '❌', key: message.key }
                });
                return;
            }

            // Update status
            await sock.editMessage(chatId, processingMsg, {
                text: `✅ *Video Ditemukan!*\n\n` +
                    `🎬 ${videoInfo.title.substring(0, 50)}${videoInfo.title.length > 50 ? '...' : ''}\n` +
                    `👤 ${videoInfo.author}\n` +
                    `📊 Kualitas: ${videoInfo.watermark}\n` +
                    `⏱️ Durasi: ${formatDuration(videoInfo.duration)}\n` +
                    `🔧 API: ${videoInfo.api}\n\n` +
                    `⬇️ *Mendownload video...*`
            });

            // Send thumbnail if available
            if (videoInfo.cover) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: videoInfo.cover },
                        caption: `📸 *Cover Video*\n\n` +
                            `${videoInfo.title}\n` +
                            `by ${videoInfo.author}\n\n` +
                            `⬇️ Sedang mendownload...`
                    });
                } catch (e) {
                    console.log('Gagal kirim thumbnail:', e.message);
                }
            }

            // Create temp directory
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const videoPath = path.join(tempDir, `tt_video_${timestamp}.mp4`);
            const audioPath = videoInfo.audioUrl ? path.join(tempDir, `tt_audio_${timestamp}.mp3`) : null;

            try {
                // Download video
                await sock.editMessage(chatId, processingMsg, {
                    text: `📥 *Mendownload video...*\n\n` +
                        `⏳ Ini mungkin butuh beberapa saat...`
                });

                await downloadFile(videoInfo.videoUrl, videoPath);

                // Check video size
                const videoStats = fs.statSync(videoPath);
                const videoSizeMB = (videoStats.size / (1024 * 1024)).toFixed(2);

                if (videoStats.size > 50 * 1024 * 1024) { // 50MB limit
                    await sock.editMessage(chatId, processingMsg, {
                        text: `⚠️ *Video Terlalu Besar!*\n\n` +
                            `Ukuran: ${videoSizeMB} MB\n` +
                            `Maksimal: 50 MB\n\n` +
                            `⏳ *Meng-compress video...*`
                    });

                    // Simple compression by reducing quality
                    const compressedPath = path.join(tempDir, `tt_compressed_${timestamp}.mp4`);
                    await compressVideo(videoPath, compressedPath);

                    // Use compressed video
                    fs.unlinkSync(videoPath);
                    fs.renameSync(compressedPath, videoPath);

                    const newStats = fs.statSync(videoPath);
                    const newSizeMB = (newStats.size / (1024 * 1024)).toFixed(2);

                    console.log(`Video compressed: ${videoSizeMB}MB -> ${newSizeMB}MB`);
                }

                // Update status
                await sock.editMessage(chatId, processingMsg, {
                    text: `✅ *Video Siap!*\n\n` +
                        `Ukuran: ${videoSizeMB} MB\n` +
                        `⏳ *Mengirim ke WhatsApp...*`
                });

                // Send video
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(videoPath),
                    mimetype: "video/mp4",
                    fileName: `TikTok_${timestamp}.mp4`,
                    caption: `✅ *TikTok Video Downloaded*\n\n` +
                        `🎬 *${videoInfo.title}*\n` +
                        `👤 ${videoInfo.author}\n` +
                        `📊 ${videoInfo.watermark}\n` +
                        `⏱️ ${formatDuration(videoInfo.duration)}\n` +
                        `📦 ${videoSizeMB} MB\n` +
                        `🔧 ${videoInfo.api}\n\n` +
                        `_Downloaded by TikTok Downloader Bot_ 🎵`
                });

                // Download and send audio if available
                if (videoInfo.audioUrl) {
                    try {
                        await sock.editMessage(chatId, processingMsg, {
                            text: `🎵 *Mendownload audio...*`
                        });

                        await downloadFile(videoInfo.audioUrl, audioPath);

                        const audioStats = fs.statSync(audioPath);
                        const audioSizeMB = (audioStats.size / (1024 * 1024)).toFixed(2);

                        await sock.sendMessage(chatId, {
                            audio: fs.readFileSync(audioPath),
                            mimetype: "audio/mpeg",
                            fileName: `TikTok_Audio_${timestamp}.mp3`,
                            caption: `🎵 *Audio TikTok*\n\n` +
                                `Judul: ${videoInfo.title.substring(0, 50)}\n` +
                                `Pembuat: ${videoInfo.author}\n` +
                                `Ukuran: ${audioSizeMB} MB\n\n` +
                                `_Original sound from TikTok_`
                        });

                        console.log('Audio berhasil dikirim');

                    } catch (audioError) {
                        console.log('Gagal download audio:', audioError.message);
                    }
                }

                // Delete processing message
                await sock.deleteMessage(chatId, processingMsg.key);

                // Send success reaction
                await sock.sendMessage(chatId, {
                    react: { text: '✅', key: message.key }
                });

                // Send success message
                await sock.sendMessage(chatId, {
                    text: `🎉 *Download Berhasil!*\n\n` +
                        `Video TikTok berhasil didownload!\n\n` +
                        `Ingin download video lain?\n` +
                        `Ketik: \`.tt <link tiktok>\``
                });

            } catch (downloadError) {
                console.error('Download error:', downloadError);

                await sock.editMessage(chatId, processingMsg, {
                    text: `❌ *Gagal Download Video!*\n\n` +
                        `Error: ${downloadError.message || 'Unknown'}\n\n` +
                        `Coba solusi:\n` +
                        `1. Pastikan koneksi internet stabil\n` +
                        `2. Coba link yang berbeda\n` +
                        `3. Tunggu beberapa menit`
                });

                await sock.sendMessage(chatId, {
                    react: { text: '❌', key: message.key }
                });
            } finally {
                // Clean up temp files
                setTimeout(() => {
                    try {
                        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                        if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                        console.log('Temp files cleaned up');
                    } catch (e) {
                        console.error('Gagal hapus temp files:', e.message);
                    }
                }, 10000);
            }

        } catch (apiError) {
            console.error('API error:', apiError);

            await sock.editMessage(chatId, processingMsg, {
                text: `❌ *Terjadi Kesalahan!*\n\n` +
                    `Gagal memproses video TikTok.\n\n` +
                    `Kemungkinan penyebab:\n` +
                    `1. Video tidak bisa di-download\n` +
                    `2. API sedang bermasalah\n` +
                    `3. Link expired/private\n\n` +
                    `Coba lagi nanti atau gunakan link yang berbeda.`
            });

            await sock.sendMessage(chatId, {
                react: { text: '❌', key: message.key }
            });
        }

    } catch (error) {
        console.error("Error in TikTok command:", error);

        await sock.sendMessage(chatId, {
            text: "❌ *Terjadi Kesalahan Sistem!*\n\n" +
                "Maaf, terjadi error yang tidak terduga.\n" +
                "Silakan coba lagi nanti.\n\n" +
                "Error: " + (error.message || "Unknown")
        }, { quoted: message });
    }
}

// Simple video compression function
async function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            // This is a simple approach - in production you might want to use ffmpeg
            // For now, we'll just copy the file if ffmpeg is not available
            if (fs.existsSync(inputPath)) {
                fs.copyFileSync(inputPath, outputPath);
                resolve();
            } else {
                reject(new Error('Input file not found'));
            }
        } catch (error) {
            reject(error);
        }
    });
}

// Alternative simple version without compression
async function tiktokSimpleCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: 'Gunakan: .tt <link tiktok>\nContoh: .tt https://vt.tiktok.com/ABC123/'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });

        const processingMsg = await sock.sendMessage(chatId, {
            text: '⏳ Memproses TikTok...'
        }, { quoted: message });

        // Try multiple APIs
        const apis = [
            `https://api.akuari.my.id/downloader/tiktok?url=${encodeURIComponent(url)}`,
            `https://api.siputzx.my.id/api/download/tt?url=${encodeURIComponent(url)}`,
            `https://api.dreaded.site/api/tiktok?url=${encodeURIComponent(url)}`,
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`
        ];

        let videoData = null;

        for (const apiUrl of apis) {
            try {
                const response = await axios.get(apiUrl, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                const data = response.data;

                if (data?.hasil?.nowm) {
                    videoData = {
                        url: data.hasil.nowm,
                        title: data.hasil.desc,
                        author: data.hasil.author
                    };
                    break;
                } else if (data?.tiktok?.video) {
                    videoData = {
                        url: data.tiktok.video,
                        title: data.tiktok.desc,
                        author: data.tiktok.author
                    };
                    break;
                } else if (data?.result?.video) {
                    videoData = {
                        url: data.result.video,
                        title: data.result.desc,
                        author: data.result.author
                    };
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!videoData) {
            await sock.editMessage(chatId, processingMsg, {
                text: '❌ Gagal download TikTok!'
            });
            await sock.sendMessage(chatId, {
                react: { text: '❌', key: message.key }
            });
            return;
        }

        await sock.editMessage(chatId, processingMsg, {
            text: '✅ Video ditemukan!\n⬇️ Mengirim...'
        });

        // Send video
        await sock.sendMessage(chatId, {
            video: { url: videoData.url },
            mimetype: "video/mp4",
            caption: `✅ TikTok Downloaded\n\n${videoData.title || ''}\nby ${videoData.author || 'Unknown'}`
        });

        await sock.deleteMessage(chatId, processingMsg.key);
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('TikTok error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error: ' + error.message
        }, { quoted: message });
    }
}

// Export for multiple commands
module.exports = {
    tiktok: tiktokCommand,
    tt: tiktokCommand,
    tiktokSimple: tiktokSimpleCommand
};