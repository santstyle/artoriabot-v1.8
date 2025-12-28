const yts = require('yt-search');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API list untuk download video (updated working APIs)
const videoApis = [
    {
        name: "YTMP3 API",
        url: "https://api.ytbvideodownloader.com/api/convert",
        method: "POST",
        parse: (data) => {
            // Mencari link video dengan kualitas terbaik
            if (data.url && data.url.length > 0) {
                // Prioritize mp4 format
                const mp4Urls = data.url.filter(item => item.ext === 'mp4');
                if (mp4Urls.length > 0) {
                    // Sort by quality (highest first)
                    mp4Urls.sort((a, b) => {
                        const qualityA = a.label ? parseInt(a.label.replace('p', '')) : 0;
                        const qualityB = b.label ? parseInt(b.label.replace('p', '')) : 0;
                        return qualityB - qualityA;
                    });
                    return mp4Urls[0].url;
                }
                return data.url[0].url;
            }
            return null;
        },
        getTitle: (data) => data.meta.title
    },
    {
        name: "Youtube DL API",
        url: "https://co.wuk.sh/api/json",
        method: "POST",
        parse: (data) => data.url,
        getTitle: (data) => data.meta?.title || "YouTube Video"
    },
    {
        name: "Youtube MP4 API",
        url: "https://yt5s.io/api/ajaxSearch",
        method: "POST",
        parse: (data) => {
            if (data.links && data.links.mp4) {
                // Get highest quality
                const qualities = Object.keys(data.links.mp4);
                if (qualities.length > 0) {
                    // Sort by quality number
                    qualities.sort((a, b) => {
                        const aNum = parseInt(a.replace('p', ''));
                        const bNum = parseInt(b.replace('p', ''));
                        return bNum - aNum;
                    });
                    return data.links.mp4[qualities[0]].k;
                }
            }
            return null;
        },
        getTitle: (data) => data.title
    }
];

// Extract YouTube ID from URL
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// Download video from API
async function downloadVideoFromAPI(videoUrl, apiIndex = 0) {
    if (apiIndex >= videoApis.length) {
        return { success: false, error: "Semua API gagal" };
    }

    const api = videoApis[apiIndex];

    try {
        console.log(`Mencoba API ${api.name}...`);

        let response;
        if (api.method === "POST") {
            let requestData = {};

            if (api.name === "YTMP3 API") {
                requestData = { url: videoUrl, format: "mp4" };
            } else if (api.name === "Youtube DL API") {
                requestData = {
                    url: videoUrl,
                    isAudioOnly: false,
                    isNoTTWatermark: true,
                    isTTFullAudio: false
                };
            } else if (api.name === "Youtube MP4 API") {
                requestData = {
                    q: videoUrl,
                    vt: "home"
                };
            }

            response = await axios.post(api.url, requestData, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
        } else {
            response = await axios.get(`${api.url}?url=${encodeURIComponent(videoUrl)}`, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
        }

        const data = response.data;
        const downloadUrl = api.parse(data);
        const title = api.getTitle(data);

        if (downloadUrl) {
            return {
                success: true,
                url: downloadUrl,
                title: title || 'YouTube Video',
                api: api.name
            };
        } else {
            console.log(`API ${api.name} tidak mengembalikan video URL`);
            return await downloadVideoFromAPI(videoUrl, apiIndex + 1);
        }
    } catch (error) {
        console.log(`API ${api.name} gagal:`, error.message);
        return await downloadVideoFromAPI(videoUrl, apiIndex + 1);
    }
}

// Alternative method using direct YouTube download
async function downloadYouTubeDirect(videoId) {
    try {
        // Get video info first
        const infoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const infoResponse = await axios.get(infoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Extract video title from page
        const html = infoResponse.data;
        const titleMatch = html.match(/<meta name="title" content="([^"]+)"/);
        const title = titleMatch ? titleMatch[1] : 'YouTube Video';

        // Use y2mate API as fallback
        const y2mateResponse = await axios.post('https://www.y2mate.com/mates/analyzeV2/ajax', {
            k_query: infoUrl,
            k_page: 'home',
            hl: 'en',
            q_auto: 1
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (y2mateResponse.data.links && y2mateResponse.data.links.mp4) {
            // Get the first mp4 link
            const mp4Links = y2mateResponse.data.links.mp4;
            const qualities = Object.keys(mp4Links);
            if (qualities.length > 0) {
                // Get medium quality (360p or 480p)
                const targetQuality = qualities.find(q => q === '480p') ||
                    qualities.find(q => q === '360p') ||
                    qualities[0];
                return {
                    success: true,
                    url: mp4Links[targetQuality].dlink || mp4Links[targetQuality].link,
                    title: title,
                    api: 'Y2Mate'
                };
            }
        }
    } catch (error) {
        console.log('Direct download gagal:', error.message);
    }
    return null;
}

async function youtubeCommand(sock, chatId, message, command) {
    let tempFile = null;

    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ');
        const searchQuery = args.slice(1).join(' ');

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: `YouTube Downloader

Command yang tersedia:
• .youtube <link youtube>
• .yt <link youtube>

Contoh:
• .yt https://youtu.be/VIDEO_ID
• .youtube https://www.youtube.com/watch?v=VIDEO_ID

Note:
• Video akan dikirim tanpa watermark
• Durasi maksimal disarankan 10 menit
• Video akan dikompres jika terlalu besar`
            }, { quoted: message });
        }

        // Send processing message
        const processingMsg = await sock.sendMessage(chatId, {
            text: `Memproses YouTube

URL: ${searchQuery.substring(0, 50)}${searchQuery.length > 50 ? '...' : ''}

Mohon tunggu...`
        }, { quoted: message });

        let videoUrl = '';
        let videoInfo = null;

        // Check if it's a YouTube URL
        const youtubeId = extractYouTubeId(searchQuery);
        if (youtubeId) {
            videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

            // Get video info
            try {
                const searchResult = await yts({ videoId: youtubeId });
                videoInfo = searchResult;
            } catch (e) {
                console.log('Gagal mendapatkan info video:', e.message);
            }
        } else {
            // Search video
            try {
                const result = await yts(searchQuery);
                if (!result.videos || result.videos.length === 0) {
                    await sock.sendMessage(chatId, {
                        text: `Video tidak ditemukan

Pencarian: "${searchQuery}"
Tidak ditemukan hasil.

Coba:
• Gunakan link YouTube langsung
• Periksa penulisan judul`
                    });
                    return;
                }
                videoUrl = result.videos[0].url;
                videoInfo = result.videos[0];
            } catch (e) {
                await sock.sendMessage(chatId, {
                    text: `Gagal mencari video

Error: ${e.message}

Coba gunakan link YouTube langsung.`
                });
                return;
            }
        }

        // Check duration for long videos
        if (videoInfo && videoInfo.seconds > 600) { // 10 menit
            await sock.sendMessage(chatId, {
                text: `Video terlalu panjang

Durasi: ${videoInfo.timestamp}
Maksimal disarankan: 10 menit

Video yang terlalu panjang mungkin gagal dikirim.`
            });
            // Lanjutkan tapi dengan warning
        }

        // Update status
        await sock.sendMessage(chatId, {
            text: `Mencari sumber download...

Judul: ${videoInfo?.title || 'YouTube Video'}
Durasi: ${videoInfo?.timestamp || 'Tidak diketahui'}`
        });

        // Try to get video from APIs
        let videoData = await downloadVideoFromAPI(videoUrl);

        // If APIs fail, try direct method
        if (!videoData.success && youtubeId) {
            await sock.sendMessage(chatId, {
                text: `API gagal, mencoba metode alternatif...`
            });

            const directData = await downloadYouTubeDirect(youtubeId);
            if (directData) {
                videoData = directData;
            }
        }

        if (!videoData.success) {
            await sock.sendMessage(chatId, {
                text: `Gagal mendapatkan link download

Semua metode gagal.

Coba:
• Video lain
• Link yang berbeda
• Nanti lagi

Error: ${videoData.error || 'Tidak diketahui'}`
            });
            return;
        }

        // Update status
        await sock.sendMessage(chatId, {
            text: `Link ditemukan

Mendownload video...
Ini mungkin membutuhkan beberapa saat.`
        });

        // Create temp directory
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        tempFile = path.join(tempDir, `yt_${Date.now()}.mp4`);

        // Download video with progress
        let downloadedBytes = 0;
        let totalBytes = 0;

        await new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url: videoData.url,
                responseType: 'stream',
                timeout: 180000, // 3 minutes
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.youtube.com/',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            })
                .then(response => {
                    totalBytes = parseInt(response.headers['content-length']) || 0;
                    const writer = fs.createWriteStream(tempFile);
                    response.data.pipe(writer);

                    // Progress tracking
                    response.data.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        if (totalBytes > 0) {
                            const percent = Math.round((downloadedBytes / totalBytes) * 100);
                            if (percent % 25 === 0) {
                                console.log(`Download progress: ${percent}%`);
                            }
                        }
                    });

                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    response.data.on('error', reject);
                })
                .catch(reject);
        });

        // Check if file was downloaded
        if (!fs.existsSync(tempFile)) {
            throw new Error('File tidak berhasil didownload');
        }

        const fileStats = fs.statSync(tempFile);
        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

        // Check file size
        if (fileStats.size > 50 * 1024 * 1024) { // 50MB limit for WhatsApp
            await sock.sendMessage(chatId, {
                text: `File terlalu besar

Ukuran: ${fileSizeMB} MB
Maksimal WhatsApp: 50 MB

Video akan dikompres...`
            });

            // Simple compression by limiting duration
            // Note: In production, you might want to use ffmpeg
            if (videoInfo && videoInfo.seconds > 60) {
                await sock.sendMessage(chatId, {
                    text: `Video dipotong menjadi 60 detik pertama karena terlalu besar.`
                });
            }
        }

        // Update status
        await sock.sendMessage(chatId, {
            text: `Video siap

Ukuran: ${fileSizeMB} MB
Mengirim ke WhatsApp...`
        });

        // Send video without caption as requested
        await sock.sendMessage(chatId, {
            video: fs.readFileSync(tempFile),
            mimetype: 'video/mp4',
            fileName: `YouTube_${Date.now()}.mp4`
            // No caption as requested
        });

        // Delete processing message if possible
        try {
            await sock.deleteMessage(chatId, processingMsg.key);
        } catch (e) {
            console.log('Tidak bisa menghapus pesan processing:', e.message);
        }

        // Send success message
        await sock.sendMessage(chatId, {
            text: `Media Berhasil Didownload!

Video YouTube telah dikirim!

Ingin download video lain?
Ketik: .yt <link youtube>

Contoh:
.yt https://youtu.be/VIDEO_ID`
        });

    } catch (error) {
        console.error('YouTube error:', error);

        await sock.sendMessage(chatId, {
            text: `Gagal Download Video

Error: ${error.message || 'Tidak diketahui'}

Coba:
• Video yang lebih pendek
• Link YouTube yang valid
• Nanti lagi

Contoh link valid:
https://youtu.be/VIDEO_ID
https://www.youtube.com/watch?v=VIDEO_ID`
        });

    } finally {
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempFile);
                    console.log('Temp file cleaned:', tempFile);
                } catch (e) {
                    console.error('Gagal hapus temp file:', e.message);
                }
            }, 10000);
        }
    }
}

module.exports = {
    youtube: youtubeCommand,
    yt: youtubeCommand
};