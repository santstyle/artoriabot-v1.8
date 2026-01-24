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
    }, 300000); 
};

const convertToVideo = async (sock, quotedMessage, chatId, sender, args) => {
    try {
        const stickerMessage = quotedMessage?.stickerMessage || quotedMessage?.message?.stickerMessage;
        if (!stickerMessage) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Balas pesan stiker dengan perintah *.tovideo* untuk mengonversi ke video.'
            });
            return;
        }

        const isAnimated = stickerMessage.isAnimated || false;
        if (!isAnimated) {
            await sock.sendMessage(chatId, {
                text: 'Fitur .tovideo hanya untuk stiker GIF atau video. Gunakan *.toimage* untuk stiker biasa.'
            });
            return;
        }

        const stickerFilePath = path.join(tempDir, `sticker_${Date.now()}.webp`);
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await fsPromises.writeFile(stickerFilePath, buffer);

        const outputVideoPath = path.join(tempDir, `video_${Date.now()}.mp4`);

        const ffmpegCommand = `ffmpeg -i "${stickerFilePath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -movflags +faststart "${outputVideoPath}"`;

        await execPromise(ffmpegCommand);

        const videoBuffer = await fsPromises.readFile(outputVideoPath);
        await sock.sendMessage(chatId, {
            video: videoBuffer,
            caption: '🎥 Stiker GIF berhasil dikonversi ke video!'
        });

        scheduleFileDeletion(outputVideoPath);
        scheduleFileDeletion(stickerFilePath);

    } catch (error) {
        console.error('Error converting to video:', error);
        await sock.sendMessage(chatId, {
            text: 'Gagal mengonversi ke video. Pastikan stiker GIF valid.'
        });
    }
};

module.exports = convertToVideo;
