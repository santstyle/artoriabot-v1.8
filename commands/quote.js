const fetch = require('node-fetch');

module.exports = async function quoteCommand(sock, chatId, message, args) {
    try {
        let url = 'https://indonesian-quotes-api.vercel.app/api/quotes/random';
        if (args[0]) url += `?category=${args[0]}`; // contoh: .quote motivasi

        // Kasih tau kalau lagi cari quote
        await sock.sendMessage(chatId, {
            text: 'Bentar ya, lagi aku cariin quote yang bagus~'
        }, { quoted: message });

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const q = json.data;
        const quoteMsg = `"${q.quote}"\n— ${q.source || 'Tidak diketahui'} (${q.category || 'Umum'})\n\nSemoga bikin hari kamu lebih baik ya~`;

        await sock.sendMessage(chatId, { text: quoteMsg }, { quoted: message });
    } catch (error) {
        console.error('Error di quote command:', error);
        await sock.sendMessage(chatId, {
            text: 'Yah, gagal ambil quote nih. Coba lagi ya~ Formatnya: .quote [kategori]'
        }, { quoted: message });
    }
};