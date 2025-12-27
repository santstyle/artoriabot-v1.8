const yts = require('yt-search');
const axios = require('axios');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// API list untuk download audio
const audioApis = [
    {
        name: "API 1",
        url: "https://apis-keith.vercel.app/download/dlmp3",
        method: "GET",
        parse: (data) => data.result?.downloadUrl || data.downloadUrl,
        getTitle: (data) => data.result?.title || data.title
    },
    {
        name: "API 2",
        url: "https://api.akuari.my.id/downloader/youtube",
        method: "GET",
        parse: (data) => data.hasil?.audio,
        getTitle: (data) => data.hasil?.title
    },
    {
        name: "API 3",
        url: "https://api.siputzx.my.id/api/download/ytmp3",
        method: "GET",
        parse: (data) => data.result?.audio,
        getTitle: (data) => data.result?.title
    },
    {
        name: "API 4",
        url: "https://api.dreaded.site/api/youtube-mp3",
        method: "GET",
        parse: (data) => data.audio,
        getTitle: (data) => data.title
    },
    {
        name: "API 5",
        url: "https://api.download-lagu.net/download",
        method: "GET",
        parse: (data) => data.url,
        getTitle: (data) => data.title
    }
];

// Format duration
function formatDuration(seconds) {
    if (!seconds) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Clean filename
function cleanFileName(title) {
    return title
        .replace(/[^\w\s.-]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
}

// Get audio from API
async function getAudioFromAPI(youtubeUrl, apiIndex = 0) {
    if (apiIndex >= audioApis.length) {
        return { success: false, error: "All APIs failed" };
    }

    const api = audioApis[apiIndex];

    try {
        console.log(`Trying audio API ${api.name}...`);

        let response;
        if (api.method === "POST") {
            response = await axios.post(api.url, { url: youtubeUrl }, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
        } else {
            response = await axios.get(`${api.url}?url=${encodeURIComponent(youtubeUrl)}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
        }

        const data = response.data;
        const audioUrl = api.parse(data);
        const title = api.getTitle(data);

        if (audioUrl) {
            return {
                success: true,
                url: audioUrl,
                title: title || 'Audio',
                api: api.name,
                duration: data.duration || data.result?.duration
            };
        } else {
            console.log(`API ${api.name} returned no audio URL`);
            return await getAudioFromAPI(youtubeUrl, apiIndex + 1);
        }
    } catch (error) {
        console.log(`API ${api.name} failed:`, error.message);
        return await getAudioFromAPI(youtubeUrl, apiIndex + 1);
    }
}

// Download audio using ytdl-core (fallback method)
async function downloadAudioWithYTDL(youtubeUrl, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const audioStream = ytdl(youtubeUrl, {
                quality: 'highestaudio',
                filter: 'audioonly'
            });

            const writeStream = fs.createWriteStream(outputPath);

            audioStream.pipe(writeStream);

            writeStream.on('finish', () => {
                console.log('Audio downloaded with YTDL');
                resolve();
            });

            audioStream.on('error', reject);
            writeStream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

// Convert to MP3 using ffmpeg
async function convertToMP3(inputPath, outputPath) {
    try {
        await execPromise(`ffmpeg -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}" -y`);
        return true;
    } catch (error) {
        console.error('FFmpeg conversion failed:', error.message);
        return false;
    }
}

async function playCommand(sock, chatId, message, command) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        // Extract search query based on command
        let searchQuery = '';
        if (command === '.play') {
            searchQuery = text.substring(6).trim();
        } else if (command === '.song') {
            searchQuery = text.substring(6).trim();
        } else if (command === '.music') {
            searchQuery = text.substring(7).trim();
        } else {
            searchQuery = text.split(' ').slice(1).join(' ').trim();
        }

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: `🎵 *Music Downloader*\n\n` +
                    `📌 *Command yang tersedia:*\n` +
                    `• \`.play <judul lagu>\` - Download lagu\n` +
                    `• \`.song <judul lagu>\` - Alternatif command\n` +
                    `• \`.music <judul lagu>\` - Alternatif command\n\n` +
                    `📋 *Cara penggunaan:*\n` +
                    `1. Search by title:\n` +
                    `   \`.play Alan Walker Faded\`\n` +
                    `   \`.song Coldplay Paradise\`\n` +
                    `   \`.music Adele Hello\`\n\n` +
                    `2. Search with artist:\n` +
                    `   \`.play Bruno Mars - That's What I Like\`\n` +
                    `   \`.song Ed Sheeran Shape of You\`\n\n` +
                    `3. YouTube URL:\n` +
                    `   \`.play https://youtu.be/...\`\n` +
                    `   \`.song https://youtube.com/...\`\n\n` +
                    `⚙️ *Spesifikasi:*\n` +
                    `• Format: MP3\n` +
                    `• Kualitas: 192kbps\n` +
                    `• Durasi maks: 15 menit\n` +
                    `• Ukuran maks: 20MB\n\n` +
                    `🎧 *Proses:*\n` +
                    `1. Mencari lagu di YouTube\n` +
                    `2. Mendownload audio\n` +
                    `3. Mengirim ke WhatsApp`
            }, { quoted: message });
        }

        // Send processing message
        const processingMsg = await sock.sendMessage(chatId, {
            text: `🔍 *Mencari lagu...*\n\n` +
                `Kata kunci: "${searchQuery.substring(0, 50)}${searchQuery.length > 50 ? '...' : ''}"\n\n` +
                `⏳ Mohon tunggu...`
        }, { quoted: message });

        let youtubeUrl = '';
        let videoInfo = null;
        let isDirectUrl = false;

        // Check if input is YouTube URL
        if (searchQuery.match(/(youtube\.com|youtu\.be)/i)) {
            youtubeUrl = searchQuery;
            isDirectUrl = true;

            try {
                const info = await ytdl.getInfo(youtubeUrl);
                videoInfo = {
                    title: info.videoDetails.title,
                    duration: info.videoDetails.lengthSeconds,
                    author: info.videoDetails.author.name,
                    thumbnail: info.videoDetails.thumbnails[0]?.url
                };
            } catch (error) {
                await sock.editMessage(chatId, processingMsg, {
                    text: `❌ *Link Tidak Valid!*\n\n` +
                        `Link YouTube tidak valid atau tidak bisa diakses.\n` +
                        `Pastikan link benar dan video tersedia.`
                });
                return;
            }
        } else {
            // Search for video on YouTube
            try {
                await sock.editMessage(chatId, processingMsg, {
                    text: `🔍 *Mencari di YouTube...*\n\n` +
                        `"${searchQuery}"\n\n` +
                        `⏳ Menunggu hasil...`
                });

                const searchResult = await yts(searchQuery);
                if (!searchResult.videos || searchResult.videos.length === 0) {
                    await sock.editMessage(chatId, processingMsg, {
                        text: `❌ *Lagu Tidak Ditemukan!*\n\n` +
                            `Tidak ada hasil untuk: "${searchQuery}"\n\n` +
                            `Coba:\n` +
                            `1. Kata kunci yang berbeda\n` +
                            `2. Tambahkan nama artis\n` +
                            `3. Gunakan link YouTube langsung`
                    });
                    return;
                }

                // Get the first video
                const video = searchResult.videos[0];
                youtubeUrl = video.url;
                videoInfo = {
                    title: video.title,
                    duration: video.seconds,
                    author: video.author.name,
                    thumbnail: video.thumbnail,
                    views: video.views,
                    timestamp: video.timestamp
                };

                // Check duration (max 15 minutes)
                if (video.seconds > 900) { // 15 minutes
                    await sock.editMessage(chatId, processingMsg, {
                        text: `⚠️ *Durasi Terlalu Panjang!*\n\n` +
                            `"${video.title}"\n\n` +
                            `⏱️ Durasi: ${video.timestamp}\n` +
                            `📏 Maksimal: 15 menit\n\n` +
                            `Pilih lagu yang lebih pendek untuk kualitas terbaik.`
                    });
                    return;
                }

                // Show found song
                await sock.editMessage(chatId, processingMsg, {
                    text: `✅ *Lagu Ditemukan!*\n\n` +
                        `🎵 *${video.title}*\n` +
                        `👤 ${video.author.name}\n` +
                        `👁️ ${video.views.toLocaleString()} views\n` +
                        `⏱️ ${video.timestamp}\n\n` +
                        `⬇️ *Mendownload audio...*`
                });

            } catch (searchError) {
                console.error('Search error:', searchError);
                await sock.editMessage(chatId, processingMsg, {
                    text: `❌ *Gagal Mencari Lagu!*\n\n` +
                        `Error: ${searchError.message || 'Unknown'}\n\n` +
                        `Coba lagi nanti atau gunakan link YouTube langsung.`
                });
                return;
            }
        }

        // Create temp directory
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const tempAudio = path.join(tempDir, `audio_${timestamp}.mp3`);
        const tempM4a = path.join(tempDir, `temp_${timestamp}.m4a`);

        try {
            // Try to get audio from APIs first
            let audioData = null;

            if (!isDirectUrl || Math.random() > 0.5) { // Try API 50% of the time for direct URLs
                await sock.editMessage(chatId, processingMsg, {
                    text: `⬇️ *Mencari sumber audio...*\n\n` +
                        `Mencoba API pertama...`
                });

                audioData = await getAudioFromAPI(youtubeUrl);
            }

            if (audioData?.success) {
                // Download from API
                await sock.editMessage(chatId, processingMsg, {
                    text: `📥 *Mendownload dari API...*\n\n` +
                        `API: ${audioData.api}\n` +
                        `⏳ Mohon tunggu...`
                });

                await downloadFromAPI(audioData.url, tempAudio);

            } else {
                // Fallback to ytdl-core
                await sock.editMessage(chatId, processingMsg, {
                    text: `🔄 *Menggunakan metode alternatif...*\n\n` +
                        `⏳ Mendownload audio...`
                });

                try {
                    // Download audio with ytdl
                    await downloadAudioWithYTDL(youtubeUrl, tempM4a);

                    // Convert to MP3 if needed
                    if (tempM4a.endsWith('.m4a')) {
                        await sock.editMessage(chatId, processingMsg, {
                            text: `🔄 *Mengkonversi ke MP3...*\n\n` +
                                `⏳ Sedang memproses...`
                        });

                        const converted = await convertToMP3(tempM4a, tempAudio);
                        if (!converted) {
                            // If conversion fails, try to send as is
                            fs.renameSync(tempM4a, tempAudio);
                        }
                    }
                } catch (ytdlError) {
                    console.error('YTDL error:', ytdlError);
                    throw new Error('Gagal download dengan semua metode');
                }
            }

            // Check if file exists and has content
            if (!fs.existsSync(tempAudio) || fs.statSync(tempAudio).size === 0) {
                throw new Error('File audio kosong');
            }

            const fileSize = fs.statSync(tempAudio).size;
            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

            if (fileSize > 20 * 1024 * 1024) { // 20MB limit
                await sock.editMessage(chatId, processingMsg, {
                    text: `❌ *File Terlalu Besar!*\n\n` +
                        `Ukuran: ${fileSizeMB} MB\n` +
                        `Maksimal: 20 MB\n\n` +
                        `Pilih lagu yang lebih pendek.`
                });

                // Clean up
                [tempAudio, tempM4a].forEach(file => {
                    if (fs.existsSync(file)) fs.unlinkSync(file);
                });

                return;
            }

            // Update status
            await sock.editMessage(chatId, processingMsg, {
                text: `✅ *Audio Siap!*\n\n` +
                    `Ukuran: ${fileSizeMB} MB\n` +
                    `⏳ *Mengirim ke WhatsApp...*`
            });

            // Send thumbnail if available
            if (videoInfo.thumbnail) {
                try {
                    await sock.sendMessage(chatId, {
                        image: { url: videoInfo.thumbnail },
                        caption: `🎵 *${videoInfo.title}*\n\n` +
                            `by ${videoInfo.author}\n` +
                            `⏱️ ${formatDuration(videoInfo.duration)}\n\n` +
                            `⬇️ Sedang mengirim audio...`
                    });
                } catch (e) {
                    console.log('Failed to send thumbnail:', e.message);
                }
            }

            // Send audio file
            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(tempAudio),
                mimetype: "audio/mpeg",
                fileName: `${cleanFileName(videoInfo.title)}.mp3`,
                caption: `✅ *Download Berhasil!*\n\n` +
                    `🎵 *${videoInfo.title}*\n` +
                    `👤 ${videoInfo.author}\n` +
                    `⏱️ ${formatDuration(videoInfo.duration)}\n` +
                    `📦 ${fileSizeMB} MB\n` +
                    `🔧 ${audioData?.api || 'YTDL'}\n\n` +
                    `_Downloaded by Music Bot_ 🎧`
            });

            // Delete processing message
            await sock.deleteMessage(chatId, processingMsg.key);

            // Send success message
            await sock.sendMessage(chatId, {
                text: `🎉 *Download Selesai!*\n\n` +
                    `Lagu "${videoInfo.title.substring(0, 50)}${videoInfo.title.length > 50 ? '...' : ''}"\n` +
                    `berhasil didownload!\n\n` +
                    `Ingin download lagu lain?\n` +
                    `Ketik: \`.play <judul lagu>\``
            });

        } catch (downloadError) {
            console.error('Download error:', downloadError);

            await sock.editMessage(chatId, processingMsg, {
                text: `❌ *Gagal Download Audio!*\n\n` +
                    `Error: ${downloadError.message || 'Unknown'}\n\n` +
                    `Coba solusi:\n` +
                    `1. Cari lagu yang berbeda\n` +
                    `2. Gunakan link YouTube langsung\n` +
                    `3. Tunggu beberapa menit\n` +
                    `4. Cek koneksi internet`
            });
        } finally {
            // Clean up temp files
            setTimeout(() => {
                try {
                    if (fs.existsSync(tempAudio)) fs.unlinkSync(tempAudio);
                    if (fs.existsSync(tempM4a)) fs.unlinkSync(tempM4a);
                } catch (e) {
                    console.error('Failed to clean temp files:', e.message);
                }
            }, 10000);
        }

    } catch (error) {
        console.error('Error in play command:', error);

        await sock.sendMessage(chatId, {
            text: "❌ *Terjadi Kesalahan Sistem!*\n\n" +
                "Maaf, terjadi error yang tidak terduga.\n" +
                "Silakan coba lagi nanti.\n\n" +
                "Error: " + (error.message || "Unknown")
        }, { quoted: message });
    }
}

// Download from API
async function downloadFromAPI(url, outputPath) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 300000, // 5 minutes
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

// Simple version for quick use
async function playSimpleCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Music Downloader*\n\nGunakan: .play <judul lagu>\nContoh: .play Alan Walker Faded'
            }, { quoted: message });
        }

        // Send processing
        const processingMsg = await sock.sendMessage(chatId, {
            text: '⏳ Mencari lagu...'
        }, { quoted: message });

        // Search on YouTube
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            await sock.editMessage(chatId, processingMsg, {
                text: '❌ Lagu tidak ditemukan!'
            });
            return;
        }

        const video = videos[0];
        await sock.editMessage(chatId, processingMsg, {
            text: `✅ ${video.title}\n⬇️ Mendownload...`
        });

        // Try to get audio from simple API
        try {
            const response = await axios.get(`https://api.akuari.my.id/downloader/youtube?url=${encodeURIComponent(video.url)}`);
            const audioUrl = response.data?.hasil?.audio;

            if (audioUrl) {
                await sock.sendMessage(chatId, {
                    audio: { url: audioUrl },
                    mimetype: "audio/mpeg",
                    caption: `🎵 ${video.title}\nby ${video.author.name}`
                });
            } else {
                throw new Error('No audio URL');
            }
        } catch (apiError) {
            // Fallback: send YouTube URL as audio
            await sock.sendMessage(chatId, {
                audio: { url: `https://www.youtube.com/watch?v=${video.videoId}` },
                mimetype: "audio/mpeg",
                caption: `🎵 ${video.title}\nvia YouTube`
            });
        }

        await sock.deleteMessage(chatId, processingMsg.key);

    } catch (error) {
        console.error('Simple play error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Gagal download lagu!'
        }, { quoted: message });
    }
}

// Export for multiple commands
module.exports = {
    play: playCommand,
    song: playCommand,
    music: playCommand,
    playSimple: playSimpleCommand
};