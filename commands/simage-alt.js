const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const util = require('util');
const execPromise = util.promisify(exec);

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Fungsi untuk menjadwalkan penghapusan file
const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            await fsPromises.unlink(filePath).catch(() => { });
            console.log(`File dihapus: ${filePath}`);
        } catch (error) {
            console.error('Gagal menghapus file:', error);
        }
    }, 300000); // 5 menit
};

async function simageCommand(sock, quotedMessage, chatId, sender, args) {
    try {
        // Cek apakah ada stiker dalam pesan yang dibalas
        const stickerMessage = quotedMessage?.stickerMessage || quotedMessage?.message?.stickerMessage;
        if (!stickerMessage) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Balas pesan stiker dengan perintah *.toimage* untuk mengonversi!'
            });
            return;
        }

        // Download stiker
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Buat path file sementara
        const tempSticker = path.join(tempDir, `sticker_${Date.now()}.webp`);
        const tempOutput = path.join(tempDir, `image_${Date.now()}.png`);

        // Simpan stiker ke file
        await fsPromises.writeFile(tempSticker, buffer);

        // Coba gunakan sharp terlebih dahulu (jika ada)
        try {
            const sharp = require('sharp');
            await sharp(tempSticker)
                .toFormat('png')
                .toFile(tempOutput);

        } catch (sharpError) {
            console.log('Sharp tidak tersedia, menggunakan ffmpeg...');

            // Fallback ke ffmpeg jika sharp tidak ada
            try {
                // Gunakan ffmpeg untuk konversi WebP ke PNG
                await execPromise(`"${ffmpeg}" -i "${tempSticker}" -vframes 1 "${tempOutput}"`);
            } catch (ffmpegError) {
                // Jika ffmpeg gagal, coba metode alternatif
                console.error('Error ffmpeg:', ffmpegError);
                throw new Error('Gagal mengonversi stiker ke gambar');
            }
        }

        // Baca file hasil konversi
        const imageBuffer = await fsPromises.readFile(tempOutput);

        // Kirim gambar ke chat
        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: '🖼️ Stiker berhasil dikonversi ke gambar!'
        });

        // Jadwalkan penghapusan file sementara
        scheduleFileDeletion(tempSticker);
        scheduleFileDeletion(tempOutput);

    } catch (error) {
        console.error('Error dalam perintah simage:', error);

        // Pesan error yang lebih informatif
        let errorMessage = '❌ Gagal mengonversi stiker ke gambar!';

        if (error.message.includes('ffmpeg')) {
            errorMessage += '\n⚠️ Pastikan ffmpeg terinstall dengan benar.';
        } else if (error.message.includes('Sharp')) {
            errorMessage += '\n⚠️ Coba install sharp: npm install sharp';
        }

        await sock.sendMessage(chatId, { text: errorMessage });

        // Coba bersihkan file temporary jika ada error
        try {
            if (tempSticker && fs.existsSync(tempSticker)) {
                await fsPromises.unlink(tempSticker);
            }
            if (tempOutput && fs.existsSync(tempOutput)) {
                await fsPromises.unlink(tempOutput);
            }
        } catch (cleanupError) {
            console.error('Error cleanup:', cleanupError);
        }
    }
}

module.exports = simageCommand;