const settings = require('../settings');
const { isSudo } = require('./index');

async function isOwnerOrSudo(senderId) {
    const ownerJid = settings.ownerNumber + "@s.whatsapp.net";
    if (senderId === ownerJid) return true;
    try {
        return await isSudo(senderId);
    } catch (e) {
        return false;
    }
}

module.exports = isOwnerOrSudo;