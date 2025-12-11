const fetch = require('node-fetch');

async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `Fitur Screenshot\n\n.ss <url>\n.ssweb <url>\n.screenshot <url>\n\nBuat screenshot website apapun\n\nContoh:\n.ss https://google.com\n.ssweb https://google.com\n.screenshot https://google.com`,
            quoted: message
        });
        return;
    }

    try {
        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        // Kasih tau kalau lagi proses
        await sock.sendMessage(chatId, {
            text: 'Bentar ya, lagi aku ambil screenshotnya~',
            quoted: message
        });

        // Extract URL from command
        const url = match.trim();

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return sock.sendMessage(chatId, {
                text: 'Wah, URL nya harus dimulai dari http:// atau https:// nih',
                quoted: message
            });
        }

        // Call the API
        const apiUrl = `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}&theme=light&device=desktop`;
        const response = await fetch(apiUrl, { headers: { 'accept': '*/*' } });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        // Get the image buffer
        const imageBuffer = await response.buffer();

        // Send the screenshot
        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: 'Ini screenshotnya~'
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('Error di ss command:', error);
        await sock.sendMessage(chatId, {
            text: 'Yah, gagal ambil screenshot nih. Coba lagi ya nanti~\n\nMungkin karena:\n• URL nya ga bener\n• Websitenya ga mau di-screenshot\n• Lagi down\n• API nya lagi istirahat',
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
};