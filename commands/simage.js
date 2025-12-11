const { Jimp } = require('jimp');
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
        const command = args[0]?.toLowerCase() || 'simage';

        // Download stiker
        const stickerFilePath = path.join(tempDir, `sticker_${Date.now()}.webp`);
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await fsPromises.writeFile(stickerFilePath, buffer);

        if (command === 'toimage' || command === '.toimage') {
            await convertToImage(sock, chatId, stickerFilePath, isAnimated);
        } else if (command === 'tovideo' || command === '.tovideo') {
            if (!isAnimated) {
                await sock.sendMessage(chatId, {
                    text: '❌ Stiker ini tidak animasi (GIF). Gunakan *.toimage* untuk stiker biasa.'
                });
                scheduleFileDeletion(stickerFilePath);
                return;
            }
            await convertToVideo(sock, chatId, stickerFilePath);
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

// Fungsi untuk konversi ke video (MP4)
const convertToVideo = async (sock, chatId, stickerFilePath) => {
    try {
        const outputVideoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
        const tempFrameDir = path.join(tempDir, `frames_${Date.now()}`);

        await fsPromises.mkdir(tempFrameDir, { recursive: true });

        // Ekstrak frame dari WebP animasi menggunakan sharp
        const metadata = await sharp(stickerFilePath, { animated: true }).metadata();
        const frameCount = metadata.pages || 1;

        // Simpan setiap frame sebagai PNG
        for (let i = 0; i < frameCount; i++) {
            const framePath = path.join(tempFrameDir, `frame_${i.toString().padStart(3, '0')}.png`);
            await sharp(stickerFilePath, { page: i })
                .toFormat('png')
                .toFile(framePath);
        }

        // Konversi frame ke video MP4 menggunakan ffmpeg
        const framePattern = path.join(tempFrameDir, 'frame_%03d.png');

        try {
            // Cek apakah ffmpeg tersedia
            await execPromise('ffmpeg -version');

            // Konversi ke MP4 dengan ffmpeg
            const ffmpegCommand = `ffmpeg -framerate 10 -i "${framePattern}" -c:v libx264 -pix_fmt yuv420p -y "${outputVideoPath}"`;
            await execPromise(ffmpegCommand);

            const videoBuffer = await fsPromises.readFile(outputVideoPath);

            // Cek ukuran file video (WhatsApp limit: 16MB)
            const fileSizeMB = videoBuffer.length / (1024 * 1024);
            if (fileSizeMB > 16) {
                await sock.sendMessage(chatId, {
                    text: `❌ Video terlalu besar (${fileSizeMB.toFixed(2)}MB). WhatsApp hanya mendukung hingga 16MB.`
                });
            } else {
                await sock.sendMessage(chatId, {
                    video: videoBuffer,
                    caption: '🎥 Stiker GIF berhasil dikonversi ke video!',
                    gifPlayback: false
                });
            }

        } catch (ffmpegError) {
            console.error('FFmpeg error:', ffmpegError);

            // Fallback: Kirim sebagai GIF jika ffmpeg tidak tersedia
            const gifPath = path.join(tempDir, `gif_${Date.now()}.gif`);
            await sharp(stickerFilePath, { animated: true })
                .toFormat('gif')
                .toFile(gifPath);

            const gifBuffer = await fsPromises.readFile(gifPath);
            await sock.sendMessage(chatId, {
                video: gifBuffer,
                caption: '🎬 Stiker GIF berhasil dikonversi (format GIF)!',
                gifPlayback: true
            });

            scheduleFileDeletion(gifPath);
        }

        // Bersihkan file sementara
        await fse.remove(tempFrameDir);
        scheduleFileDeletion(outputVideoPath);
        scheduleFileDeletion(stickerFilePath);

    } catch (error) {
        console.error('Error converting to video:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Gagal mengonversi ke video. Pastikan stiker animasi dan bot memiliki ffmpeg.'
        });
        scheduleFileDeletion(stickerFilePath);
    }
};

// Export fungsi utama
module.exports = convertSticker;