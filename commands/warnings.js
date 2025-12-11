const fs = require('fs');
const path = require('path');

const warningsFilePath = path.join(__dirname, '../data/warnings.json');

function loadWarnings() {
    if (!fs.existsSync(warningsFilePath)) {
        fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
    }
    const data = fs.readFileSync(warningsFilePath, 'utf8');
    return JSON.parse(data);
}

async function warningsCommand(sock, chatId, mentionedJidList) {
    const warnings = loadWarnings();

    if (mentionedJidList.length === 0) {
        await sock.sendMessage(chatId, {
            text: 'Haii~ sebutin dong usernya siapa yang mau dicek warningnya?\nContoh: .warnings @username'
        });
        return;
    }

    const userToCheck = mentionedJidList[0];
    const warningCount = warnings[userToCheck] || 0;

    if (warningCount === 0) {
        await sock.sendMessage(chatId, {
            text: `Yeayy! @${userToCheck.split('@')[0]} belum pernah dapat warning sama sekali~ Masih bersih banget! ✨`,
            mentions: [userToCheck]
        });
    } else if (warningCount === 1) {
        await sock.sendMessage(chatId, {
            text: `Hmm, @${userToCheck.split('@')[0]} udah dapat 1 warning nih. Hati-hati ya jangan sampe tambah lagi~`,
            mentions: [userToCheck]
        });
    } else if (warningCount === 2) {
        await sock.sendMessage(chatId, {
            text: `Oya, @${userToCheck.split('@')[0]} udah dapat 2 warning. Tinggal 1 lagi lho sebelum konsekuensinya~`,
            mentions: [userToCheck]
        });
    } else {
        await sock.sendMessage(chatId, {
            text: `Wah, @${userToCheck.split('@')[0]} udah dapat ${warningCount} warning. Sudah melewati batas nih, harus lebih baik lagi ya~`,
            mentions: [userToCheck]
        });
    }
}

module.exports = warningsCommand;