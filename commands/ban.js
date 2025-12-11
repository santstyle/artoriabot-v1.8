const fs = require('fs');
const path = require('path');

async function banCommand(sock, chatId, message) {
    let userToBan;

    // Check for mentioned users
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        userToBan = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Check for replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToBan = message.message.extendedTextMessage.contextInfo.participant;
    }

    if (!userToBan) {
        await sock.sendMessage(chatId, {
            text: 'Sebutin dong usernya yang mau di-ban? Mention atau reply chatnya~'
        });
        return;
    }

    try {
        // Pastikan file banned.json ada
        const bannedPath = path.join(__dirname, '../data/banned.json');
        if (!fs.existsSync(bannedPath)) {
            fs.writeFileSync(bannedPath, JSON.stringify([]));
        }

        // Add user to banned list
        const bannedUsers = JSON.parse(fs.readFileSync(bannedPath));
        if (!bannedUsers.includes(userToBan)) {
            bannedUsers.push(userToBan);
            fs.writeFileSync(bannedPath, JSON.stringify(bannedUsers, null, 2));

            await sock.sendMessage(chatId, {
                text: `@${userToBan.split('@')[0]} udah di-ban ya~`,
                mentions: [userToBan]
            });
        } else {
            await sock.sendMessage(chatId, {
                text: `@${userToBan.split('@')[0]} udah di-ban sebelumnya kok`,
                mentions: [userToBan]
            });
        }
    } catch (error) {
        console.error('Error di ban command:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, gagal ban user nih. Coba lagi ya~'
        });
    }
}

module.exports = banCommand;