async function unmuteCommand(sock, chatId) {
    await sock.groupSettingUpdate(chatId, 'not_announcement'); 
    await sock.sendMessage(chatId, { text: 'The group has been unmuted.' });
}

module.exports = unmuteCommand;
