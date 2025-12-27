const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// List of Twitter/X download APIs
const twitterApis = [
    {
        name: "API 1",
        url: "https://api.vxtwitter.com/Twitter/status",
        method: "GET",
        parse: (data) => {
            if (!data) return null;

            const result = {
                success: data.success || false,
                type: data.media_extended?.length > 0 ?
                    (data.media_extended[0].type || 'photo') : 'text',
                media: []
            };

            if (data.media_extended && data.media_extended.length > 0) {
                data.media_extended.forEach(media => {
                    if (media.type === 'video' || media.type === 'gif') {
                        // Find the highest quality video
                        const variants = media.variants || [];
                        const videoUrls = variants.filter(v => v.url && v.content_type === 'video/mp4');

                        if (videoUrls.length > 0) {
                            // Sort by bitrate (highest first)
                            videoUrls.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                            result.media.push({
                                type: media.type,
                                url: videoUrls[0].url,
                                thumbnail: media.thumbnail_url || media.preview_image_url,
                                duration: media.duration,
                                size: media.size
                            });
                        }
                    } else if (media.type === 'photo') {
                        result.media.push({
                            type: 'photo',
                            url: media.url || media.media_url_https,
                            thumbnail: media.thumbnail_url || media.preview_image_url
                        });
                    }
                });
            }

            return result;
        }
    },
    {
        name: "API 2",
        url: "https://api.fxtwitter.com/status",
        method: "GET",
        parse: (data) => {
            if (!data || !data.tweet) return null;

            const tweet = data.tweet;
            const result = {
                success: true,
                type: tweet.media?.photos ? 'photo' :
                    tweet.media?.videos ? 'video' :
                        tweet.media?.gif ? 'gif' : 'text',
                media: []
            };

            if (tweet.media?.photos) {
                tweet.media.photos.forEach(photo => {
                    result.media.push({
                        type: 'photo',
                        url: photo.url,
                        thumbnail: photo.url
                    });
                });
            }

            if (tweet.media?.videos) {
                tweet.media.videos.forEach(video => {
                    result.media.push({
                        type: 'video',
                        url: video.url,
                        thumbnail: video.thumbnail_url,
                        duration: video.duration,
                        bitrate: video.bitrate
                    });
                });
            }

            if (tweet.media?.gif) {
                tweet.media.gif.forEach(gif => {
                    result.media.push({
                        type: 'gif',
                        url: gif.url,
                        thumbnail: gif.thumbnail_url
                    });
                });
            }

            return result;
        }
    },
    {
        name: "API 3",
        url: "https://api.siputzx.my.id/api/download/twitter",
        method: "GET",
        parse: (data) => {
            if (!data || !data.result) return null;

            const result = {
                success: data.status === 200,
                type: data.result.type || 'photo',
                media: []
            };

            if (data.result.url) {
                result.media.push({
                    type: data.result.type || 'video',
                    url: data.result.url,
                    thumbnail: data.result.thumbnail
                });
            }

            return result;
        }
    },
    {
        name: "API 4",
        url: "https://api.akuari.my.id/downloader/twitter",
        method: "GET",
        parse: (data) => {
            if (!data || !data.hasil) return null;

            const result = {
                success: !!data.hasil.url,
                type: data.hasil.type || 'video',
                media: []
            };

            if (data.hasil.url) {
                result.media.push({
                    type: data.hasil.type || 'video',
                    url: data.hasil.url,
                    thumbnail: data.hasil.thumb,
                    quality: data.hasil.quality
                });
            }

            return result;
        }
    },
    {
        name: "API 5",
        url: "https://twitsave.com/info",
        method: "POST",
        parse: (data) => {
            if (!data || !data.media) return null;

            const result = {
                success: true,
                type: data.media[0]?.type || 'video',
                media: []
            };

            data.media.forEach(media => {
                result.media.push({
                    type: media.type,
                    url: media.url,
                    thumbnail: media.thumbnail,
                    quality: media.quality,
                    size: media.size
                });
            });

            return result;
        }
    }
];

// Extract Twitter/X URL from text
function extractTwitterUrl(text) {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:[^\/]+\/status\/\d+)/i,
        /(?:https?:\/\/)?(?:www\.)?twitter\.com\/i\/web\/status\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?x\.com\/i\/web\/status\/\d+/i,
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:[^\/]+)\/status\/\d+(?:\?.*)?/i,
        /t\.co\/[a-zA-Z0-9]+/i
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

// Extract tweet ID from URL
function extractTweetId(url) {
    const patterns = [
        /(?:twitter\.com|x\.com)\/(?:[^\/]+)\/status\/(\d+)/,
        /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/,
        /status\/(\d+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// Get media from Twitter/X
async function getTwitterMedia(url, apiIndex = 0) {
    if (apiIndex >= twitterApis.length) {
        return { success: false, error: "Semua API gagal" };
    }

    const api = twitterApis[apiIndex];
    const tweetId = extractTweetId(url);

    if (!tweetId) {
        return { success: false, error: "ID tweet tidak valid" };
    }

    try {
        console.log(`Mencoba API ${api.name}...`);

        let response;
        if (api.method === "POST") {
            const formData = new URLSearchParams();
            formData.append('url', url);

            response = await axios.post(api.url, formData, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        } else {
            const apiUrl = api.url.includes('{id}') ?
                api.url.replace('{id}', tweetId) :
                `${api.url}/${tweetId}`;

            response = await axios.get(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
        }

        const data = response.data;
        const parsed = api.parse(data);

        if (parsed && parsed.success && parsed.media && parsed.media.length > 0) {
            return {
                success: true,
                media: parsed.media,
                type: parsed.type,
                api: api.name,
                tweetId: tweetId,
                tweetUrl: url
            };
        } else {
            console.log(`API ${api.name} tidak mengembalikan media`);
            return await getTwitterMedia(url, apiIndex + 1);
        }
    } catch (error) {
        console.log(`API ${api.name} gagal:`, error.message);
        return await getTwitterMedia(url, apiIndex + 1);
    }
}

// Download file
async function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 300000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://twitter.com/'
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

// Convert video to smaller size if needed
async function compressVideo(inputPath, outputPath) {
    try {
        if (!fs.existsSync(inputPath)) {
            throw new Error('Input file not found');
        }

        const stats = fs.statSync(inputPath);
        const sizeMB = stats.size / (1024 * 1024);

        // Only compress if > 50MB
        if (sizeMB <= 50) {
            fs.copyFileSync(inputPath, outputPath);
            return true;
        }

        // Use ffmpeg if available
        try {
            await execPromise(`ffmpeg -i "${inputPath}" -vf "scale='min(1280,iw)':-2" -c:v libx264 -crf 28 -preset fast -c:a copy "${outputPath}" -y`);
            return true;
        } catch (ffmpegError) {
            console.log('FFmpeg not available, skipping compression');
            fs.copyFileSync(inputPath, outputPath);
            return true;
        }
    } catch (error) {
        console.error('Compression error:', error.message);
        return false;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function twitterCommand(sock, chatId, message, command) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        // Extract URL based on command
        let url = '';
        if (command === '.twitter') {
            url = text.substring(9).trim();
        } else if (command === '.twt') {
            url = text.substring(5).trim();
        } else if (command === '.x') {
            url = text.substring(3).trim();
        } else {
            url = text.split(' ').slice(1).join(' ').trim();
        }

        // Extract Twitter URL from text
        const extractedUrl = extractTwitterUrl(url);
        if (extractedUrl) {
            url = extractedUrl;
        }

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `🐦 *Twitter/X Downloader*\n\n` +
                    `📌 *Command yang tersedia:*\n` +
                    `• \`.twitter <link>\` - Download postingan\n` +
                    `• \`.twt <link>\` - Short command\n` +
                    `• \`.x <link>\` - X/Twitter download\n\n` +
                    `📋 *Format link yang didukung:*\n` +
                    `• https://twitter.com/user/status/123456789\n` +
                    `• https://x.com/user/status/123456789\n` +
                    `• https://twitter.com/i/web/status/123456789\n` +
                    `• https://t.co/abc123xyz\n\n` +
                    `📝 *Contoh penggunaan:*\n` +
                    `\`.twitter https://twitter.com/user/status/123456789\`\n` +
                    `\`.twt https://x.com/user/status/123456789\`\n` +
                    `\`.x https://twitter.com/i/web/status/123456789\`\n\n` +
                    `⚙️ *Konten yang didukung:*\n` +
                    `✅ Video (HD/SD)\n` +
                    `✅ Gambar (multiple)\n` +
                    `✅ GIF\n` +
                    `✅ Thread (multiple media)\n\n` +
                    `⚠️ *Batasan:*\n` +
                    `• Video maks: 50MB\n` +
                    `• Gambar maks: 10MB per gambar\n` +
                    `• Max 10 media per post`
            }, { quoted: message });
        }

        // Validate Twitter/X URL
        if (!url.includes('twitter.com') && !url.includes('x.com') && !url.includes('t.co')) {
            return await sock.sendMessage(chatId, {
                text: `❌ *Link Tidak Valid!*\n\n` +
                    `Link yang kamu kirim bukan link Twitter/X yang valid.\n\n` +
                    `Pastikan link mengandung:\n` +
                    `• twitter.com/.../status/...\n` +
                    `• x.com/.../status/...\n` +
                    `• t.co/... (short link)\n\n` +
                    `Contoh link yang benar:\n` +
                    `https://twitter.com/username/status/123456789`
            }, { quoted: message });
        }

        // Send processing message
        const processingMsg = await sock.sendMessage(chatId, {
            text: `🔍 *Memproses link Twitter...*\n\n` +
                `URL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}\n\n` +
                `⏳ Mohon tunggu sebentar...`
        }, { quoted: message });

        try {
            // Get media from Twitter
            await sock.editMessage(chatId, processingMsg, {
                text: `🔄 *Mengambil data postingan...*\n` +
                    `Mencoba API pertama...`
            });

            const mediaData = await getTwitterMedia(url);

            if (!mediaData.success) {
                await sock.editMessage(chatId, processingMsg, {
                    text: `❌ *Gagal Mendapatkan Media!*\n\n` +
                        `Tidak bisa mendownload dari link ini.\n\n` +
                        `Kemungkinan penyebab:\n` +
                        `1. Postingan di-private/dihapus\n` +
                        `2. Link tidak valid\n` +
                        `3. Tweet hanya berisi teks\n` +
                        `4. Semua API sedang down\n\n` +
                        `Coba link yang berbeda atau tunggu beberapa saat.`
                });
                return;
            }

            // Create temp directory
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const mediaCount = mediaData.media.length;

            // Show media info
            await sock.editMessage(chatId, processingMsg, {
                text: `✅ *Media Ditemukan!*\n\n` +
                    `📊 Tipe: ${mediaData.type}\n` +
                    `📁 Jumlah: ${mediaCount} file\n` +
                    `🔧 API: ${mediaData.api}\n\n` +
                    `⬇️ *Mendownload media...*`
            });

            // Send media based on type and count
            if (mediaCount === 1) {
                // Single media
                const media = mediaData.media[0];
                await sendSingleMedia(sock, chatId, media, timestamp, tempDir, processingMsg);

            } else if (mediaCount <= 10) {
                // Multiple media (send as album)
                await sendMultipleMedia(sock, chatId, mediaData.media, timestamp, tempDir, processingMsg);

            } else {
                // Too many media
                await sock.editMessage(chatId, processingMsg, {
                    text: `⚠️ *Terlalu Banyak Media!*\n\n` +
                        `Ditemukan ${mediaCount} media.\n` +
                        `Maksimal yang didukung: 10 media.\n\n` +
                        `Hanya akan mengirim 10 media pertama.`
                });

                // Send first 10 media
                await sendMultipleMedia(sock, chatId, mediaData.media.slice(0, 10), timestamp, tempDir, processingMsg);
            }

        } catch (error) {
            console.error('Twitter processing error:', error);

            await sock.editMessage(chatId, processingMsg, {
                text: `❌ *Terjadi Kesalahan!*\n\n` +
                    `Gagal memproses postingan Twitter.\n\n` +
                    `Error: ${error.message || 'Unknown'}\n\n` +
                    `Coba lagi nanti atau gunakan link yang berbeda.`
            });
        }

    } catch (error) {
        console.error("Error in Twitter command:", error);

        await sock.sendMessage(chatId, {
            text: "❌ *Terjadi Kesalahan Sistem!*\n\n" +
                "Maaf, terjadi error yang tidak terduga.\n" +
                "Silakan coba lagi nanti.\n\n" +
                "Error: " + (error.message || "Unknown")
        }, { quoted: message });
    }
}

// Send single media
async function sendSingleMedia(sock, chatId, media, timestamp, tempDir, processingMsg) {
    try {
        const tempFile = path.join(tempDir, `twt_${timestamp}_${media.type}.${getFileExtension(media.type)}`);

        // Update status
        await sock.editMessage(chatId, processingMsg, {
            text: `📥 *Mendownload ${media.type}...*\n\n` +
                `⏳ Mohon tunggu...`
        });

        // Download the file
        await downloadFile(media.url, tempFile);

        // Check file size
        const stats = fs.statSync(tempFile);
        const fileSize = formatFileSize(stats.size);

        // Compress video if needed
        let finalFile = tempFile;
        if (media.type === 'video' || media.type === 'gif') {
            if (stats.size > 50 * 1024 * 1024) {
                await sock.editMessage(chatId, processingMsg, {
                    text: `⚠️ *Video Terlalu Besar!*\n\n` +
                        `Ukuran: ${fileSize}\n` +
                        `Maksimal: 50MB\n\n` +
                        `⏳ *Meng-compress video...*`
                });

                const compressedFile = path.join(tempDir, `twt_compressed_${timestamp}.mp4`);
                await compressVideo(tempFile, compressedFile);
                finalFile = compressedFile;

                const newStats = fs.statSync(compressedFile);
                const newSize = formatFileSize(newStats.size);
                console.log(`Video compressed: ${fileSize} -> ${newSize}`);
            }
        }

        // Update status
        await sock.editMessage(chatId, processingMsg, {
            text: `✅ *${media.type.toUpperCase()} Siap!*\n\n` +
                `Ukuran: ${formatFileSize(fs.statSync(finalFile).size)}\n` +
                `⏳ *Mengirim ke WhatsApp...*`
        });

        // Send based on media type
        switch (media.type) {
            case 'video':
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(finalFile),
                    mimetype: "video/mp4",
                    caption: `🎬 *Video dari Twitter*\n\n` +
                        `_Downloaded via Twitter Downloader_`
                });
                break;

            case 'gif':
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(finalFile),
                    mimetype: "video/mp4",
                    caption: `🔄 *GIF dari Twitter*\n\n` +
                        `_Downloaded via Twitter Downloader_`
                });
                break;

            case 'photo':
                await sock.sendMessage(chatId, {
                    image: fs.readFileSync(finalFile),
                    caption: `📸 *Gambar dari Twitter*\n\n` +
                        `_Downloaded via Twitter Downloader_`
                });
                break;

            default:
                await sock.sendMessage(chatId, {
                    text: `📁 *File dari Twitter*\n\n` +
                        `Tipe: ${media.type}\n` +
                        `Ukuran: ${fileSize}\n\n` +
                        `_Downloaded via Twitter Downloader_`
                });
        }

        // Delete processing message
        await sock.deleteMessage(chatId, processingMsg.key);

        // Send success message
        await sock.sendMessage(chatId, {
            text: `✅ *Download Berhasil!*\n\n` +
                `Media Twitter berhasil didownload!\n\n` +
                `Ingin download postingan lain?\n` +
                `Ketik: \`.twt <link twitter>\``
        });

        // Clean up temp files
        setTimeout(() => {
            try {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                if (fs.existsSync(finalFile) && finalFile !== tempFile) fs.unlinkSync(finalFile);
            } catch (e) {
                console.error('Gagal hapus temp files:', e.message);
            }
        }, 10000);

    } catch (error) {
        console.error('Send single media error:', error);
        throw error;
    }
}

// Send multiple media as album
async function sendMultipleMedia(sock, chatId, mediaList, timestamp, tempDir, processingMsg) {
    try {
        const downloadedFiles = [];

        // Update status
        await sock.editMessage(chatId, processingMsg, {
            text: `📥 *Mendownload ${mediaList.length} media...*\n\n` +
                `⏳ Ini mungkin butuh beberapa saat...`
        });

        // Download all media
        for (let i = 0; i < mediaList.length; i++) {
            const media = mediaList[i];
            const fileExt = getFileExtension(media.type);
            const tempFile = path.join(tempDir, `twt_${timestamp}_${i}.${fileExt}`);

            try {
                await downloadFile(media.url, tempFile);
                downloadedFiles.push({
                    path: tempFile,
                    type: media.type,
                    index: i
                });

                // Update progress
                await sock.editMessage(chatId, processingMsg, {
                    text: `📥 *Mendownload ${mediaList.length} media...*\n\n` +
                        `✅ ${i + 1}/${mediaList.length} selesai\n` +
                        `⏳ Sedang berjalan...`
                });

            } catch (downloadError) {
                console.error(`Gagal download media ${i}:`, downloadError.message);
            }
        }

        if (downloadedFiles.length === 0) {
            throw new Error('Gagal download semua media');
        }

        // Update status
        await sock.editMessage(chatId, processingMsg, {
            text: `✅ *Semua Media Siap!*\n\n` +
                `Total: ${downloadedFiles.length} file\n` +
                `⏳ *Mengirim ke WhatsApp...*`
        });

        // Group by type
        const photos = downloadedFiles.filter(f => f.type === 'photo');
        const videos = downloadedFiles.filter(f => f.type === 'video' || f.type === 'gif');

        // Send photos as album (max 10 photos)
        if (photos.length > 0) {
            const photoLimit = Math.min(photos.length, 10);
            const photoStreams = photos.slice(0, photoLimit).map(p => fs.readFileSync(p.path));

            if (photoStreams.length === 1) {
                await sock.sendMessage(chatId, {
                    image: photoStreams[0],
                    caption: `📸 *${photos.length} Gambar dari Twitter*\n\n` +
                        `_Downloaded via Twitter Downloader_`
                });
            } else {
                await sock.sendMessage(chatId, {
                    image: photoStreams[0],
                    caption: `📸 *${photos.length} Gambar dari Twitter*\n\n` +
                        `_Downloaded via Twitter Downloader_`
                });

                // Send remaining photos
                for (let i = 1; i < photoStreams.length; i++) {
                    await sock.sendMessage(chatId, {
                        image: photoStreams[i]
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to avoid rate limit
                }
            }
        }

        // Send videos (one by one)
        if (videos.length > 0) {
            for (const video of videos) {
                try {
                    await sock.sendMessage(chatId, {
                        video: fs.readFileSync(video.path),
                        mimetype: "video/mp4",
                        caption: video.type === 'gif' ?
                            `🔄 GIF dari Twitter` :
                            `🎬 Video dari Twitter`
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay
                } catch (videoError) {
                    console.error('Gagal kirim video:', videoError.message);
                }
            }
        }

        // Delete processing message
        await sock.deleteMessage(chatId, processingMsg.key);

        // Send success message
        await sock.sendMessage(chatId, {
            text: `✅ *${downloadedFiles.length} Media Berhasil Didownload!*\n\n` +
                `Postingan Twitter berhasil didownload!\n\n` +
                `Ingin download postingan lain?\n` +
                `Ketik: \`.twt <link twitter>\``
        });

        // Clean up temp files
        setTimeout(() => {
            downloadedFiles.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (e) {
                    console.error(`Gagal hapus file ${file.path}:`, e.message);
                }
            });
        }, 15000);

    } catch (error) {
        console.error('Send multiple media error:', error);
        throw error;
    }
}

// Get file extension based on media type
function getFileExtension(type) {
    switch (type) {
        case 'video':
        case 'gif':
            return 'mp4';
        case 'photo':
            return 'jpg';
        default:
            return 'bin';
    }
}

// Simple version for quick downloads
async function twitterSimpleCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `🐦 *Twitter Downloader*\n\n` +
                    `Gunakan: .twt <link twitter>\n` +
                    `.twitter <link twitter>\n` +
                    `.x <link x>\n\n` +
                    `Contoh:\n` +
                    `.twt https://twitter.com/user/status/123\n` +
                    `.x https://x.com/user/status/123`
            }, { quoted: message });
        }

        // Quick validation
        if (!url.includes('twitter.com') && !url.includes('x.com')) {
            return await sock.sendMessage(chatId, {
                text: '❌ Bukan link Twitter/X!'
            }, { quoted: message });
        }

        const processingMsg = await sock.sendMessage(chatId, {
            text: '⏳ Mendownload dari Twitter...'
        }, { quoted: message });

        // Extract tweet ID
        const tweetId = extractTweetId(url);
        if (!tweetId) {
            await sock.editMessage(chatId, processingMsg, {
                text: '❌ Link tidak valid!'
            });
            return;
        }

        // Try vxtwitter API (most reliable)
        try {
            const response = await axios.get(`https://api.vxtwitter.com/Twitter/status/${tweetId}`, {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const data = response.data;

            if (data.media_extended && data.media_extended.length > 0) {
                const media = data.media_extended[0];

                if (media.type === 'video' || media.type === 'gif') {
                    const variants = media.variants || [];
                    const videoUrl = variants.find(v => v.content_type === 'video/mp4')?.url;

                    if (videoUrl) {
                        await sock.sendMessage(chatId, {
                            video: { url: videoUrl },
                            mimetype: "video/mp4",
                            caption: `🎬 Video dari Twitter`
                        });
                    }
                } else if (media.type === 'photo') {
                    await sock.sendMessage(chatId, {
                        image: { url: media.url },
                        caption: `📸 Gambar dari Twitter`
                    });
                }

                await sock.deleteMessage(chatId, processingMsg.key);
                return;
            }
        } catch (apiError) {
            console.log('vxtwitter failed, trying alternative...');
        }

        // Try fxtwitter API
        try {
            const response = await axios.get(`https://api.fxtwitter.com/status/${tweetId}`, {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const data = response.data;
            const tweet = data.tweet;

            if (tweet?.media?.videos?.[0]?.url) {
                await sock.sendMessage(chatId, {
                    video: { url: tweet.media.videos[0].url },
                    mimetype: "video/mp4",
                    caption: `🎬 Video dari Twitter`
                });
            } else if (tweet?.media?.photos?.[0]?.url) {
                await sock.sendMessage(chatId, {
                    image: { url: tweet.media.photos[0].url },
                    caption: `📸 Gambar dari Twitter`
                });
            }

            await sock.deleteMessage(chatId, processingMsg.key);
            return;

        } catch (error) {
            console.log('fxtwitter failed');
        }

        await sock.editMessage(chatId, processingMsg, {
            text: '❌ Gagal download! Coba link lain.'
        });

    } catch (error) {
        console.error('Twitter simple error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error sistem! Coba lagi nanti.'
        }, { quoted: message });
    }
}

// Export for multiple commands
module.exports = {
    twitter: twitterCommand,
    twt: twitterCommand,
    x: twitterCommand,
    twitterSimple: twitterSimpleCommand
};