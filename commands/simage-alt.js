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

const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            await fsPromises.unlink(filePath).catch(() => { });
            console.log(`File dihapus: ${filePath}`);
        } catch (error) {
            console.error('Gagal menghapus file:', error);
        }
    }, 300000); 
};

async function simageCommand(sock, quotedMessage, chatId, sender, args) {
    try {
        const stickerMessage = quotedMessage?.stickerMessage || quotedMessage?.message?.stickerMessage;
        if (!stickerMessage) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Balas pesan stiker dengan perintah *.toimage* untuk mengonversi!'
            });
            return;
        }

        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const tempSticker = path.join(tempDir, `sticker_${Date.now()}.webp`);
        const tempOutput = path.join(tempDir, `image_${Date.now()}.png`);

        await fsPromises.writeFile(tempSticker, buffer);

        try {
            const sharp = require('sharp');
            await sharp(tempSticker)
                .toFormat('png')
                .toFile(tempOutput);

        } catch (sharpError) {
            console.log('Sharp tidak tersedia, menggunakan ffmpeg...');

            try {
                await execPromise(`"${ffmpeg}" -i "${tempSticker}" -vframes 1 "${tempOutput}"`);
            } catch (ffmpegError) {
                console.error('Error ffmpeg:', ffmpegError);
                throw new Error('Gagal mengonversi stiker ke gambar');
            }
        }

        const imageBuffer = await fsPromises.readFile(tempOutput);

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: '🖼️ Stiker berhasil dikonversi ke gambar!'
        });

        scheduleFileDeletion(tempSticker);
        scheduleFileDeletion(tempOutput);

    } catch (error) {
        console.error('Error dalam perintah simage:', error);

        let errorMessage = '❌ Gagal mengonversi stiker ke gambar!';

        if (error.message.includes('ffmpeg')) {
            errorMessage += '\n⚠️ Pastikan ffmpeg terinstall dengan benar.';
        } else if (error.message.includes('Sharp')) {
            errorMessage += '\n⚠️ Coba install sharp: npm install sharp';
        }

        await sock.sendMessage(chatId, { text: errorMessage });

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