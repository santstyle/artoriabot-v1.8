async function staffCommand(sock, chatId, msg) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);

        let pp;
        try {
            pp = await sock.profilePictureUrl(chatId, 'image');
        } catch {
            pp = 'https://i.imgur.com/2wzGhpF.jpeg'; 
        }

        const participants = groupMetadata.participants;
        const groupAdmins = participants.filter(p => p.admin);
        const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n');

        const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || chatId.split('-')[0] + '@s.whatsapp.net';

        const text = `
≡ *GROUP*  _${groupMetadata.subject}_

*ADMINS*
${listAdmin}

`.trim();

        await sock.sendMessage(chatId, {
            image: { url: pp },
            caption: text,
            mentions: [...groupAdmins.map(v => v.id), owner]
        });

    } catch (error) {
        console.error('Error in staff command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to get admin list!' });
    }
}

module.exports = staffCommand; async function staffCommand(sock, chatId, msg) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);

        let pp;
        try {
            pp = await sock.profilePictureUrl(chatId, 'image');
        } catch {
            pp = 'https://i.imgur.com/2wzGhpF.jpeg'; 
        }

        const participants = groupMetadata.participants;
        const groupAdmins = participants.filter(p => p.admin);

        if (groupAdmins.length === 0) {
            await sock.sendMessage(chatId, {
                text: 'Wah, grup ini belum ada admin nih~'
            });
            return;
        }

        const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n');

        const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || chatId.split('-')[0] + '@s.whatsapp.net';

        const text = `Daftar admin grup ${groupMetadata.subject}~ \n\nYang bisa diandalkan:\n${listAdmin}\n\nKalau butuh bantuan, bisa tanya mereka ya!`;

        await sock.sendMessage(chatId, {
            image: { url: pp },
            caption: text,
            mentions: [...groupAdmins.map(v => v.id), owner]
        });

    } catch (error) {
        console.error('Wah, error di staff command nih:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, gagal ambil daftar admin nih. Coba lagi ya~'
        });
    }
}

module.exports = staffCommand;