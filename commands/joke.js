const axios = require('axios');

module.exports = async function (sock, chatId) {
    try {
        const response = await axios.get('https://candaan-api.vercel.app/api/text/random', {
            headers: { Accept: 'application/json' }
        });
        // Ambil joke sebagai string dari response.data.data
        const joke = response.data.data;
        await sock.sendMessage(chatId, { text: joke });
    } catch (error) {
        console.error('Error fetching joke:', error.message);
        await sock.sendMessage(chatId, { text: '😢 Lagi error ambil candaan, coba lagi nanti ya.' });
    }
};
