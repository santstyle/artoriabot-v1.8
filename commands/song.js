const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// API yang lebih stabil
const songApis = [
    {
        name: "Y2Mate",
        url: "https://youtube-mp36.p.rapidapi.com/dl",
        method: "GET",
        params: (id) => ({ id: id }),
        parse: (data) => data.link,
        getTitle: (data) => data.title,
        getArtist: (data) => data.author || "Unknown Artist",
        useRapidAPI: true
    },
    {
        name: "Loader",
        url: "https://loader.to/api/convert",
        method: "POST",
        params: (url) => ({
            url: url,
            format: "mp3",
            bitrate: "128"
        }),
        parse: (data) => data.download_url,
        getTitle: (data) => data.title,
        getArtist: (data) => "YouTube Audio"
    }
];

// Extract YouTube ID
function extractYouTubeId(url) {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Get YouTube video info
async function getYouTubeInfo(query) {
    try {
        // Check if it's already a YouTube URL
        if (query.match(/(youtube\.com|youtu\.be)/i)) {
            const videoId = extractYouTubeId(query);
            const searchResult = await yts({ videoId });

            if (searchResult.videos && searchResult.videos.length > 0) {
                const video = searchResult.videos[0];
                return {
                    url: video.url,
                    id: videoId,
                    title: video.title,
                    artist: video.author?.name || 'Unknown Artist',
                    duration: video.seconds,
                    thumbnail: video.thumbnail,
                    views: video.views
                };
            }

            return {
                url: query,
                id: videoId,
                title: 'YouTube Audio',
                artist: 'Unknown Artist',
                duration: null,
                thumbnail: null
            };
        } else {
            // Search for the song
            const { videos } = await yts(query);

            if (!videos || videos.length === 0) {
                throw new Error('Lagu tidak ditemukan di YouTube');
            }

            // Pilih video terbaik
            const video = videos[0];

            return {
                url: video.url,
                id: extractYouTubeId(video.url),
                title: video.title,
                artist: video.author?.name || 'Unknown Artist',
                duration: video.seconds,
                thumbnail: video.thumbnail,
                views: video.views
            };
        }
    } catch (error) {
        throw new Error(`Gagal mendapatkan info: ${error.message}`);
    }
}

// Get audio URL dengan metode lokal (yt-dlp)
async function getAudioWithYtDlp(youtubeUrl, title) {
    try {
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const outputFile = path.join(tempDir, `audio_${timestamp}.mp3`);

        // Cek apakah yt-dlp tersedia
        try {
            await execPromise('yt-dlp --version');
        } catch (e) {
            console.log('yt-dlp tidak ditemukan, mencoba install...');
            try {
                await execPromise('pip install yt-dlp');
            } catch (installError) {
                console.log('Gagal install yt-dlp:', installError.message);
                return null;
            }
        }

        // Download audio dengan yt-dlp
        console.log('Mendownload dengan yt-dlp...');
        const command = `yt-dlp -x --audio-format mp3 --audio-quality 128K -o "${outputFile}" "${youtubeUrl}"`;

        try {
            await execPromise(command, { timeout: 180000 });

            if (fs.existsSync(outputFile)) {
                const stats = fs.statSync(outputFile);
                if (stats.size > 0) {
                    return {
                        success: true,
                        filePath: outputFile,
                        title: title,
                        api: 'yt-dlp'
                    };
                }
            }
        } catch (error) {
            console.log('yt-dlp error:', error.message);
            // Hapus file jika gagal
            if (fs.existsSync(outputFile)) {
                fs.unlinkSync(outputFile);
            }
        }

        return null;
    } catch (error) {
        console.log('yt-dlp process error:', error.message);
        return null;
    }
}

// Get audio URL dengan API online
async function getAudioUrl(videoInfo) {
    // Coba metode lokal pertama
    const localResult = await getAudioWithYtDlp(videoInfo.url, videoInfo.title);
    if (localResult) {
        return localResult;
    }

    // Jika lokal gagal, coba API online
    const onlineApis = [
        // API 1: y2mate alternative
        async () => {
            try {
                console.log('Mencoba API y2mate...');
                const response = await axios.get('https://yt-api.p.rapidapi.com/dl', {
                    params: { id: videoInfo.id },
                    headers: {
                        'X-RapidAPI-Key': 'c8b1830fd8msh3b4c6c8c9c9c9c9p1c9c9cjsn4c8c9c9c9c9c',
                        'X-RapidAPI-Host': 'yt-api.p.rapidapi.com'
                    },
                    timeout: 15000
                });

                if (response.data && response.data.link) {
                    return {
                        success: true,
                        url: response.data.link,
                        title: response.data.title || videoInfo.title,
                        api: 'y2mate'
                    };
                }
            } catch (e) {
                console.log('API y2mate gagal:', e.message);
                return null;
            }
        },

        // API 2: loader.to
        async () => {
            try {
                console.log('Mencoba API loader.to...');
                const response = await axios.post('https://loader.to/ajax/download.php',
                    `url=${encodeURIComponent(videoInfo.url)}&format=mp3`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 15000
                    }
                );

                if (response.data && response.data.download_url) {
                    return {
                        success: true,
                        url: response.data.download_url,
                        title: videoInfo.title,
                        api: 'loader.to'
                    };
                }
            } catch (e) {
                console.log('API loader.to gagal:', e.message);
                return null;
            }
        },

        // API 3: mp3-convert.org
        async () => {
            try {
                console.log('Mencoba API mp3-convert...');
                const response = await axios.get('https://mp3-convert.org/api/convert', {
                    params: {
                        url: videoInfo.url,
                        format: 'mp3'
                    },
                    timeout: 15000
                });

                if (response.data && response.data.url) {
                    return {
                        success: true,
                        url: response.data.url,
                        title: videoInfo.title,
                        api: 'mp3-convert'
                    };
                }
            } catch (e) {
                console.log('API mp3-convert gagal:', e.message);
                return null;
            }
        },

        // API 4: yt5s (bekerja langsung dengan YouTube)
        async () => {
            try {
                console.log('Mencoba metode yt5s...');
                // Step 1: Get video info
                const infoResponse = await axios.post('https://yt5s.com/api/ajaxSearch/index',
                    `q=${encodeURIComponent(videoInfo.url)}&vt=mp3`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 15000
                    }
                );

                if (infoResponse.data && infoResponse.data.vid) {
                    // Step 2: Convert to MP3
                    const convertResponse = await axios.post('https://yt5s.com/api/ajaxConvert/convert',
                        `vid=${infoResponse.data.vid}&k=${infoResponse.data.links.mp3['128']?.k || infoResponse.data.links.mp3['320']?.k}`,
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            },
                            timeout: 15000
                        }
                    );

                    if (convertResponse.data && convertResponse.data.dlink) {
                        return {
                            success: true,
                            url: convertResponse.data.dlink,
                            title: infoResponse.data.title || videoInfo.title,
                            api: 'yt5s'
                        };
                    }
                }
            } catch (e) {
                console.log('Metode yt5s gagal:', e.message);
                return null;
            }
        }
    ];

    // Coba semua API
    for (let i = 0; i < onlineApis.length; i++) {
        try {
            const result = await onlineApis[i]();
            if (result) {
                console.log(`Berhasil dengan API: ${result.api}`);
                return result;
            }
        } catch (error) {
            console.log(`API ${i + 1} error:`, error.message);
            continue;
        }
    }

    return {
        success: false,
        error: "Semua metode download gagal"
    };
}

// Clean filename
function cleanFileName(text) {
    return text
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
}

// Format duration
function formatDuration(seconds) {
    if (!seconds) return 'Unknown';

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Update pesan tanpa delete
async function updateMessage(sock, chatId, messageKey, newText) {
    try {
        await sock.sendMessage(chatId, {
            text: newText,
            edit: messageKey
        });
    } catch (error) {
        // Jika edit gagal, kirim pesan baru
        console.log('Gagal edit pesan, mengirim pesan baru:', error.message);
        await sock.sendMessage(chatId, { text: newText });
    }
}

// Main song command
async function songCommand(sock, chatId, message) {
    let statusMessage = null;
    let statusKey = null;

    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        const searchQuery = text.replace('.song ', '').replace('.music ', '').replace('.play ', '').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: `*Music Downloader*\n\n` +
                    `Gunakan: .song <judul lagu>\n` +
                    `Contoh: .song unity alan walker\n` +
                    `Atau: .song https://youtube.com/watch?v=...`
            }, { quoted: message });
        }

        // Kirim status awal
        statusMessage = await sock.sendMessage(chatId, {
            text: `Memproses Audio YouTube\n\nURL: ${searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be') ? searchQuery : 'Mencari: ' + searchQuery}\n\nMulai download...`
        });
        statusKey = statusMessage.key;

        console.log(`Mencari lagu: ${searchQuery}`);

        // Update status
        await updateMessage(sock, chatId, statusKey,
            `Memproses Audio YouTube\n\n` +
            `URL: ${searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be') ? searchQuery : 'Mencari: ' + searchQuery}\n\n` +
            `Status: Mencari video di YouTube...`
        );

        // Dapatkan info video
        const videoInfo = await getYouTubeInfo(searchQuery);
        console.log(`Video ditemukan: ${videoInfo.title}`);

        // Update status
        await updateMessage(sock, chatId, statusKey,
            `Memproses Audio YouTube\n\n` +
            `URL: ${videoInfo.url}\n\n` +
            `Video: ${videoInfo.title}\n` +
            `Artis: ${videoInfo.artist}\n` +
            `Durasi: ${formatDuration(videoInfo.duration)}\n\n` +
            `Status: Mencari sumber audio...`
        );

        // Durasi maksimal 15 menit
        if (videoInfo.duration && videoInfo.duration > 900) {
            await updateMessage(sock, chatId, statusKey,
                `Memproses Audio YouTube\n\n` +
                `URL: ${videoInfo.url}\n\n` +
                `Error: Video terlalu panjang (${formatDuration(videoInfo.duration)})\n` +
                `Maksimal: 15 menit\n\n` +
                `Silakan cari versi yang lebih pendek.`
            );
            return;
        }

        // Dapatkan URL audio
        await updateMessage(sock, chatId, statusKey,
            `Memproses Audio YouTube\n\n` +
            `URL: ${videoInfo.url}\n\n` +
            `Video: ${videoInfo.title}\n` +
            `Status: Mendownload audio... (mungkin butuh waktu)`
        );

        const audioData = await getAudioUrl(videoInfo);

        if (!audioData.success) {
            await updateMessage(sock, chatId, statusKey,
                `Memproses Audio YouTube\n\n` +
                `URL: ${videoInfo.url}\n\n` +
                `Error: ${audioData.error}\n\n` +
                `Coba:\n` +
                `1. Gunakan link YouTube langsung\n` +
                `2. Judul yang lebih spesifik\n` +
                `3. Coba lagi nanti`
            );
            return;
        }

        console.log(`Audio didapatkan dari: ${audioData.api}`);

        // Jika audio sudah didownload lokal (yt-dlp)
        if (audioData.filePath) {
            try {
                // Kirim audio file
                const stats = fs.statSync(audioData.filePath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                await updateMessage(sock, chatId, statusKey,
                    `Memproses Audio YouTube\n\n` +
                    `URL: ${videoInfo.url}\n\n` +
                    `Status: Mengirim audio... (${fileSizeMB} MB)`
                );

                await sock.sendMessage(chatId, {
                    audio: fs.readFileSync(audioData.filePath),
                    mimetype: "audio/mpeg",
                    fileName: `${cleanFileName(videoInfo.title)}.mp3`,
                    caption: `✅ ${videoInfo.title}\n👤 ${videoInfo.artist}\n⏱️ ${formatDuration(videoInfo.duration)}\n📦 ${fileSizeMB} MB\n🔧 ${audioData.api}`
                });

                // Update status akhir
                await updateMessage(sock, chatId, statusKey,
                    `Memproses Audio YouTube\n\n` +
                    `URL: ${videoInfo.url}\n\n` +
                    `Status: ✅ Audio berhasil dikirim!\n\n` +
                    `Judul: ${videoInfo.title}\n` +
                    `Artis: ${videoInfo.artist}\n` +
                    `Ukuran: ${fileSizeMB} MB\n` +
                    `Metode: ${audioData.api}`
                );

                // Cleanup
                setTimeout(() => {
                    if (fs.existsSync(audioData.filePath)) {
                        fs.unlinkSync(audioData.filePath);
                    }
                }, 5000);

            } catch (error) {
                await updateMessage(sock, chatId, statusKey,
                    `Memproses Audio YouTube\n\n` +
                    `URL: ${videoInfo.url}\n\n` +
                    `Error: Gagal mengirim audio\n` +
                    `Detail: ${error.message}`
                );
                if (audioData.filePath && fs.existsSync(audioData.filePath)) {
                    fs.unlinkSync(audioData.filePath);
                }
            }
            return;
        }

        // Jika dapat URL audio (API online)
        await updateMessage(sock, chatId, statusKey,
            `Memproses Audio YouTube\n\n` +
            `URL: ${videoInfo.url}\n\n` +
            `Status: Mendownload dari ${audioData.api}...`
        );

        // Download audio dari URL
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const tempFile = path.join(tempDir, `audio_${timestamp}.mp3`);

        try {
            const response = await axios({
                method: 'GET',
                url: audioData.url,
                responseType: 'stream',
                timeout: 120000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const writer = fs.createWriteStream(tempFile);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            });

            // Kirim audio
            const stats = fs.statSync(tempFile);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            await updateMessage(sock, chatId, statusKey,
                `Memproses Audio YouTube\n\n` +
                `URL: ${videoInfo.url}\n\n` +
                `Status: Mengirim audio... (${fileSizeMB} MB)`
            );

            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(tempFile),
                mimetype: "audio/mpeg",
                fileName: `${cleanFileName(videoInfo.title)}.mp3`,
                caption: `✅ ${videoInfo.title}\n👤 ${videoInfo.artist}\n⏱️ ${formatDuration(videoInfo.duration)}\n📦 ${fileSizeMB} MB\n🔧 ${audioData.api}`
            });

            // Update status akhir
            await updateMessage(sock, chatId, statusKey,
                `Memproses Audio YouTube\n\n` +
                `URL: ${videoInfo.url}\n\n` +
                `Status: ✅ Audio berhasil dikirim!\n\n` +
                `Judul: ${videoInfo.title}\n` +
                `Artis: ${videoInfo.artist}\n` +
                `Ukuran: ${fileSizeMB} MB\n` +
                `Metode: ${audioData.api}`
            );

            // Cleanup
            setTimeout(() => {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            }, 5000);

        } catch (downloadError) {
            await updateMessage(sock, chatId, statusKey,
                `Memproses Audio YouTube\n\n` +
                `URL: ${videoInfo.url}\n\n` +
                `Error: Gagal download audio\n` +
                `Detail: ${downloadError.message}`
            );
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }

    } catch (error) {
        console.error("[SONG ERROR]:", error);

        if (statusKey) {
            await updateMessage(sock, chatId, statusKey,
                `Memproses Audio YouTube\n\n` +
                `Error: ${error.message || 'Terjadi kesalahan'}\n\n` +
                `Silakan coba:\n` +
                `1. .song "judul lagu artis"\n` +
                `2. Link YouTube langsung\n` +
                `3. Tunggu beberapa saat`
            );
        } else {
            await sock.sendMessage(chatId, {
                text: `Error: ${error.message || 'Terjadi kesalahan'}\n\nSilakan coba lagi.`
            }, { quoted: message });
        }
    }
}

// Simple version
async function songSimpleCommand(sock, chatId, message) {
    return await songCommand(sock, chatId, message);
}

// Export
module.exports = {
    song: songCommand,
    music: songCommand,
    play: songCommand,
    songSimple: songSimpleCommand
};