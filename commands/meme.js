const axios = require('axios');

async function memeCommand(sock, chatId, message) {
    try {
        const response = await axios.get('https://candaan-api.vercel.app/api/image/random', {
            headers: { Accept: 'application/json' }
        });

        const memeData = response.data.data;
        const memeUrl = memeData.url;
        const source = memeData.source || 'Candaan API';

        const buttons = [
            { buttonId: '.meme', buttonText: { displayText: '🎭 Another Meme' }, type: 1 },
            { buttonId: '.joke', buttonText: { displayText: '😄 Joke' }, type: 1 }
        ];

        await sock.sendMessage(chatId, {
            image: { url: memeUrl },
            caption: `Source: ${source}`,
            buttons: buttons,
            headerType: 1
        }, { quoted: message });

    } catch (error) {
        console.error('Error in meme command:', error.message);
        await sock.sendMessage(chatId, {
            text: '❌ Gagal ambil meme Indo. Coba lagi nanti ya.'
        });
    }
}

module.exports = memeCommand;
