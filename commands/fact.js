const axios = require('axios');

module.exports = async function (sock, chatId, message) {
    try {
        const response = await axios.get('https://indonesian-facts.vercel.app/api/facts/random');
        const fact = response.data.data.fact;

        await sock.sendMessage(chatId, { text: `📌 Fakta: ${fact}` }, { quoted: message });
    } catch (error) {
        console.error('Error fetching fact:', error.message);
        await sock.sendMessage(chatId, {
            text: '❌ Gagal ambil fakta Indonesia sekarang, coba lagi nanti ya.'
        }, { quoted: message });
    }
};
