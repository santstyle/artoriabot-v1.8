const absenSessions = {}; // simpan data absen per grup

async function startAbsen(sock, m, title = "Daftar Absen") {
    const groupId = m.key.remoteJid;

    if (!groupId.endsWith("@g.us")) {
        return sock.sendMessage(groupId, { text: "Fitur absen hanya bisa dipakai di grup." }, { quoted: m });
    }

    absenSessions[groupId] = { list: [], active: true, title: title.trim() || "Daftar Absen" };

    await sock.sendMessage(groupId, { text: `✅ Absen "${absenSessions[groupId].title}" dimulai! Silakan isi dengan \`.absen <nama/teks>\`` }, { quoted: m });
}

async function addAbsen(sock, m, text) {
    const groupId = m.key.remoteJid;

    if (!groupId.endsWith("@g.us")) {
        return sock.sendMessage(groupId, { text: "Fitur absen hanya bisa dipakai di grup." }, { quoted: m });
    }

    if (!absenSessions[groupId] || !absenSessions[groupId].active) {
        return sock.sendMessage(groupId, { text: "❌ Absen belum dimulai. Gunakan `.startabsen` dulu." }, { quoted: m });
    }

    const userText = text.trim();
    if (!userText) {
        return sock.sendMessage(groupId, { text: "Format salah! Gunakan `.absen <nama/teks>`" }, { quoted: m });
    }

    const session = absenSessions[groupId];
    session.list.push(userText);

    const listText = session.list.map((item, i) => `${i + 1}. ${item}`).join("\n");

    await sock.sendMessage(groupId, {
        text: `${session.title}\n${listText}`
    }, { quoted: m });
}

async function finishAbsen(sock, m) {
    const groupId = m.key.remoteJid;

    if (!groupId.endsWith("@g.us")) {
        return sock.sendMessage(groupId, { text: "Fitur absen hanya bisa dipakai di grup." }, { quoted: m });
    }

    if (!absenSessions[groupId] || !absenSessions[groupId].active) {
        return sock.sendMessage(groupId, { text: "❌ Tidak ada absen yang sedang berlangsung." }, { quoted: m });
    }

    const session = absenSessions[groupId];
    session.active = false;

    const listText = session.list.length > 0
        ? session.list.map((item, i) => `${i + 1}. ${item}`).join("\n")
        : "Belum ada yang absen.";

    await sock.sendMessage(groupId, {
        text: `✅ Absen "${session.title}" selesai!\n\nDaftar Final:\n${listText}\n\nGunakan .startabsen lagi untuk memulai sesi baru.`
    }, { quoted: m });
}

module.exports = { startAbsen, addAbsen, finishAbsen };