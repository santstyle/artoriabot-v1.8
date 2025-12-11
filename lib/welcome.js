const { addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn } = require('../lib/index');
const { delay } = require('@whiskeysockets/baileys');

async function handleWelcome(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*Settingan Pesan Welcome*\n\n✅ *.welcome on* — Nyalain pesan sambutan\n *.welcome set Pesan custom kamu* — Atur pesan sambutan khusus\n *.welcome off* — Matiin pesan sambutan\n\n*Variabel yang bisa dipakai:*\n• {user} — Mention member baru\n• {group} — Nama grup\n• {description} — Deskripsi grup`,
            quoted: message
        });
    }

    const [command, ...args] = match.split(' ');
    const lowerCommand = command.toLowerCase();
    const customMessage = args.join(' ');

    if (lowerCommand === 'on') {
        if (await isWelcomeOn(chatId)) {
            return sock.sendMessage(chatId, { text: 'Wah, pesan sambutan sudah aktif dari tadi, kok~ Coba cek lagi, ya.', quoted: message });
        }
        await addWelcome(chatId, true, 'Welcome {user} to {group}! 🎉');
        return sock.sendMessage(chatId, { text: 'Horee! Pesan sambutan udah aku nyalain~ Pakai pesan sederhana dulu. Mau custom? Ketik *.welcome set [pesan kamu]* aja.', quoted: message });
    }

    if (lowerCommand === 'off') {
        if (!(await isWelcomeOn(chatId))) {
            return sock.sendMessage(chatId, { text: 'Pesan sambutan udah dimatiin sebelumnya, nih. Tenang aja~', quoted: message });
        }
        await delWelcome(chatId);
        return sock.sendMessage(chatId, { text: 'Oke sip! Pesan sambutan udah aku matiin untuk grup ini.', quoted: message });
    }

    if (lowerCommand === 'set') {
        if (!customMessage) {
            return sock.sendMessage(chatId, { text: 'Wah, pesannya mana nih? Kasih dong pesan sambutan khususnya. Contoh: *.welcome set Selamat datang ya!*', quoted: message });
        }
        await addWelcome(chatId, true, customMessage);
        return sock.sendMessage(chatId, { text: 'Yeayy! Pesan sambutan kustom udah berhasil diatur~ Nanti member baru bakal baca pesan itu.', quoted: message });
    }

    // If no valid command is provided
    return sock.sendMessage(chatId, {
        text: `Aduh, perintahnya ga kebaca nih. Coba pakai yang ini ya:\n*.welcome on* - Nyalain\n*.welcome set [pesan]* - Atur pesan kustom\n*.welcome off* - Matiin`,
        quoted: message
    });
}

async function handleGoodbye(sock, chatId, message, match) {
    const lower = match?.toLowerCase();

    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*Settingan Pesan Goodbye*\n\n✅ *.goodbye on* — Nyalain pesan perpisahan\n *.goodbye set Pesan custom kamu* — Atur pesan perpisahan khusus\n *.goodbye off* — Matiin pesan perpisahan\n\n*Variabel yang bisa dipakai:*\n• {user} — Mention member yang keluar\n• {group} — Nama grup`,
            quoted: message
        });
    }

    if (lower === 'on') {
        if (await isGoodByeOn(chatId)) {
            return sock.sendMessage(chatId, { text: 'Loh, pesan perpisahan udah nyala dari tadi, lho~ Coba dicek lagi ya.', quoted: message });
        }
        await addGoodbye(chatId, true, 'Goodbye {user} 👋');
        return sock.sendMessage(chatId, { text: 'Siap! Pesan perpisahan udah aktif~ Pakai yang sederhana dulu. Mau yang lebih spesial? Ketik *.goodbye set [pesan kamu]* aja.', quoted: message });
    }

    if (lower === 'off') {
        if (!(await isGoodByeOn(chatId))) {
            return sock.sendMessage(chatId, { text: 'Pesan perpisahan sudah dimatiin sebelumnya, kok. Ga usah khawatir~', quoted: message });
        }
        await delGoodBye(chatId);
        return sock.sendMessage(chatId, { text: 'Oke deh, pesan perpisahan udah aku matiin. Ga ada yang bakal bilang goodbye lagi nih~', quoted: message });
    }

    if (lower.startsWith('set ')) {
        const customMessage = match.substring(4);
        if (!customMessage) {
            return sock.sendMessage(chatId, { text: 'Wah, pesannya mana nih? Kasih dong pesan perpisahan yang mau dipakai. Contoh: *.goodbye set Sampai jumpa!*', quoted: message });
        }
        await addGoodbye(chatId, true, customMessage);
        return sock.sendMessage(chatId, { text: 'Tadaa! Pesan perpisahan kustom udah berhasil disimpan~ Nanti kalau ada yang keluar, bakal pakai pesan ini.', quoted: message });
    }

    // If no valid command is provided
    return sock.sendMessage(chatId, {
        text: `Kayaknya perintahnya ga sesuai, deh. Coba pakai yang ini ya:\n*.goodbye on* - Nyalain\n*.goodbye set [pesan]* - Atur pesan kustom\n*.goodbye off* - Matiin`,
        quoted: message
    });
}

module.exports = { handleWelcome, handleGoodbye };
// Kode ini menangani pesan sambutan dan perpisahan di grup WhatsApp pake library Baileys.