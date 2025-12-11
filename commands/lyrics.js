const fetch = require('node-fetch');

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        await sock.sendMessage(chatId, {
            text: 'Hai, sebutin dong judul lagunya~\nPakai: lyrics <judul lagu>'
        }, { quoted: message });
        return;
    }

    try {
        // Kasih tau kalau lagi cari lirik
        await sock.sendMessage(chatId, {
            text: 'Bentar ya, lagi aku cariin liriknya~'
        }, { quoted: message });

        const apiUrl = `https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(songTitle)}`;
        const res = await fetch(apiUrl);

        if (!res.ok) {
            const errText = await res.text();
            throw errText;
        }

        const data = await res.json();

        const lyrics = data && data.result && data.result.lyrics ? data.result.lyrics : null;
        if (!lyrics) {
            await sock.sendMessage(chatId, {
                text: `Wah, lirik untuk "${songTitle}" ga ketemu nih. Coba cek lagi judulnya ya~`
            }, { quoted: message });
            return;
        }

        const maxChars = 4096;
        const output = lyrics.length > maxChars ? lyrics.slice(0, maxChars - 3) + '...' : lyrics;

        await sock.sendMessage(chatId, {
            text: `Lirik "${songTitle}":\n\n${output}\n\nSelamat bernyanyi ya~`
        }, { quoted: message });
    } catch (error) {
        console.error('Error di lyrics command:', error);
        await sock.sendMessage(chatId, {
            text: `Yah, gagal ambil lirik untuk "${songTitle}" nih. Coba lagi nanti ya~`
        }, { quoted: message });
    }
}

module.exports = { lyricsCommand };