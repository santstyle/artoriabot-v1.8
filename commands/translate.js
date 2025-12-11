const fetch = require('node-fetch');

async function handleTranslateCommand(sock, chatId, message, match) {
    try {
        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        let textToTranslate = '';
        let lang = '';

        // Check if it's a reply
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            // Get text from quoted message
            textToTranslate = quotedMessage.conversation ||
                quotedMessage.extendedTextMessage?.text ||
                quotedMessage.imageMessage?.caption ||
                quotedMessage.videoMessage?.caption ||
                '';

            // Get language from command
            lang = match.trim();
        } else {
            // Parse command arguments for direct message
            const args = match.trim().split(' ');
            if (args.length < 2) {
                return sock.sendMessage(chatId, {
                    text: `TRANSLATOR MANIS\n\nCara pakai:\n1. Reply pesan dengan: .translate <bahasa> atau .trt <bahasa>\n2. Atau ketik: .translate <teks> <bahasa> atau .trt <teks> <bahasa>\n\nContoh:\n.translate halo dunia fr\n.trt halo dunia fr\n\nKode bahasa:\nfr - Perancis\nes - Spanyol\nde - Jerman\nit - Italia\npt - Portugis\nru - Rusia\nja - Jepang\nko - Korea\nzh - China\nar - Arab\nhi - Hindi\nid - Indonesia\nen - Inggris`,
                    quoted: message
                });
            }

            lang = args.pop(); // Get language code
            textToTranslate = args.join(' '); // Get text to translate
        }

        if (!textToTranslate) {
            return sock.sendMessage(chatId, {
                text: 'Hmm, teksnya mana nih? Kasih dong teks yang mau diterjemahin atau reply pesannya',
                quoted: message
            });
        }

        // Kasih tau lagi kalau lagi proses
        await sock.sendMessage(chatId, {
            text: 'Bentar ya, lagi aku terjemahin dulu',
            quoted: message
        });

        // Try multiple translation APIs in sequence
        let translatedText = null;
        let error = null;

        // Try API 1 (Google Translate API)
        try {
            const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(textToTranslate)}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data[0] && data[0][0] && data[0][0][0]) {
                    translatedText = data[0][0][0];
                }
            }
        } catch (e) {
            error = e;
        }

        // If API 1 fails, try API 2
        if (!translatedText) {
            try {
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${lang}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.responseData && data.responseData.translatedText) {
                        translatedText = data.responseData.translatedText;
                    }
                }
            } catch (e) {
                error = e;
            }
        }

        // If API 2 fails, try API 3
        if (!translatedText) {
            try {
                const response = await fetch(`https://api.dreaded.site/api/translate?text=${encodeURIComponent(textToTranslate)}&lang=${lang}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.translated) {
                        translatedText = data.translated;
                    }
                }
            } catch (e) {
                error = e;
            }
        }

        if (!translatedText) {
            throw new Error('Semua API penerjemah gagal');
        }

        // Send translation
        await sock.sendMessage(chatId, {
            text: `Terjemahan Selesai!\n\nAsli: ${textToTranslate}\nHasil: ${translatedText}\n\nTerjemahan udah siap, semoga membantu ya`,
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('Aduh, error di translate command nih:', error);
        await sock.sendMessage(chatId, {
            text: 'Yah, gagal nerjemahin nih. Kayaknya API nya lagi cape. Coba lagi ya nanti',
            quoted: message
        });
    }
}

module.exports = {
    handleTranslateCommand
};