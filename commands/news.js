const axios = require('axios');

module.exports = async function (sock, chatId) {
    try {
        const apiKey = 'dcd720a6f1914e2d9dba9790c188c08c';

        // Kasih tau kalau lagi ambil berita
        await sock.sendMessage(chatId, {
            text: 'Bentar ya, lagi aku cariin berita terbaru~'
        });

        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
        const articles = response.data.articles.slice(0, 5);

        if (articles.length === 0) {
            await sock.sendMessage(chatId, {
                text: 'Wah, beritanya lagi kosong nih. Coba lagi nanti ya~'
            });
            return;
        }

        let newsMessage = 'Berita terbaru nih~\n\n';
        articles.forEach((article, index) => {
            newsMessage += `${index + 1}. ${article.title}\n${article.description || 'Deskripsi ga ada'}\n\n`;
        });

        newsMessage += 'Semoga informasinya bermanfaat ya!';

        await sock.sendMessage(chatId, { text: newsMessage });
    } catch (error) {
        console.error('Error ambil berita:', error);
        await sock.sendMessage(chatId, {
            text: 'Yah, gagal ambil berita nih. API nya kayaknya lagi cape, coba lagi nanti ya~'
        });
    }
};