const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// List of reliable audio download APIs
const songApis = [
    {
        name: "SaveTube",
        url: "https://apis-keith.vercel.app/download/dlmp3",
        method: "GET",
        parse: (data) => data.result?.downloadUrl,
        getTitle: (data) => data.result?.title,
        getArtist: (data) => data.result?.artist || "Unknown Artist"
    },
    {
        name: "Akuari",
        url: "https://api.akuari.my.id/downloader/youtube",
        method: "GET",
        parse: (data) => data.hasil?.audio,
        getTitle: (data) => data.hasil?.title,
        getArtist: (data) => data.hasil?.author || "Unknown Artist"
    },
    {
        name: "Siputzx",
        url: "https://api.siputzx.my.id/api/download/ytmp3",
        method: "GET",
        parse: (data) => data.result?.audio,
        getTitle: (data) => data.result?.title,
        getArtist: (data) => data.result?.artist || "Unknown Artist"
    },
    {
        name: "Dreaded",
        url: "https://api.dreaded.site/api/youtube-mp3",
        method: "GET",
        parse: (data) => data.audio,
        getTitle: (data) => data.title,
        getArtist: (data) => data.artist || "Unknown Artist"
    },
    {
        name: "DL-Lagu",
        url: "https://api.download-lagu.net/download",
        method: "GET",
        parse: (data) => data.url,
        getTitle: (data) => data.title,
        getArtist: (data) => data.artist || "Unknown Artist"
    },
    {
        name: "Rentry",
        url: "https://api.rentry.co/api/youtube-mp3",
        method: "GET",
        parse: (data) => data.url,
        getTitle: (data) => data.title,
        getArtist: (data) => data.author || "Unknown Artist"
    }
];

// Get song info from APIs with fallback
async function getSongFromAPI(youtubeUrl, apiIndex = 0) {
    if (apiIndex >= songApis.length) {
        return { success: false, error: "Semua API gagal" };
    }

    const api = songApis[apiIndex];

    try {
        console.log(`Mencoba API ${api.name}...`);

        const response = await axios.get(`${api.url}?url=${encodeURIComponent(youtubeUrl)}`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;
        const audioUrl = api.parse(data);

        if (audioUrl) {
            return {
                success: true,
                url: audioUrl,
                title: api.getTitle(data) || 'Unknown Song',
                artist: api.getArtist(data),
                duration: data.duration || data.result?.duration,
                quality: data.quality || '128kbps',
                api: api.name
            };
        } else {
            console.log(`API ${api.name} tidak mengembalikan audio URL`);
            return await getSongFromAPI(youtubeUrl, apiIndex + 1);
        }
    } catch (error) {
        console.log(`API ${api.name} gagal:`, error.message);
        return await getSongFromAPI(youtubeUrl, apiIndex + 1);
    }
}

// Get YouTube video info
async function getYouTubeInfo(query) {
    try {
        // Check if it's already a YouTube URL
        if (query.match(/(youtube\.com|youtu\.be)/i)) {
            const videoUrl = query;
            const { videos } = await yts(videoUrl);

            if (videos && videos.length > 0) {
                return {
                    url: videos[0].url,
                    title: videos[0].title,
                    artist: videos[0].author?.name || 'Unknown Artist',
                    duration: videos[0].seconds,
                    thumbnail: videos[0].thumbnail,
                    views: videos[0].views
                };
            }

            // If direct URL search fails, use the URL directly
            return {
                url: videoUrl,
                title: 'YouTube Audio',
                artist: 'Unknown Artist',
                duration: null,
                thumbnail: null
            };
        } else {
            // Search for the song
            const { videos } = await yts(query);

            if (!videos || videos.length === 0) {
                throw new Error('Song not found on YouTube');
            }

            const video = videos[0];

            // Check if it's a music video (prefer shorter videos for songs)
            const preferredVideos = videos.filter(v => v.seconds <= 600); // Prefer videos under 10 minutes

            const selectedVideo = preferredVideos.length > 0 ? preferredVideos[0] : video;

            return {
                url: selectedVideo.url,
                title: selectedVideo.title,
                artist: selectedVideo.author?.name || 'Unknown Artist',
                duration: selectedVideo.seconds,
                thumbnail: selectedVideo.thumbnail,
                views: selectedVideo.views,
                timestamp: selectedVideo.timestamp
            };
        }
    } catch (error) {
        throw new Error(`Failed to get YouTube info: ${error.message}`);
    }
}

// Clean filename for safe saving
function cleanFileName(text) {
    return text
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
}

// Format duration
function formatDuration(seconds) {
    if (!seconds) return 'Unknown';

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Download file locally (fallback method)
async function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 300000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.youtube.com/'
            }
        })
            .then(response => {
                const writer = fs.createWriteStream(outputPath);
                response.data.pipe(writer);

                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            })
            .catch(reject);
    });
}

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        const searchQuery = text.replace('.song ', '').replace('.music ', '').replace('.play ', '').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: `🎵 *Music Downloader*\n\n` +
                    `*Command:*\n` +
                    `.song <judul/artis>\n` +
                    `.music <judul/artis>\n` +
                    `.play <judul/artis>\n\n` +
                    `*Contoh:*\n` +
                    `.song Alan Walker Faded\n` +
                    `.music Coldplay - Paradise\n` +
                    `.play https://youtu.be/...\n\n` +
                    `*Fitur:*\n` +
                    `• MP3 format\n` +
                    `• 128-320kbps quality\n` +
                    `• Auto artist detection\n` +
                    `• Multiple API backup`
            }, { quoted: message });
        }

        // Send processing message
        const processingMsg = await sock.sendMessage(chatId, {
            text: `🔍 *Mencari lagu...*\n\n` +
                `"${searchQuery.substring(0, 50)}${searchQuery.length > 50 ? '...' : ''}"\n\n` +
                `⏳ Mohon tunggu sebentar...`
        }, { quoted: message });

        try {
            // Get YouTube video info
            await sock.sendMessage(chatId, { delete: processingMsg.key });
            const processingMsg2 = await sock.sendMessage(chatId, {
                text: `🔍 *Mencari di YouTube...*\n\n` +
                    `Mencari lagu terbaik...`
            }, { quoted: message });

            const videoInfo = await getYouTubeInfo(searchQuery);

            // Check duration (avoid downloading full concerts)
            if (videoInfo.duration && videoInfo.duration > 1800) { // 30 minutes
                await sock.sendMessage(chatId, { delete: processingMsg2.key });
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Durasi Terlalu Panjang!*\n\n` +
                        `"${videoInfo.title}"\n\n` +
                        `⏱️ Durasi: ${formatDuration(videoInfo.duration)}\n` +
                        `📏 Maksimal: 30 menit\n\n` +
                        `Ini mungkin bukan lagu single.\n` +
                        `Coba cari versi yang lebih pendek.`
                }, { quoted: message });
                return;
            }

            // Show found song info
            await sock.sendMessage(chatId, { delete: processingMsg2.key });
            const processingMsg3 = await sock.sendMessage(chatId, {
                text: `✅ *Lagu Ditemukan!*\n\n` +
                    `🎵 *${videoInfo.title}*\n` +
                    `👤 ${videoInfo.artist}\n` +
                    `⏱️ ${formatDuration(videoInfo.duration)}\n` +
                    `👁️ ${videoInfo.views ? videoInfo.views.toLocaleString() + ' views' : ''}\n\n` +
                    `⬇️ *Mencari sumber audio...*`
            }, { quoted: message });

            // Send thumbnail if available
            if (videoInfo.thumbnail) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: videoInfo.thumbnail },
                        caption: `📸 *Album Art*\n\n` +
                            `${videoInfo.title}\n` +
                            `by ${videoInfo.artist}\n\n` +
                            `⬇️ Sedang diproses...`
                    });
                } catch (e) {
                    console.log('Gagal kirim thumbnail:', e.message);
                }
            }

            // Get audio from APIs
            await sock.sendMessage(chatId, { delete: processingMsg3.key });
            const processingMsg4 = await sock.sendMessage(chatId, {
                text: `🔄 *Mendownload audio...*\n\n` +
                    `Mencoba API pertama...`
            }, { quoted: message });

            const audioData = await getSongFromAPI(videoInfo.url);

            if (!audioData.success) {
                await sock.sendMessage(chatId, { delete: processingMsg4.key });
                await sock.sendMessage(chatId, {
                    text: `❌ *Gagal Mendapatkan Audio!*\n\n` +
                        `Semua API gagal.\n\n` +
                        `Coba:\n` +
                        `1. Judul lagu yang berbeda\n` +
                        `2. Link YouTube langsung\n` +
                        `3. Tunggu beberapa menit`
                }, { quoted: message });
                return;
            }

            // Update status
            await sock.sendMessage(chatId, { delete: processingMsg4.key });
            const processingMsg5 = await sock.sendMessage(chatId, {
                text: `📥 *Mendownload dari ${audioData.api}...*\n\n` +
                    `⏳ Mohon tunggu, ini mungkin butuh waktu...`
            }, { quoted: message });

            // Create temp directory
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const tempFile = path.join(tempDir, `song_${timestamp}.mp3`);

            try {
                // Download the audio file
                await downloadFile(audioData.url, tempFile);

                // Check file size
                const stats = fs.statSync(tempFile);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                if (stats.size === 0) {
                    throw new Error('File kosong (0 bytes)');
                }

                if (stats.size > 20 * 1024 * 1024) { // 20MB limit
                    await sock.editMessage(chatId, processingMsg, {
                        text: `⚠️ *File Terlalu Besar!*\n\n` +
                            `Ukuran: ${fileSizeMB} MB\n` +
                            `Maksimal: 20 MB\n\n` +
                            `Pilih lagu yang lebih pendek.`
                    });

                    fs.unlinkSync(tempFile);
                    return;
                }

                // Update status
                await sock.sendMessage(chatId, { delete: processingMsg5.key });
                await sock.sendMessage(chatId, {
                    text: `✅ *Audio Siap!*\n\n` +
                        `Ukuran: ${fileSizeMB} MB\n` +
                        `Kualitas: ${audioData.quality}\n` +
                        `⏳ *Mengirim ke WhatsApp...*`
                }, { quoted: message });

                // Send the audio file
                await sock.sendMessage(chatId, {
                    audio: fs.readFileSync(tempFile),
                    mimetype: "audio/mpeg",
                    fileName: `${cleanFileName(audioData.title)}.mp3`,
                    caption: `✅ *Download Berhasil!*\n\n` +
                        `🎵 *${audioData.title}*\n` +
                        `👤 ${audioData.artist}\n` +
                        `⏱️ ${formatDuration(audioData.duration || videoInfo.duration)}\n` +
                        `📦 ${fileSizeMB} MB\n` +
                        `🔧 ${audioData.api}\n` +
                        `🎧 ${audioData.quality}\n\n` +
                        `_Downloaded via Music Bot_ 🎶`
                });

                // Delete processing message
                await sock.deleteMessage(chatId, processingMsg.key);

                // Send success message
                await sock.sendMessage(chatId, {
                    text: `🎉 *Download Selesai!*\n\n` +
                        `Lagu berhasil didownload!\n\n` +
                        `Ingin download lagu lain?\n` +
                        `Ketik: \`.song <judul lagu>\``
                });

            } catch (downloadError) {
                console.error('Download error:', downloadError);

                await sock.sendMessage(chatId, { delete: processingMsg5.key });
                await sock.sendMessage(chatId, {
                    text: `❌ *Gagal Download File!*\n\n` +
                        `Error: ${downloadError.message}\n\n` +
                        `Coba lagi nanti atau gunakan judul berbeda.`
                }, { quoted: message });
            } finally {
                // Clean up temp file
                setTimeout(() => {
                    try {
                        if (fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                            console.log('Temp file cleaned');
                        }
                    } catch (e) {
                        console.error('Gagal hapus temp file:', e.message);
                    }
                }, 10000);
            }
        } catch (infoError) {
            console.error('Info error:', infoError);

            await sock.sendMessage(chatId, { delete: processingMsg.key });
            await sock.sendMessage(chatId, {
                text: `❌ *Gagal Mencari Lagu!*\n\n` +
                    `"${searchQuery}" tidak ditemukan.\n\n` +
                    `Coba:\n` +
                    `1. Periksa penulisan judul\n` +
                    `2. Tambahkan nama artis\n` +
                    `3. Gunakan link YouTube langsung`
            }, { quoted: message });
        }

    } catch (error) {
        console.error("[SONG ERROR]:", error);

        await sock.sendMessage(chatId, {
            text: "❌ *Terjadi Kesalahan Sistem!*\n\n" +
                "Maaf, terjadi error yang tidak terduga.\n" +
                "Silakan coba lagi nanti.\n\n" +
                "Error: " + (error.message || "Unknown")
        }, { quoted: message });
    }
}

// Quick and simple version for small bots
async function songSimpleCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Song Downloader*\n\n' +
                    'Gunakan: .song <judul lagu>\n' +
                    'Contoh: .song Alan Walker Faded\n\n' +
                    'Atau link YouTube: .song https://youtu.be/...'
            }, { quoted: message });
        }

        // Send initial message
        const processingMsg = await sock.sendMessage(chatId, {
            text: '⏳ Mencari lagu...'
        }, { quoted: message });

        let youtubeUrl;
        let videoTitle;
        let artistName;

        // Check if input is a URL
        if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
            youtubeUrl = searchQuery;
            videoTitle = 'YouTube Audio';
            artistName = 'Unknown Artist';
        } else {
            // Search on YouTube
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.editMessage(chatId, processingMsg, {
                    text: '❌ Lagu tidak ditemukan!'
                });
                return;
            }

            const video = videos[0];
            youtubeUrl = video.url;
            videoTitle = video.title;
            artistName = video.author?.name || 'Unknown Artist';

            await sock.editMessage(chatId, processingMsg, {
                text: `✅ ${videoTitle}\nby ${artistName}\n⬇️ Mendownload...`
            });
        }

        // Try multiple APIs quickly
        const apis = [
            `https://api.akuari.my.id/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}`,
            `https://api.siputzx.my.id/api/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
            `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(youtubeUrl)}`
        ];

        for (const apiUrl of apis) {
            try {
                const response = await axios.get(apiUrl, { timeout: 10000 });
                const data = response.data;

                let audioUrl = null;

                if (data?.hasil?.audio) {
                    audioUrl = data.hasil.audio;
                } else if (data?.result?.downloadUrl) {
                    audioUrl = data.result.downloadUrl;
                } else if (data?.result?.audio) {
                    audioUrl = data.result.audio;
                }

                if (audioUrl) {
                    await sock.sendMessage(chatId, {
                        audio: { url: audioUrl },
                        mimetype: "audio/mpeg",
                        fileName: `${videoTitle.replace(/[^\w\s.-]/gi, '')}.mp3`,
                        caption: `✅ ${videoTitle}\nby ${artistName}`
                    });

                    await sock.deleteMessage(chatId, processingMsg.key);
                    return;
                }
            } catch (e) {
                continue;
            }
        }

        // If all APIs fail
        await sock.editMessage(chatId, processingMsg, {
            text: '❌ Gagal download audio! Coba lagi.'
        });

    } catch (error) {
        console.error('Simple song error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error! Coba lagi nanti.'
        }, { quoted: message });
    }
}

// Export both versions
module.exports = {
    song: songCommand,
    music: songCommand,
    play: songCommand,
    songSimple: songSimpleCommand
};