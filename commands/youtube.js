const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);

async function youtubeCommand(sock, chatId, message, command) {
    let tempFile = null;

    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        let url = '';
        if (text.includes('.youtube ')) {
            url = text.split('.youtube ')[1].trim();
        } else if (text.includes('.yt ')) {
            url = text.split('.yt ')[1].trim();
        }

        if (!url) {
            await sock.sendMessage(chatId, {
                text: `YouTube Downloader\n\nFormat: .yt <link-youtube>\nContoh: .yt https://youtu.be/dQw4w9WgXcQ`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `Memproses YouTube\n\nURL: ${url}\n\nMohon tunggu...`
        }, { quoted: message });

        function extractVideoId(url) {
            const patterns = [
                /youtu\.be\/([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            return null;
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
            await sock.sendMessage(chatId, {
                text: `Link YouTube tidak valid\n\nContoh: .yt https://youtu.be/dQw4w9WgXcQ`
            });
            return;
        }

        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        try {
            await execPromise('yt-dlp --version');
        } catch (error) {
            await sock.sendMessage(chatId, {
                text: `yt-dlp belum terinstall\n\nInstall dengan:\npip install yt-dlp\n\nSetelah install, restart bot.`
            });
            return;
        }

        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        tempFile = path.join(tempDir, `youtube_${Date.now()}.mp4`);

        const downloadCmd = `yt-dlp --js-runtimes node -f "best[ext=mp4][filesize<50M]/best[ext=mp4]" --merge-output-format mp4 -o "${tempFile}" "${youtubeUrl}"`;

        console.log('Download command:', downloadCmd);

        try {
            const { stdout, stderr } = await execPromise(downloadCmd, {
                timeout: 180000, 
                maxBuffer: 10 * 1024 * 1024
            });

            console.log('Download stdout:', stdout.substring(0, 200));
            if (stderr) console.log('Download stderr:', stderr.substring(0, 200));

        } catch (downloadError) {
            console.log('Download error, trying fallback format...');

            const fallbackCmd = `yt-dlp --js-runtimes node -f "18/22/136+140" --merge-output-format mp4 -o "${tempFile}" "${youtubeUrl}"`;
            await execPromise(fallbackCmd, {
                timeout: 180000,
                maxBuffer: 10 * 1024 * 1024
            });
        }

        if (!fs.existsSync(tempFile)) {
            throw new Error('File tidak berhasil didownload');
        }

        const fileStats = fs.statSync(tempFile);
        if (fileStats.size === 0) {
            throw new Error('File kosong (0 bytes)');
        }

        const fileBuffer = fs.readFileSync(tempFile, { length: 8 });
        const fileHeader = fileBuffer.toString('hex', 0, 8);

        if (!fileHeader.includes('66747970') && !fileHeader.includes('000000')) {
            console.log('File header tidak valid:', fileHeader);
            throw new Error('File video rusak atau format tidak didukung');
        }

        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

        await sock.sendMessage(chatId, {
            text: `Download selesai\nUkuran: ${fileSizeMB} MB\nMengirim video...`
        });

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(tempFile),
            mimetype: 'video/mp4',
            fileName: `youtube_${videoId}.mp4`
        });

        await sock.sendMessage(chatId, {
            text: `✅ Media Berhasil Didownload\n\nUntuk download lagi:\n \`.yt <link-youtube>\``
        });

    } catch (error) {
        console.error('YouTube download error:', error);

        let errorMsg = '';
        if (error.message.includes('rusak') || error.message.includes('format')) {
            errorMsg = `File video rusak\n\nCoba solusi:\n1. Coba video lain\n2. Update yt-dlp: pip install -U yt-dlp\n3. Gunakan link alternatif:\nhttps://yt1s.io/`;
        } else if (error.message.includes('timeout')) {
            errorMsg = `Timeout download\n\nVideo terlalu panjang atau koneksi lambat.\nCoba video yang lebih pendek (<3 menit).`;
        } else {
            errorMsg = `Error: ${error.message}\n\nCoba video lain atau coba lagi nanti.`;
        }

        await sock.sendMessage(chatId, { text: errorMsg });

    } finally {
        if (tempFile && fs.existsSync(tempFile)) {
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempFile);
                    console.log('Temp file cleaned');
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