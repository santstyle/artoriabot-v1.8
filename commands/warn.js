const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

// Define paths
const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

// Initialize warnings file if it doesn't exist
function initializeWarningsFile() {
    // Create database directory if it doesn't exist
    if (!fs.existsSync(databaseDir)) {
        fs.mkdirSync(databaseDir, { recursive: true });
    }

    // Create warnings.json if it doesn't exist
    if (!fs.existsSync(warningsPath)) {
        fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
    }
}

async function warnCommand(sock, chatId, senderId, mentionedJids, message) {
    try {
        // Initialize files first
        initializeWarningsFile();

        // First check if it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: 'Hmm, command warn cuma bisa dipakai di grup aja lho~ Kirim ke grup ya'
            });
            return;
        }

        // Check admin status first
        try {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, {
                    text: 'Aduh, aku harus jadi admin dulu nih biar bisa kasih warning. Minta admin dulu ya~'
                });
                return;
            }

            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, {
                    text: 'Maaf, cuma admin grup yang boleh kasih warning ke member lain~'
                });
                return;
            }
        } catch (adminError) {
            console.error('Error waktu cek status admin:', adminError);
            await sock.sendMessage(chatId, {
                text: 'Wah, ada masalah waktu cek admin nih. Pastiin aku jadi admin ya~'
            });
            return;
        }

        let userToWarn;

        // Check for mentioned users
        if (mentionedJids && mentionedJids.length > 0) {
            userToWarn = mentionedJids[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToWarn = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!userToWarn) {
            await sock.sendMessage(chatId, {
                text: 'Sebutin dong usernya siapa yang mau di-warn? Bisa mention atau reply chatnya~'
            });
            return;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            // Read warnings, create empty object if file is empty
            let warnings = {};
            try {
                warnings = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
            } catch (error) {
                warnings = {};
            }

            // Initialize nested objects if they don't exist
            if (!warnings[chatId]) warnings[chatId] = {};
            if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;

            warnings[chatId][userToWarn]++;
            fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

            const warningMessage = `*「 PERINGATAN 」*\n\n` +
                `👤 *User:* @${userToWarn.split('@')[0]}\n` +
                `⚠️ *Warning ke:* ${warnings[chatId][userToWarn]}/3\n` +
                `👑 *Oleh:* @${senderId.split('@')[0]}\n\n` +
                `Hai @${userToWarn.split('@')[0]}, jangan diulangi lagi ya~ Aku sayang semua member di grup ini 💝`;

            await sock.sendMessage(chatId, {
                text: warningMessage,
                mentions: [userToWarn, senderId]
            });

            // Auto-kick after 3 warnings
            if (warnings[chatId][userToWarn] >= 3) {
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

                await sock.groupParticipantsUpdate(chatId, [userToWarn], "remove");
                delete warnings[chatId][userToWarn];
                fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

                const kickMessage = `*「 AUTO-KICK 」*\n\n` +
                    `@${userToWarn.split('@')[0]} udah dapat 3 warning, jadi terpaksa aku keluarin dari grup nih~ Jangan sedih ya, bisa join lagi kalau udah janji bakal baik-baik! 🥺`;

                await sock.sendMessage(chatId, {
                    text: kickMessage,
                    mentions: [userToWarn]
                });
            }
        } catch (error) {
            console.error('Error waktu warn user:', error);
            await sock.sendMessage(chatId, {
                text: 'Aduh, gagal kasih warning nih. Coba lagi ya~'
            });
        }
    } catch (error) {
        console.error('Error di warn command:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, {
                    text: 'Wah, terlalu cepat nih. Tunggu bentar ya baru coba lagi~'
                });
            } catch (retryError) {
                console.error('Error waktu kirim pesan retry:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, {
                    text: 'Gagal kasih warning nih. Pastiin aku admin dan punya permission ya~'
                });
            } catch (sendError) {
                console.error('Error waktu kirim pesan error:', sendError);
            }
        }
    }
}

module.exports = warnCommand;