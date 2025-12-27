// youtube-simple.js
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

async function youtubeCommand(sock, chatId, message, command) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ');
        const searchQuery = args.slice(1).join(' ');

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: '🎬 *YouTube Downloader*\n\n' +
                    'Gunakan: .yt <link atau judul>\n' +
                    'Contoh: .yt https://youtu.be/VIDEO_ID\n' +
                    'Contoh: .yt naruto opening\n\n' +
                    '⚠️ Maksimal 3 menit untuk hasil terbaik'
            }, { quoted: message });
        }

        const processingMsg = await sock.sendMessage(chatId, {
            text: '🔍 *Memproses...*'
        }, { quoted: message });

        let videoUrl = '';

        // Cek apakah link YouTube
        if (searchQuery.includes('youtu.be') || searchQuery.includes('youtube.com')) {
            videoUrl = searchQuery;
        } else {
            // Search video
            const result = await yts(searchQuery);
            if (!result.videos.length) {
                await sock.sendMessage(chatId, {
                    text: '❌ Video tidak ditemukan!'
                }, { edit: processingMsg.key });
                return;
            }
            videoUrl = result.videos[0].url;
        }

        // Validasi URL
        if (!ytdl.validateURL(videoUrl)) {
            await sock.sendMessage(chatId, {
                text: '❌ Link YouTube tidak valid!'
            }, { edit: processingMsg.key });
            return;
        }

        // Get video info
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title;

        // Cek durasi
        const duration = parseInt(info.videoDetails.lengthSeconds);
        if (duration > 180) { // 3 menit
            await sock.sendMessage(chatId, {
                text: `⚠️ Video terlalu panjang (${Math.floor(duration / 60)} menit)\nMaksimal 3 menit!`
            }, { edit: processingMsg.key });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `⬇️ *Mendownload: ${title}*`
        }, { edit: processingMsg.key });

        // Download video
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const tempFile = path.join(tempDir, `yt_${Date.now()}.mp4`);
        const stream = ytdl(videoUrl, { quality: 'lowest' });
        const writeStream = fs.createWriteStream(tempFile);

        await new Promise((resolve, reject) => {
            stream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Kirim video
        await sock.sendMessage(chatId, {
            video: fs.readFileSync(tempFile),
            caption: `✅ ${title}`
        });

        await sock.deleteMessage(chatId, processingMsg.key);
        fs.unlinkSync(tempFile);

    } catch (error) {
        console.error('YouTube error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Gagal download video!\nCoba video lain atau link yang berbeda.'
        });
    }
}

module.exports = {
    youtube: youtubeCommand,
    yt: youtubeCommand
};