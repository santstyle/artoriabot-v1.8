const settings = require('./settings');
require('./config.js');

// === TAMBAHKAN BACKUP FFMPEG CONFIG DI SINI ===
const { exec } = require('child_process');

// Pastikan path FFmpeg diatur (cadangan untuk main.js)
if (!process.env.FFMPEG_PATH) {
    const path = require('path'); // <-- PINDAHKAN KE DALAM IF
    const ffmpegPath = path.join(__dirname, 'ffmpeg', 'bin', 'ffmpeg.exe');
    process.env.FFMPEG_PATH = ffmpegPath;
    console.log('Path FFmpeg diatur di main.js:', ffmpegPath);
}
// === END BACKUP FFMPEG ===

const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const fs = require('fs');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const path = require('path'); // <-- INI SATU-SATUNYA DEKLARASI PATH DI MAIN.JS
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn, isSudo } = require('./lib/index');


// Import command
const tagAllCommand = require('./commands/tagall');
const { hidetagCommand } = require('./commands/hidetag');
const helpCommand = require('./commands/help');
const banCommand = require('./commands/ban');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const isAdmin = require('./lib/isAdmin');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const { handleAntilinkCommand, handleLinkDetection } = require('./commands/antilink');
const { handleAntitagCommand, handleTagDetection } = require('./commands/antitag');
const { Antilink } = require('./lib/antilink');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const toimageCommand = require('./commands/toimage');
const { lyricsCommand } = require('./commands/lyrics');
const { clearCommand } = require('./commands/clear');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const welcomeCommand = require('./commands/welcome');
const goodbyeCommand = require('./commands/goodbye');
const { handleAntiBadwordCommand, handleBadwordDetection } = require('./lib/antibadword');
const antibadwordCommand = require('./commands/antibadword');
const { handleChatbotCommand, handleChatbotResponse } = require('./commands/chatbot');
const takeCommand = require('./commands/take');
const groupInfoCommand = require('./commands/groupinfo');
const resetlinkCommand = require('./commands/resetlink');
const staffCommand = require('./commands/staff');
const setLangCommand = require('./commands/setlang');
const broadcastCommand = require('./commands/broadcast');
const instagramCommand = require('./commands/instagram');
const facebookCommand = require('./commands/facebook');
const playCommand = require('./commands/play');
const tiktokCommand = require('./commands/tiktok');
const songCommand = require('./commands/song');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const { addCommandReaction, handleAreactCommand } = require('./lib/reactions');
const videoCommand = require('./commands/video');
const stickercropCommand = require('./commands/stickercrop');
const { startAbsen, addAbsen, finishAbsen } = require('./commands/absen');
// Global settings
global.packname = settings.packname;
global.author = settings.author;

// Tambahkan ini di dekat bagian atas main.js dengan konfigurasi global lainnya

async function handleMessages(sock, messageUpdate, printLog) {
    let chatId = null; // Declare chatId at function scope
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;



        // Simpan pesan untuk fitur antidelete
        if (message.message) {
            storeMessage(message);
        }

        // Handle pencabutan pesan
        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        const senderId = message.key.participant || message.key.remoteJid;
        chatId = message.key.remoteJid; // Assign to the scoped variable
        const isGroup = chatId.endsWith('@g.us');
        const senderIsSudo = await isSudo(senderId);

        const userMessage = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            ''
        ).toLowerCase().replace(/\.\s+/g, '.').trim();

        // Pertahankan pesan asli untuk command seperti .tag yang membutuhkan huruf asli
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        // Hanya log penggunaan command
        if (userMessage.startsWith('.')) {
            console.log(`Command digunakan di ${isGroup ? 'grup' : 'privat'}: ${userMessage}`);
        }

        // Cek apakah pengguna dibanned (lewati cek ban untuk command .unban)
        if (isBanned(senderId) && !userMessage.startsWith('.unban')) {
            // Hanya merespons sesekali untuk menghindari spam
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: 'Anda dibanned dari penggunaan bot. Hubungi admin untuk dibuka.'
                });
            }
            return;
        }

        // Pertama cek apakah ini langkah permainan
        if (/^[1-9]$/.test(userMessage) || userMessage.toLowerCase() === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // Cek kata kasar PERTAMA, sebelum pemrosesan LAINNYA
        if (isGroup && userMessage) {
            await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
        }

        // Kemudian cek prefix command
        if (!userMessage.startsWith('.')) {
            if (isGroup) {
                // Proses pesan non-command terlebih dahulu
                await handleChatbotResponse(sock, chatId, message, rawText, senderId);
                await Antilink(message, sock);
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
                await handleTagDetection(sock, chatId, message, senderId);
            }
            return;
        }

        // Daftar command admin
        const adminCommands = ['.mute', '.unmute', '.ban', '.unban', '.kick', '.tagall', '.hidetag', '.antilink', '.antitag'];
        const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));

        // Daftar command owner
        const ownerCommands = ['.mode', '.autostatus', '.antidelete', '.cleartmp', '.setpp', '.clearsession', '.areact', '.autoreact'];
        const isOwnerCommand = ownerCommands.some(cmd => userMessage.startsWith(cmd));

        let isSenderAdmin = false;
        let isBotAdmin = false;

        // Cek status admin hanya untuk command admin di grup
        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, senderId, message);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Mohon jadikan bot sebagai admin untuk menggunakan command admin.' }, { quoted: message });
                return;
            }

            if (
                userMessage.startsWith('.mute') ||
                userMessage === '.unmute' ||
                userMessage.startsWith('.ban') ||
                userMessage.startsWith('.unban')
            ) {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: 'Maaf, hanya admin grup yang bisa menggunakan command ini.'
                    });
                    return;
                }
            }
        }

        // Cek status owner untuk command owner
        if (isOwnerCommand) {
            if (!message.key.fromMe && !senderIsSudo) {
                await sock.sendMessage(chatId, { text: 'Command ini hanya tersedia untuk owner atau sudo!' });
                return;
            }
        }

        // Tambahkan ini di awal logika penanganan pesan, sebelum memproses command
        try {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            // Izinkan owner menggunakan bot bahkan dalam mode privat
            if (!data.isPublic && !message.key.fromMe && !senderIsSudo) {
                return; // Abaikan diam-diam pesan dari non-owner saat dalam mode privat
            }
        } catch (error) {
            console.error('Error memeriksa mode akses:', error);
            // Default ke mode publik jika ada error membaca file
        }

        // Penangan command - Eksekusi command segera tanpa menunggu indikator mengetik
        // Kami akan menunjukkan indikator mengetik setelah eksekusi command jika diperlukan
        let commandExecuted = false;

        switch (true) {
            case userMessage === '.toimage': {
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMessage?.stickerMessage) {
                    await toimageCommand(sock, quotedMessage, chatId, senderId, ['toimage']);
                } else {
                    await sock.sendMessage(chatId, { text: 'Balas stiker dengan command .toimage untuk mengonversinya.' });
                }
                commandExecuted = true;
                break;
            }
            case userMessage === '.startabsen':
                const startAbsenText = rawText.slice(11).trim();
                await startAbsen(sock, message, startAbsenText);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.absen'):
                const absenText = rawText.replace(/^\.?\s*absen\s*/i, '').trim();
                await addAbsen(sock, message, absenText);
                commandExecuted = true;
                break;
            case userMessage === '.finishabsen':
                await finishAbsen(sock, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.kick'):
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                break;
            case userMessage.startsWith('.mute'):
                const muteDuration = parseInt(userMessage.split(' ')[1]);
                if (isNaN(muteDuration)) {
                    await sock.sendMessage(chatId, { text: 'Mohon berikan jumlah menit yang valid.\ncontoh untuk mute 10 menit\n.mute 10' });
                } else {
                    await muteCommand(sock, chatId, senderId, muteDuration);
                }
                break;
            case userMessage === '.unmute':
                await unmuteCommand(sock, chatId, senderId);
                break;
            case userMessage.startsWith('.ban'):
                await banCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.unban'):
                await unbanCommand(sock, chatId, message);
                break;
            case userMessage === '.help' || userMessage === '.menu' || userMessage === '.bot' || userMessage === '.list':
                await helpCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '.sticker' || userMessage === '.s':
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.warnings'):
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                break;
            case userMessage.startsWith('.warn'):
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                break;
            case userMessage === '.delete' || userMessage === '.del':
                await deleteCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('.mode'):
                // Cek apakah pengirim adalah owner
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { text: 'Hanya owner bot yang bisa menggunakan command ini!' });
                    return;
                }
                // Baca data saat ini terlebih dahulu
                let data;
                try {
                    data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                } catch (error) {
                    console.error('Error membaca mode akses:', error);
                    await sock.sendMessage(chatId, { text: 'Gagal membaca status mode bot' });
                    return;
                }

                const action = userMessage.split(' ')[1]?.toLowerCase();
                // Jika tidak ada argumen, tampilkan status saat ini
                if (!action) {
                    const currentMode = data.isPublic ? 'publik' : 'privat';
                    await sock.sendMessage(chatId, {
                        text: `Mode bot saat ini: *${currentMode}*\n\nPenggunaan: .mode publik/privat\n\nContoh:\n.mode publik - Izinkan semua orang menggunakan bot\n.mode privat - Batasi hanya untuk owner`
                    });
                    return;
                }

                if (action !== 'public' && action !== 'private') {
                    await sock.sendMessage(chatId, {
                        text: 'Penggunaan: .mode public/private\n\nContoh:\n.mode public - Izinkan semua orang menggunakan bot\n.mode private - Batasi hanya untuk owner'
                    });
                    return;
                }

                try {
                    // Perbarui mode akses
                    data.isPublic = action === 'public';

                    // Simpan data yang diperbarui
                    fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));

                    await sock.sendMessage(chatId, { text: `Bot sekarang dalam mode *${action}*` });
                } catch (error) {
                    console.error('Error memperbarui mode akses:', error);
                    await sock.sendMessage(chatId, { text: 'Gagal memperbarui mode akses bot' });
                }
                break;
            case userMessage.startsWith('.setlang'):
                const lang = userMessage.split(' ')[1];
                if (!lang || (lang !== 'en' && lang !== 'id')) {
                    await sock.sendMessage(chatId, { text: 'Bahasa tidak valid. Gunakan .setlang en atau .setlang id' });
                    break;
                }
                await setLangCommand(sock, chatId, message, [lang]);
                break;
            case userMessage.startsWith('.bc'):
            case userMessage.startsWith('.broadcast'):
                const bcArgs = userMessage.split(' ').slice(1);
                await broadcastCommand(sock, chatId, message, bcArgs);
                break;
            case userMessage === '.owner':
                await ownerCommand(sock, chatId);
                break;
            case userMessage === '.tagall':
                if (isSenderAdmin || message.key.fromMe) {
                    await tagAllCommand(sock, chatId, senderId, message);
                } else {
                    await sock.sendMessage(chatId, { text: 'Maaf, hanya admin grup yang bisa menggunakan command .tagall.' }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.hidetag'):
                if (isSenderAdmin || message.key.fromMe) {
                    await hidetagCommand(sock, message, '.');
                } else {
                    await sock.sendMessage(chatId, { text: 'Fitur ini hanya bisa digunakan oleh admin grup.' }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.tag'):
                const messageText = rawText.slice(4).trim();  // gunakan rawText di sini, bukan userMessage
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage);
                break;
            case userMessage.startsWith('.antilink'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'Command ini hanya bisa digunakan di grup.'
                    });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Mohon jadikan bot sebagai admin terlebih dahulu.'
                    });
                    return;
                }
                await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin);
                break;
            case userMessage.startsWith('.antitag'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'Command ini hanya bisa digunakan di grup.'
                    });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Mohon jadikan bot sebagai admin terlebih dahulu.'
                    });
                    return;
                }
                await handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin);
                break;
            case userMessage === '.meme':
                await memeCommand(sock, chatId, message);
                break;
            case userMessage === '.joke':
                await jokeCommand(sock, chatId, message);
                break;
            case userMessage === '.quote':
                await quoteCommand(sock, chatId, message);
                break;
            case userMessage === '.fact':
                await factCommand(sock, chatId, message, message);
                break;
            case userMessage.startsWith('.weather'):
                const city = userMessage.slice(9).trim();
                if (city) {
                    await weatherCommand(sock, chatId, city);
                } else {
                    await sock.sendMessage(chatId, { text: 'Mohon tentukan kota, contoh: .weather London' });
                }
                break;
            case userMessage === '.news':
                await newsCommand(sock, chatId);
                break;
            case userMessage === '.topmembers':
                topMembers(sock, chatId, isGroup);
                break;
            case userMessage.startsWith('.lyrics'):
                const songTitle = userMessage.split(' ').slice(1).join(' ');
                await lyricsCommand(sock, chatId, songTitle, message);
                break;
            case userMessage === '.clear':
                if (isGroup) await clearCommand(sock, chatId);
                break;

            case userMessage === '.ping':
                await pingCommand(sock, chatId, message);
                break;
            case userMessage === '.alive':
                await aliveCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.blur'):
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                break;
            case userMessage.startsWith('.welcome'):
                if (isGroup) {
                    // Cek status admin jika belum dicek
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await welcomeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Maaf, hanya admin grup yang bisa menggunakan command ini.' });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup.' });
                }
                break;
            case userMessage.startsWith('.goodbye'):
                if (isGroup) {
                    // Cek status admin jika belum dicek
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await goodbyeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Maaf, hanya admin grup yang bisa menggunakan command ini.' });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup.' });
                }
                break;
            case userMessage === '.git':
            case userMessage === '.github':
            case userMessage === '.sc':
            case userMessage === '.script':
            case userMessage === '.repo':
                await githubCommand(sock, chatId);
                break;
            case userMessage.startsWith('.antibadword'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup.' });
                    return;
                }

                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;

                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: 'Bot harus menjadi admin untuk menggunakan fitur ini' });
                    return;
                }

                await antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;
            case userMessage.startsWith('.chatbot'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup.' });
                    return;
                }

                // Cek apakah pengirim adalah admin atau owner bot
                const chatbotAdminStatus = await isAdmin(sock, chatId, senderId);
                if (!chatbotAdminStatus.isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: 'Hanya admin atau owner bot yang bisa menggunakan command ini' });
                    return;
                }

                const match = userMessage.slice(8).trim();
                await handleChatbotCommand(sock, chatId, message, match);
                break;
            case userMessage.startsWith('.take'):
                const takeArgs = rawText.slice(5).trim().split(' ');
                await takeCommand(sock, chatId, message, takeArgs);
                break;
            case userMessage === '.flirt':
                await flirtCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.character'):
                await characterCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.waste'):
                await wastedCommand(sock, chatId, message);
                break;
            case userMessage === '.ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup!' });
                    return;
                }
                await shipCommand(sock, chatId, message);
                break;
            case userMessage === '.groupinfo' || userMessage === '.infogp' || userMessage === '.infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup!' });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                break;
            case userMessage === '.resetlink' || userMessage === '.revoke' || userMessage === '.anularlink':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup!' });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId);
                break;
            case userMessage === '.staff' || userMessage === '.admins' || userMessage === '.listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'Command ini hanya bisa digunakan di grup!' });
                    return;
                }
                await staffCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.emojimix') || userMessage.startsWith('.emix'):
                await emojimixCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tg') || userMessage.startsWith('.stickertelegram') || userMessage.startsWith('.tgsticker') || userMessage.startsWith('.telesticker'):
                await stickerTelegramCommand(sock, chatId, message);
                break;

            case userMessage === '.vv':
                await viewOnceCommand(sock, chatId, message);
                break;
            case userMessage === '.clearsession' || userMessage === '.clearsesi':
                await clearSessionCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.autostatus'):
                const autoStatusArgs = userMessage.split(' ').slice(1);
                await autoStatusCommand(sock, chatId, message, autoStatusArgs);
                break;
            case userMessage.startsWith('.antidelete'):
                const antideleteMatch = userMessage.slice(11).trim();
                await handleAntideleteCommand(sock, chatId, message, antideleteMatch);
                break;
            case userMessage === '.surrender':
                // Handle command surrender untuk permainan tictactoe
                await handleTicTacToeMove(sock, chatId, senderId, 'surrender');
                break;
            case userMessage === '.cleartmp':
                await clearTmpCommand(sock, chatId, message);
                break;
            case userMessage === '.setpp':
                await setProfilePicture(sock, chatId, message);
                break;
            case userMessage.startsWith('.instagram') || userMessage.startsWith('.insta') || userMessage.startsWith('.ig'):
                await instagramCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.fb') || userMessage.startsWith('.facebook'):
                await facebookCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.music'):
                await playCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.play') || userMessage.startsWith('.mp3') || userMessage.startsWith('.ytmp3') || userMessage.startsWith('.song'):
                await songCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.video') || userMessage.startsWith('.ytmp4'):
                await videoCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tiktok') || userMessage.startsWith('.tt'):
                await tiktokCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.gpt') || userMessage.startsWith('.gemini'):
                await aiCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.translate') || userMessage.startsWith('.trt'):
                const commandLength = userMessage.startsWith('.translate') ? 10 : 4;
                await handleTranslateCommand(sock, chatId, message, userMessage.slice(commandLength));
                return;
            case userMessage.startsWith('.ss') || userMessage.startsWith('.ssweb') || userMessage.startsWith('.screenshot'):
                const ssCommandLength = userMessage.startsWith('.screenshot') ? 11 : (userMessage.startsWith('.ssweb') ? 6 : 3);
                await handleSsCommand(sock, chatId, message, userMessage.slice(ssCommandLength).trim());
                break;
            case userMessage.startsWith('.areact') || userMessage.startsWith('.autoreact') || userMessage.startsWith('.autoreaction'):
                const isOwnerOrSudo = message.key.fromMe || senderIsSudo;
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudo);
                break;
            case userMessage.startsWith('.sudo'):
                await sudoCommand(sock, chatId, message);
                break;
            case userMessage === '.goodnight' || userMessage === '.lovenight' || userMessage === '.gn':
                await goodnightCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.quote'):
            case userMessage.startsWith('.waifu'):
            case userMessage.startsWith('.loli'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    let sub = parts[0].slice(1);
                    if (sub === 'facepalm') sub = 'face-palm';
                    if (sub === 'quote' || sub === 'animuquote') sub = 'quote';
                    await animeCommand(sock, chatId, message, [sub]);
                }
                break;
            case userMessage === '.crop':
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.pies'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await piesCommand(sock, chatId, message, args);
                    commandExecuted = true;
                }
                break;
            case userMessage.startsWith('.update'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const zipArg = parts[1] && parts[1].startsWith('http') ? parts[1] : '';
                    await updateCommand(sock, chatId, message, senderIsSudo, zipArg);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('.removebg') || userMessage.startsWith('.rmbg') || userMessage.startsWith('.nobg'):
                await removebgCommand.exec(sock, message, userMessage.split(' ').slice(1));
                break;
            case userMessage.startsWith('.remini') || userMessage.startsWith('.enhance') || userMessage.startsWith('.upscale'):
                await reminiCommand(sock, chatId, message, userMessage.split(' ').slice(1));
                break;
            default:
                if (isGroup) {
                    // Handle pesan grup non-command
                    if (userMessage) {  // Pastikan ada pesan
                        await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                    }
                    await Antilink(message, sock);
                    await handleTagDetection(sock, chatId, message, senderId);
                }
                commandExecuted = false;
                break;
        }

        // Jika command dieksekusi, tunjukkan status mengetik setelah eksekusi command
        if (commandExecuted !== false) {
            // Command dieksekusi, sekarang tunjukkan status mengetik setelah eksekusi command
            await showTypingAfterCommand(sock, chatId);
        }

        // Fungsi untuk menangani command .groupjid
        async function groupJidCommand(sock, chatId, message) {
            const groupJid = message.key.remoteJid;

            if (!groupJid.endsWith('@g.us')) {
                return await sock.sendMessage(chatId, {
                    text: "Command ini hanya bisa digunakan di grup."
                });
            }

            await sock.sendMessage(chatId, {
                text: `Group JID: ${groupJid}`
            }, {
                quoted: message
            });
        }

        if (userMessage.startsWith('.')) {
            // Setelah command diproses dengan sukses
            await addCommandReaction(sock, message);
        }
    } catch (error) {
        console.error('Error dalam penangan pesan:', error.message);
        // Hanya mencoba mengirim pesan error jika kita memiliki chatId yang valid
        if (chatId) {
            await sock.sendMessage(chatId, {
                text: 'Gagal memproses command!'
            });
        }
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        // Cek apakah ini grup
        if (!id.endsWith('@g.us')) return;



        // Handle event join
        if (action === 'add') {
            // Cek apakah welcome diaktifkan untuk grup ini
            const isWelcomeEnabled = await isWelcomeOn(id);
            if (!isWelcomeEnabled) return;

            // Dapatkan metadata grup
            const groupMetadata = await sock.groupMetadata(id);
            const groupName = groupMetadata.subject;
            const groupDesc = groupMetadata.desc || 'Tidak ada deskripsi tersedia';

            // Gunakan pesan welcome default sederhana
            const welcomeMessage = 'Selamat datang {user} di {group}!';

            // Kirim pesan welcome untuk setiap peserta baru
            for (const participant of participants) {
                const user = participant.split('@')[0];
                const formattedMessage = welcomeMessage
                    .replace('{user}', `@${user}`)
                    .replace('{group}', groupName)
                    .replace('{description}', groupDesc);

                await sock.sendMessage(id, {
                    text: formattedMessage,
                    mentions: [participant]
                });
            }
        }

        // Handle event leave
        if (action === 'remove') {
            // Cek apakah goodbye diaktifkan untuk grup ini
            const isGoodbyeEnabled = await isGoodByeOn(id);
            if (!isGoodbyeEnabled) return;

            // Dapatkan metadata grup
            const groupMetadata = await sock.groupMetadata(id);
            const groupName = groupMetadata.subject;

            // Gunakan pesan goodbye default sederhana
            const goodbyeMessage = 'Selamat tinggal {user}';

            // Kirim pesan goodbye untuk setiap peserta yang keluar
            for (const participant of participants) {
                const user = participant.split('@')[0];
                const formattedMessage = goodbyeMessage
                    .replace('{user}', `@${user}`)
                    .replace('{group}', groupName);

                await sock.sendMessage(id, {
                    text: formattedMessage,
                    mentions: [participant]
                });
            }
        }
    } catch (error) {
        console.error('Error di handleGroupParticipantUpdate:', error);
    }
}

// Missing function implementations

// Store message for antidelete feature
function storeMessage(message) {
    // This function is called to store messages for potential recovery
    // Implementation would depend on the antidelete system
    // For now, just log that it's being stored
    console.log('Message stored for antidelete:', message.key.id);
}

// Handle message revocation (deletion)
async function handleMessageRevocation(sock, message) {
    try {
        // Check if antidelete is enabled
        const antideleteData = JSON.parse(fs.readFileSync('./data/antidelete.json', 'utf8'));
        if (!antideleteData.enabled) return;

        const revokedMessage = message.message?.protocolMessage;
        if (!revokedMessage) return;

        // Try to find the original message in store
        const store = require('./lib/lightweight_store');
        const chatId = message.key.remoteJid;
        const originalMessage = store.messages[chatId]?.find(m => m.key.id === revokedMessage.key.id);

        if (originalMessage) {
            await sock.sendMessage(chatId, {
                text: `🗑️ *Message Deleted*\n\nFrom: @${message.key.participant?.split('@')[0] || 'unknown'}\n\n*Original Message:*\n${originalMessage.message?.conversation || originalMessage.message?.extendedTextMessage?.text || 'Media message'}`,
                mentions: [message.key.participant]
            });
        }
    } catch (error) {
        console.error('Error handling message revocation:', error);
    }
}

// Increment message count for statistics
function incrementMessageCount(chatId, senderId) {
    try {
        const data = JSON.parse(fs.readFileSync('./data/messageCount.json', 'utf8'));

        // Initialize chat if not exists
        if (!data[chatId]) {
            data[chatId] = {};
        }

        // Initialize user if not exists
        if (!data[chatId][senderId]) {
            data[chatId][senderId] = 0;
        }

        // Increment count
        data[chatId][senderId]++;

        // Save back to file
        fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error incrementing message count:', error);
    }
}

// Unban command implementation
async function unbanCommand(sock, chatId, message) {
    try {
        const mentionedJidList = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        let targetJid = null;

        if (mentionedJidList.length > 0) {
            targetJid = mentionedJidList[0];
        } else if (quotedMessage) {
            targetJid = quotedMessage.participant || quotedMessage.key.participant;
        }

        if (!targetJid) {
            await sock.sendMessage(chatId, { text: 'Tag atau reply pesan pengguna yang ingin di-unban.' });
            return;
        }

        // Remove from banned list
        const bannedData = JSON.parse(fs.readFileSync('./data/banned.json', 'utf8'));
        const index = bannedData.indexOf(targetJid);
        if (index > -1) {
            bannedData.splice(index, 1);
            fs.writeFileSync('./data/banned.json', JSON.stringify(bannedData, null, 2));
            await sock.sendMessage(chatId, { text: `✅ Pengguna @${targetJid.split('@')[0]} telah di-unban.`, mentions: [targetJid] });
        } else {
            await sock.sendMessage(chatId, { text: 'Pengguna tersebut tidak dalam daftar banned.' });
        }
    } catch (error) {
        console.error('Error in unban command:', error);
        await sock.sendMessage(chatId, { text: 'Terjadi kesalahan saat unban pengguna.' });
    }
}

// Handle antidelete command
async function handleAntideleteCommand(sock, chatId, message, match) {
    try {
        const antideleteData = JSON.parse(fs.readFileSync('./data/antidelete.json', 'utf8'));

        if (!match || match.toLowerCase() === 'status') {
            const status = antideleteData.enabled ? 'aktif' : 'nonaktif';
            await sock.sendMessage(chatId, { text: `Antidelete saat ini: *${status}*` });
            return;
        }

        if (match.toLowerCase() === 'on') {
            antideleteData.enabled = true;
            fs.writeFileSync('./data/antidelete.json', JSON.stringify(antideleteData, null, 2));
            await sock.sendMessage(chatId, { text: '✅ Antidelete diaktifkan.' });
        } else if (match.toLowerCase() === 'off') {
            antideleteData.enabled = false;
            fs.writeFileSync('./data/antidelete.json', JSON.stringify(antideleteData, null, 2));
            await sock.sendMessage(chatId, { text: '❌ Antidelete dinonaktifkan.' });
        } else {
            await sock.sendMessage(chatId, { text: 'Penggunaan: .antidelete on/off/status' });
        }
    } catch (error) {
        console.error('Error in antidelete command:', error);
        await sock.sendMessage(chatId, { text: 'Terjadi kesalahan saat mengelola antidelete.' });
    }
}



async function handleTicTacToeMove(sock, chatId, senderId, move) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur tic-tac-toe belum diimplementasikan.' });
}

async function topMembers(sock, chatId, isGroup) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur top members belum diimplementasikan.' });
}

async function blurCommand(sock, chatId, message, quotedMessage) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur blur belum diimplementasikan.' });
}

async function githubCommand(sock, chatId) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur github belum diimplementasikan.' });
}

async function flirtCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur flirt belum diimplementasikan.' });
}

async function characterCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur character belum diimplementasikan.' });
}

async function wastedCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur wasted belum diimplementasikan.' });
}

async function shipCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur ship belum diimplementasikan.' });
}

async function emojimixCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur emojimix belum diimplementasikan.' });
}

async function stickerTelegramCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur sticker telegram belum diimplementasikan.' });
}

async function viewOnceCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur view once belum diimplementasikan.' });
}

async function clearSessionCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur clear session belum diimplementasikan.' });
}

async function autoStatusCommand(sock, chatId, message, args) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur auto status belum diimplementasikan.' });
}

async function clearTmpCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur clear tmp belum diimplementasikan.' });
}

async function setProfilePicture(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur set profile picture belum diimplementasikan.' });
}

async function aiCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur AI belum diimplementasikan.' });
}

async function sudoCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur sudo belum diimplementasikan.' });
}

async function goodnightCommand(sock, chatId, message) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur goodnight belum diimplementasikan.' });
}

async function animeCommand(sock, chatId, message, args) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur anime belum diimplementasikan.' });
}

async function piesCommand(sock, chatId, message, args) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur pies belum diimplementasikan.' });
}

async function updateCommand(sock, chatId, message, senderIsSudo, zipArg) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur update belum diimplementasikan.' });
}

async function removebgCommand(sock, message, args) {
    // Placeholder implementation
    await sock.sendMessage(message.key.remoteJid, { text: 'Fitur removebg belum diimplementasikan.' });
}

async function reminiCommand(sock, chatId, message, args) {
    // Placeholder implementation
    await sock.sendMessage(chatId, { text: 'Fitur remini belum diimplementasikan.' });
}

async function showTypingAfterCommand(sock, chatId) {
    // Placeholder implementation - could show typing indicator
}

// Handle status updates
async function handleStatusUpdate(sock, status) {
    // Placeholder implementation for status updates
}

// Alih-alih, export penangan bersama dengan handleMessages
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        await handleStatusUpdate(sock, status);
    }
};
