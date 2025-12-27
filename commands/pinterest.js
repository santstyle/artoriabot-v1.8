const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Google Images Search
const googleImageSearch = async (query) => {
    try {
        console.log('Searching Google Images for: ' + query);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&hl=en&safe=active`;

        const response = await axios.get(searchUrl, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
                'Referer': 'https://www.google.com/',
                'Cache-Control': 'no-cache'
            }
        });

        const html = response.data;

        // Cari URL gambar dari Google
        const regexPatterns = [
            /\["https:\/\/[^"]+",\d+,\d+\]/g,
            /"ou":"([^"]+)"/g,
            /"original":"([^"]+)"/g,
            /"src":"([^"]+)"/g
        ];

        let imageUrl = null;

        for (const pattern of regexPatterns) {
            const matches = html.match(pattern);
            if (matches && matches.length > 0) {
                try {
                    const match = matches[0];

                    if (pattern.toString().includes('ou')) {
                        imageUrl = match.match(/"ou":"([^"]+)"/)[1];
                    } else if (pattern.toString().includes('original')) {
                        imageUrl = match.match(/"original":"([^"]+)"/)[1];
                    } else if (pattern.toString().includes('src')) {
                        imageUrl = match.match(/"src":"([^"]+)"/)[1];
                    } else {
                        const jsonMatch = JSON.parse(match);
                        imageUrl = jsonMatch[0];
                    }

                    if (imageUrl && imageUrl.startsWith('http')) {
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        // Method 2: Parsing HTML dengan Cheerio
        if (!imageUrl) {
            const $ = cheerio.load(html);
            $('img').each((i, elem) => {
                if (!imageUrl && i < 10) {
                    const src = $(elem).attr('src');
                    if (src && src.startsWith('http') && !src.includes('google.com')) {
                        imageUrl = src;
                        return false;
                    }
                }
            });
        }

        // Fallback ke Unsplash jika tidak ditemukan
        if (!imageUrl) {
            imageUrl = `https://source.unsplash.com/random/800x600/?${encodeURIComponent(query)}`;
        } else {
            imageUrl = decodeURIComponent(imageUrl);
        }

        console.log('Found image URL');
        return imageUrl;

    } catch (error) {
        console.error('Google Images error:', error.message);
        return `https://source.unsplash.com/random/800x600/?${encodeURIComponent(query)}`;
    }
};

// Download image
async function downloadImage(imageUrl, outputPath) {
    return new Promise((resolve, reject) => {
        let cleanUrl = imageUrl;
        if (cleanUrl.includes('&amp;')) {
            cleanUrl = cleanUrl.replace(/&amp;/g, '&');
        }

        try {
            cleanUrl = decodeURIComponent(cleanUrl);
        } catch (e) { }

        const writer = fs.createWriteStream(outputPath);

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache'
        };

        axios({
            method: 'GET',
            url: cleanUrl,
            responseType: 'stream',
            timeout: 30000,
            maxContentLength: 10 * 1024 * 1024,
            headers: headers
        })
            .then(response => {
                response.data.pipe(writer);

                writer.on('finish', () => {
                    const stats = fs.statSync(outputPath);
                    if (stats.size < 1024) {
                        fs.unlinkSync(outputPath);
                        reject(new Error('File too small'));
                    } else {
                        resolve();
                    }
                });

                writer.on('error', reject);
                response.data.on('error', reject);
            })
            .catch(error => {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`;

                axios({
                    method: 'GET',
                    url: proxyUrl,
                    responseType: 'stream',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                })
                    .then(response => {
                        response.data.pipe(writer);
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                        response.data.on('error', reject);
                    })
                    .catch(proxyError => {
                        reject(proxyError);
                    });
            });
    });
}

// Main command
async function pinCommand(sock, chatId, message, command) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        let query = '';
        if (command === '.pinterest') {
            query = text.substring(11).trim();
        } else if (command === '.pin') {
            query = text.substring(5).trim();
        } else {
            query = text.split(' ').slice(1).join(' ').trim();
        }

        if (!query) {
            return await showHelp(sock, chatId, message);
        }

        const processingMsg = await sock.sendMessage(chatId, {
            text: 'Mencari gambar ' + query + '...'
        }, { quoted: message });

        await searchAndSendImage(sock, chatId, message, query, processingMsg);

    } catch (error) {
        console.error('Pin command error:', error);
        await sock.sendMessage(chatId, {
            text: 'Error'
        }, { quoted: message });
    }
}

// Cari dan kirim gambar tanpa caption
async function searchAndSendImage(sock, chatId, message, query, processingMsg) {
    try {
        await sock.sendMessage(chatId, {
            text: 'Mencari di Google Images...',
            edit: processingMsg.key
        });

        const imageUrl = await googleImageSearch(query);

        if (!imageUrl) {
            await sock.sendMessage(chatId, {
                text: 'Tidak ada gambar ditemukan',
                edit: processingMsg.key
            });
            return;
        }

        await sock.sendMessage(chatId, {
            text: 'Gambar ditemukan, mendownload...',
            edit: processingMsg.key
        });

        const tempDir = path.join(__dirname, '../temp/images');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileName = `img_${Date.now()}.jpg`;
        const filePath = path.join(tempDir, fileName);

        try {
            await downloadImage(imageUrl, filePath);

            // Kirim gambar TANPA CAPTION
            await sock.sendMessage(chatId, {
                image: fs.readFileSync(filePath)
                // Tidak ada caption
            });

            await sock.sendMessage(chatId, {
                text: 'Selesai',
                edit: processingMsg.key
            });

            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (e) { }
            }, 5000);

        } catch (downloadError) {
            console.error('Download error:', downloadError.message);

            try {
                // Coba kirim langsung dari URL tanpa caption
                await sock.sendMessage(chatId, {
                    image: { url: imageUrl }
                    // Tidak ada caption
                });

                await sock.sendMessage(chatId, {
                    text: 'Selesai',
                    edit: processingMsg.key
                });

            } catch (urlError) {
                await sock.sendMessage(chatId, {
                    text: 'Gagal mengirim gambar',
                    edit: processingMsg.key
                });
            }
        }

    } catch (error) {
        console.error('Search error:', error);
        await sock.sendMessage(chatId, {
            text: 'Error',
            edit: processingMsg.key
        });
    }
}

// Show help
async function showHelp(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text: 'Google Images Search\n\n' +
            'Command:\n' +
            '.pin <kata kunci>\n' +
            '.pinterest <kata kunci>\n\n' +
            'Contoh:\n' +
            '.pin anime\n' +
            '.pin landscape\n' +
            '.pinterest cat'
    }, { quoted: message });
}

// Simple version
async function simplePin(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.replace('.pin ', '').replace('.pinterest ', '').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: 'Gunakan: .pin <kata kunci>'
            }, { quoted: message });
        }

        const msg = await sock.sendMessage(chatId, {
            text: 'Mencari ' + query + '...'
        }, { quoted: message });

        const imageUrl = await googleImageSearch(query);

        if (!imageUrl) {
            await sock.sendMessage(chatId, {
                text: 'Tidak ada gambar',
                edit: msg.key
            });
            return;
        }

        // Kirim gambar tanpa caption
        await sock.sendMessage(chatId, {
            image: { url: imageUrl }
            // Tidak ada caption
        });

        await sock.sendMessage(chatId, {
            text: 'Selesai',
            edit: msg.key
        });

    } catch (error) {
        console.error('Simple pin error:', error);
        await sock.sendMessage(chatId, {
            text: 'Error'
        });
    }
}

// Export
module.exports = {
    pinterest: pinCommand,
    pin: pinCommand,
    pins: pinCommand,
    simplepin: simplePin
};