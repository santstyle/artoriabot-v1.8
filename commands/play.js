const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

async function playCommand(sock, chatId, message, command) {
    let tempFile = null;

    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        // Ambil URL
        let url = '';
        if (text.includes('.play ')) {
            url = text.split('.play ')[1].trim();
        } else if (text.includes('.song ')) {
            url = text.split('.song ')[1].trim();
        } else if (text.includes('.music ')) {
            url = text.split('.music ')[1].trim();
        }

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: 'Download Audio YouTube\n\n\`.play <link youtube>\`'
            }, { quoted: message });
        }

        // PESAN 1: Proses awal
        const processingMsg = await sock.sendMessage(chatId, {
            text: 'Memproses Audio YouTube\n\nURL: ' + url + '\n\nMohon tunggu...'
        }, { quoted: message });

        // Extract video ID sederhana
        function getVideoId(url) {
            if (url.includes('youtu.be/')) {
                const parts = url.split('youtu.be/');
                if (parts[1]) {
                    return parts[1].split('?')[0].split('/')[0];
                }
            }
            if (url.includes('youtube.com/watch?v=')) {
                const parts = url.split('v=');
                if (parts[1]) {
                    return parts[1].split('&')[0];
                }
            }
            return null;
        }

        const videoId = getVideoId(url);
        if (!videoId) {
            await sock.sendMessage(chatId, {
                text: 'Link YouTube tidak valid\n\nContoh: .play <url youtube>'
            });
            return;
        }

        const youtubeUrl = 'https://www.youtube.com/watch?v=' + videoId;

        // Cek yt-dlp
        try {
            await execPromise('yt-dlp --version');
        } catch (error) {
            await sock.sendMessage(chatId, {
                text: 'yt-dlp belum terinstall\n\nInstall dengan:\npip install yt-dlp\n\nSetelah install, restart bot.'
            });
            return;
        }

        // Update pesan 1
        await sock.sendMessage(chatId, {
            text: 'Memproses Audio YouTube\n\nURL: ' + url + '\n\nVideo ID: ' + videoId + '\n\nMulai download...'
        });

        // Buat folder temp
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        tempFile = path.join(tempDir, 'audio_' + Date.now() + '.mp3');

        // DOWNLOAD DENGAN yt-dlp - TIDAK PAKE API!
        console.log('Downloading audio with yt-dlp for video:', videoId);

        // Command yt-dlp untuk download audio
        const downloadCmd = 'yt-dlp -x --audio-format mp3 -o "' + tempFile + '" "' + youtubeUrl + '"';

        try {
            await execPromise(downloadCmd, { timeout: 120000 });
            console.log('Download success');
        } catch (downloadError) {
            console.log('Download error, trying alternative...');

            // Coba format lain
            const altCmd = 'yt-dlp -f "bestaudio" --extract-audio --audio-format mp3 -o "' + tempFile + '" "' + youtubeUrl + '"';
            await execPromise(altCmd, { timeout: 120000 });
        }

        // Cek file
        if (!fs.existsSync(tempFile)) {
            throw new Error('File tidak berhasil didownload');
        }

        const fileStats = fs.statSync(tempFile);
        if (fileStats.size === 0) {
            throw new Error('File kosong (0 bytes)');
        }

        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

        // Update pesan 2
        await sock.sendMessage(chatId, {
            text: 'Download selesai\nUkuran: ' + fileSizeMB + ' MB\nMengirim audio...'
        });

        // Kirim audio file TANPA CAPTION
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(tempFile),
            mimetype: 'audio/mpeg',
            fileName: 'youtube_' + videoId + '.mp3'
        });

        // Kirim pesan sukses
        await sock.sendMessage(chatId, {
            text: 'Audio Berhasil Didownload\n\nLagu YouTube telah dikirim\n\nUntuk download lagi:\n.play <link-youtube>'
        });

    } catch (error) {
        console.error('Play error:', error);

        await sock.sendMessage(chatId, {
            text: 'Gagal Download Audio\n\nError: ' + error.message + '\n\nCoba:\n1. Pastikan yt-dlp terinstall\n2. Video lain yang lebih pendek\n3. Link yang valid'
        });

    } finally {
        // Cleanup
        if (tempFile && fs.existsSync(tempFile)) {
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempFile);
                    console.log('Temp audio file cleaned');
                } catch (e) {
                    console.error('Cannot delete temp file');
                }
            }, 10000);
        }
    }
}

// Export commands
module.exports = {
    play: playCommand,
    song: playCommand,
    music: playCommand
};