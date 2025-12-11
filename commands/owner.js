const settings = require('../settings');

async function ownerCommand(sock, chatId) {
    await sock.sendMessage(chatId, {
        text: `Powered By SantStyle
Instagram: https://www.instagram.com/santstyle.mv`
    });
}

module.exports = ownerCommand;
