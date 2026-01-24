const axios = require('axios');
const fs = require('fs');
const path = require('path');

const tiktokApis = [
    {
        name: "API TikWM",
        url: "https://tikwm.com/api/",
        method: "POST",
        parse: (data) => ({
            video: data.data?.play || data.data?.wmplay || data.data?.hdplay,
            audio: data.data?.music,
            title: data.data?.title,
            author: data.data?.author?.nickname,
            cover: data.data?.cover,
            duration: data.data?.duration
        })
    }
];

function extractTikTokUrl(text) {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.|vt\.|vm\.)?tiktok\.com\/@[^\/]+\/video\/\d+/i,
        /(?:https?:\/\/)?(?:www\.|vt\.|vm\.)?tiktok\.com\/t\/[a-zA-Z0-9]+/i,
        /(?:https?:\/\/)?vt\.tiktok\.com\/[a-zA-Z0-9]+/i,
        /(?:https?:\/\/)?vm\.tiktok\.com\/[a-zA-Z0-9]+/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let url = match[0];
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            return url;
        }
    }

    return null;
}

function validateTikTokUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return hostname.includes('tiktok.com');
    } catch {
        return false;
    }
}

async function getTikTokVideo(url) {
    const api = tiktokApis[0]; 
    try {
        console.log(`Menggunakan ${api.name}...`);

        const formData = new URLSearchParams();
        formData.append('url', url);

        const response = await axios.post(api.url, formData, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const data = response.data;

        if (data.code === 0 && data.data) {
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
                    watermark: parsed.video.includes('wmplay') ? 'Watermarked' : 'No Watermark'
                };
            }
        }

        return { success: false, error: "API tidak mengembalikan video" };
    } catch (error) {
        console.log(`${api.name} gagal:`, error.message);
        return { success: false, error: error.message };
    }
}

async function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024, // 100MB max
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tiktok.com/',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br'
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
                    console.log('File berhasil didownload ke:', outputPath);
                    resolve();
                });

                writer.on('error', (err) => {
                    console.error('Writer error:', err);
                    reject(err);
                });

                response.data.on('error', (err) => {
                    console.error('Response error:', err);
                    reject(err);
                });
            })
            .catch(reject);
    });
}

function formatDuration(seconds) {
    if (!seconds) return 'Tidak diketahui';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function compressVideoIfNeeded(inputPath, maxSizeMB = 50) {
    const stats = fs.statSync(inputPath);
    const sizeMB = stats.size / (1024 * 1024);

    if (sizeMB <= maxSizeMB) {
        console.log(`Video size: ${sizeMB.toFixed(2)} MB - Tidak perlu compress`);
        return inputPath;
    }

    console.log(`Video size: ${sizeMB.toFixed(2)} MB - Terlalu besar, perlu compress`);

    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const name = path.basename(inputPath, ext);
    const compressedPath = path.join(dir, `${name}_compressed${ext}`);

    try {
        const { execSync } = require('child_process');
        try {
            execSync('ffmpeg -version', { stdio: 'ignore' });

            const cmd = `ffmpeg -i "${inputPath}" -vf "scale=720:-2" -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k "${compressedPath}"`;
            execSync(cmd, { stdio: 'inherit' });

            const newStats = fs.statSync(compressedPath);
            console.log(`Compressed to: ${(newStats.size / (1024 * 1024)).toFixed(2)} MB`);

            fs.unlinkSync(inputPath);
            return compressedPath;
        } catch {
            console.log('FFmpeg tidak tersedia, menggunakan file asli');
            return inputPath;
        }
    } catch (error) {
        console.error('Compress error:', error);
        return inputPath;
    }
}

async function tiktokCommand(sock, chatId, message, command) {
    let tempFiles = [];

    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        let url = '';
        if (command === '.tiktok') {
            url = text.substring(9).trim();
        } else if (command === '.tt') {
            url = text.substring(4).trim();
        } else {
            url = text.split(' ').slice(1).join(' ').trim();
        }

        const extractedUrl = extractTikTokUrl(url);
        if (extractedUrl) {
            url = extractedUrl;
        }

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `TikTok Video Downloader

Command yang tersedia:
• .tiktok <link> - Download video TikTok
• .tt <link> - Short command

Contoh:
.tt https://vt.tiktok.com/ABC123/`
            }, { quoted: message });
        }

        if (!validateTikTokUrl(url)) {
            return await sock.sendMessage(chatId, {
                text: `Link Tidak Valid

Pastikan link dari TikTok.
Contoh link yang benar:
• https://tiktok.com/@user/video/123456789
• https://vt.tiktok.com/ABC123XYZ/
• https://vm.tiktok.com/XYZ789ABC/`
            }, { quoted: message });
        }

        const statusMsg = await sock.sendMessage(chatId, {
            text: `Memproses TikTok...

URL: ${url}

Mohon tunggu...`
        }, { quoted: message });

        try {
            const videoInfo = await getTikTokVideo(url);

            if (!videoInfo.success) {
                await sock.sendMessage(chatId, {
                    text: `Gagal Mendapatkan Video

Error: ${videoInfo.error || 'Tidak diketahui'}

Coba link yang berbeda atau coba lagi nanti.`
                });
                return;
            }

            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const videoPath = path.join(tempDir, `tt_${timestamp}.mp4`);
            tempFiles.push(videoPath);

            try {
                await downloadFile(videoInfo.videoUrl, videoPath);
                console.log('Download completed successfully');
            } catch (downloadError) {
                console.error('Download failed:', downloadError);
                throw new Error(`Gagal download: ${downloadError.message}`);
            }

            if (!fs.existsSync(videoPath)) {
                throw new Error('File tidak ditemukan setelah download');
            }

            const stats = fs.statSync(videoPath);
            if (stats.size === 0) {
                throw new Error('File kosong (0 bytes)');
            }

            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`File size: ${fileSizeMB} MB`);

            const finalVideoPath = await compressVideoIfNeeded(videoPath);
            if (finalVideoPath !== videoPath) {
                tempFiles.push(finalVideoPath);
            }

            const finalStats = fs.statSync(finalVideoPath);
            const finalSizeMB = (finalStats.size / (1024 * 1024)).toFixed(2);

            await sock.sendMessage(chatId, {
                text: `*Mengirim video...*

Ukuran: ${finalSizeMB} MB
Durasi: ${formatDuration(videoInfo.duration)}

Harap tunggu...`
            });

            try {
                console.log('Mengirim video ke WhatsApp...');

                const videoBuffer = fs.readFileSync(finalVideoPath);

                await sock.sendMessage(chatId, {
                    video: videoBuffer,
                    mimetype: 'video/mp4',
                    fileName: `TikTok_${timestamp}.mp4`
                }, { quoted: message });

                console.log('Video berhasil dikirim');

                await sock.sendMessage(chatId, {
                    text: `*✅ Media Berhasil Didownload!*\n\n` +
                        `Video TikTok telah dikirim!\n\n` +
                        `Ingin download video lain?\n` +
                        `Ketik: \`.tt <link tiktok>\``
                });

            } catch (sendError) {
                console.error('Gagal mengirim video:', sendError);

                try {
                    await sock.sendMessage(chatId, {
                        document: fs.readFileSync(finalVideoPath),
                        mimetype: 'video/mp4',
                        fileName: `TikTok_${timestamp}.mp4`,
                        caption: `TikTok Video
${videoInfo.title}
By: ${videoInfo.author}`
                    }, { quoted: message });

                    await sock.sendMessage(chatId, {
                        text: `Video dikirim sebagai dokumen

Kadang lebih stabil dengan cara ini.`
                    });
                } catch (docError) {
                    throw new Error(`Gagal mengirim video: ${sendError.message}`);
                }
            }

        } catch (processError) {
            console.error('Process error:', processError);

            await sock.sendMessage(chatId, {
                text: `Terjadi Kesalahan

${processError.message || 'Gagal memproses video'}

Coba solusi:
• Pastikan koneksi internet stabil
• Coba link yang berbeda
• Tunggu beberapa menit`
            });
        }

    } catch (error) {
        console.error("Error in TikTok command:", error);

        await sock.sendMessage(chatId, {
            text: `Error Sistem

${error.message || 'Unknown error'}

Silakan coba lagi.`
        }, { quoted: message });

    } finally {
        setTimeout(() => {
            tempFiles.forEach(filePath => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('Deleted temp file:', filePath);
                    }
                } catch (e) {
                    console.error('Gagal hapus temp file:', e.message);
                }
            });
        }, 10000);
    }
}

async function tiktokSimpleCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `TikTok Downloader

Gunakan:
• .tt <link>

Contoh:
• .tt https://vt.tiktok.com/ABC123/`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: 'Memproses TikTok...'
        }, { quoted: message });

        try {
            const response = await axios.post('https://tikwm.com/api/', {
                url: url
            }, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const data = response.data;

            if (data.data && data.data.play) {
                await sock.sendMessage(chatId, {
                    video: { url: data.data.play },
                    caption: `TikTok Video
${data.data.title || ''}
By: ${data.data.author?.nickname || 'Unknown'}`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    text: 'Gagal mendapatkan video.'
                });
            }
        } catch (error) {
            await sock.sendMessage(chatId, {
                text: `Error: ${error.message}`
            });
        }

    } catch (error) {
        await sock.sendMessage(chatId, {
            text: `Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = {
    tiktok: tiktokCommand,
    tt: tiktokCommand,
    tiktokSimple: tiktokSimpleCommand
};