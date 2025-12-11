const sharp = require('sharp');
const fs = require('fs');
const fsPromises = require('fs/promises');
const fse = require('fs-extra');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            await fse.remove(filePath);
            console.log(`File deleted: ${filePath}`);
        } catch (error) {
            console.error(`Failed to delete file:`, error);
        }
    }, 300000); // 5 menit
};

const convertSticker = async (sock, quotedMessage, chatId, sender, args) => {
    try {
        const stickerMessage = quotedMessage?.stickerMessage || quotedMessage?.message?.stickerMessage;
        if (!stickerMessage) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Balas pesan stiker dengan perintah *.toimage* atau *.tovideo* untuk mengonversi.'
            });
            return;
        }

        // Cek apakah stiker adalah animasi (GIF/WebP animasi)
        const isAnimated = stickerMessage.isAnimated || false;
        const command = args[0]?.toLowerCase() || 'toimage';

        // Download stiker
        const stickerFilePath = path.join(tempDir, `sticker_${Date.now()}.webp`);
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await fsPromises.writeFile(stickerFilePath, buffer);

        if (command === 'toimage' || command === '.toimage') {
            await convertToImage(sock, chatId, stickerFilePath, isAnimated);
        } else if (command === 'tovideo' || command === '.tovideo') {
            await sock.sendMessage(chatId, {
                text: '❌ Fitur konversi ke video sedang tidak tersedia. Gunakan *.toimage* untuk mengonversi stiker ke gambar.'
            });
            scheduleFileDeletion(stickerFilePath);
            return;
        } else {
            await sock.sendMessage(chatId, {
                text: '❌ Perintah tidak valid. Gunakan:\n*.toimage* - Konversi ke gambar\n*.tovideo* - Konversi ke video (untuk stiker GIF)'
            });
            scheduleFileDeletion(stickerFilePath);
        }

    } catch (error) {
        console.error('Error converting sticker:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Terjadi kesalahan saat mengonversi stiker. Pastikan stiker valid.'
        });
    }
};

// Fungsi untuk konversi ke gambar
const convertToImage = async (sock, chatId, stickerFilePath, isAnimated) => {
    try {
        const outputImagePath = path.join(tempDir, `image_${Date.now()}.png`);

        if (isAnimated) {
            // Untuk stiker animasi, ambil frame pertama
            await sharp(stickerFilePath, { animated: true, pages: 1 })
                .toFormat('png')
                .toFile(outputImagePath);

            const imageBuffer = await fsPromises.readFile(outputImagePath);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: '🖼️ Stiker GIF berhasil dikonversi ke gambar (frame pertama)!'
            });
        } else {
            // Untuk stiker biasa
            await sharp(stickerFilePath)
                .toFormat('png')
                .toFile(outputImagePath);

            const imageBuffer = await fsPromises.readFile(outputImagePath);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: '🖼️ Stiker berhasil dikonversi ke gambar!'
            });
        }

        scheduleFileDeletion(outputImagePath);
        scheduleFileDeletion(stickerFilePath);
    } catch (error) {
        console.error('Error converting to image:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Gagal mengonversi ke gambar. Pastikan stiker tidak rusak.'
        });
        scheduleFileDeletion(stickerFilePath);
    }
};



// Export fungsi utama
module.exports = convertSticker;
