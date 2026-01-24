const axios = require('axios');

async function twitterCommand(sock, chatId, message, command) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        let url = '';
        if (command === '.twitter') {
            url = text.substring(9).trim();
        } else if (command === '.twt') {
            url = text.substring(5).trim();
        } else if (command === '.x') {
            url = text.substring(3).trim();
        } else {
            url = text.split(' ').slice(1).join(' ').trim();
        }

        if (!url || (!url.includes('twitter.com') && !url.includes('x.com') && !url.includes('t.co'))) {
            return await sock.sendMessage(chatId, {
                text: `Format: ${command} <link twitter/x>\n\nContoh:\n${command} https://x.com/username/status/123456789`
            }, { quoted: message });
        }

        const processingMsg = await sock.sendMessage(chatId, {
            text: `Memproses link Twitter...\n\nURL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}\n\nMohon tunggu sebentar...`
        });

        const tweetId = extractTweetId(url);
        if (!tweetId) {
            await sock.sendMessage(chatId, {
                text: 'Link tidak valid!'
            });
            return;
        }

        let mediaData = null;
        let username = 'Twitter';

        try {
            const response = await axios.get(`https://api.vxtwitter.com/Twitter/status/${tweetId}`, {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const data = response.data;
            username = data.user_screen_name || 'Twitter';

            if (data.media_extended && data.media_extended.length > 0) {
                const media = data.media_extended[0];

                if ((media.type === 'video' || media.type === 'gif') && media.variants) {
                    const videoUrl = media.variants
                        .filter(v => v.content_type === 'video/mp4')
                        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]?.url;

                    if (videoUrl) {
                        mediaData = {
                            type: media.type === 'gif' ? 'gif' : 'video',
                            url: videoUrl,
                            caption: `From @${username}`
                        };
                    }
                } else if (media.type === 'photo' && media.url) {
                    mediaData = {
                        type: 'photo',
                        url: media.url,
                        caption: `From @${username}`
                    };
                }
            }
        } catch (error) {
            console.log('VXTwitter gagal:', error.message);
        }

        if (!mediaData) {
            try {
                const response = await axios.get(`https://api.fxtwitter.com/status/${tweetId}`, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                const data = response.data;
                const tweet = data.tweet;
                username = tweet.author?.screen_name || 'Twitter';

                if (tweet?.media?.videos?.[0]?.url) {
                    mediaData = {
                        type: 'video',
                        url: tweet.media.videos[0].url,
                        caption: `From @${username}`
                    };
                } else if (tweet?.media?.photos?.[0]?.url) {
                    mediaData = {
                        type: 'photo',
                        url: tweet.media.photos[0].url,
                        caption: `From @${username}`
                    };
                }
            } catch (error) {
                console.log('FXTwitter juga gagal:', error.message);
            }
        }

        if (mediaData) {
            if (mediaData.type === 'video' || mediaData.type === 'gif') {
                await sock.sendMessage(chatId, {
                    video: { url: mediaData.url },
                    caption: mediaData.caption
                });
            } else if (mediaData.type === 'photo') {
                await sock.sendMessage(chatId, {
                    image: { url: mediaData.url },
                    caption: mediaData.caption
                });
            }

            await sock.sendMessage(chatId, {
                text: `Media Berhasil Didownload!\n\n` +
                    `Postingan Twitter berhasil didownload!\n\n` +
                    `Ingin download postingan lain?\n` +
                    `Ketik: \`.twt <link twitter>\``
            });
        } else {
            await sock.sendMessage(chatId, {
                text: 'Gagal mendownload media. Pastikan link berisi video/foto dan bukan teks saja.'
            });
        }

    } catch (error) {
        console.error('Twitter error:', error);
        await sock.sendMessage(chatId, {
            text: 'Terjadi error. Coba lagi nanti.'
        }, { quoted: message });
    }
}

function extractTweetId(url) {
    const patterns = [
        /(?:twitter\.com|x\.com)\/(?:[^\/]+)\/status\/(\d+)/,
        /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/,
        /status\/(\d+)/,
        /(\d+)$/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

module.exports = {
    twitter: twitterCommand,
    twt: twitterCommand,
    x: twitterCommand
};