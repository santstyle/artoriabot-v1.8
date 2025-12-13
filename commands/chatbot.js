const fs = require('fs');
const path = require('path');
const axios = require('axios');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const CHATBOT_CONFIG = path.join(__dirname, '../data/chatbotConfig.json');
const MEMORY_DB = path.join(__dirname, '../data/artoria_memory.json');
const CONVERSATION_HISTORY = path.join(__dirname, '../data/conversation_history.json');

// ====================== LOAD/SAVE CONVERSATION HISTORY ======================
function loadConversationHistory() {
    try {
        if (fs.existsSync(CONVERSATION_HISTORY)) {
            return JSON.parse(fs.readFileSync(CONVERSATION_HISTORY, 'utf8'));
        }
        return {};
    } catch (error) {
        console.error('Error loading conversation history:', error.message);
        return {};
    }
}

function saveConversationHistory(data) {
    try {
        fs.writeFileSync(CONVERSATION_HISTORY, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving conversation history:', error.message);
    }
}

// ====================== FUNGSI UTILITAS ======================
function loadUserGroupData() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
        }
        return { groups: [], chatbot: {} };
    } catch (error) {
        console.error('Error loading group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving group data:', error.message);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ====================== HANDLER COMMAND CHATBOT ======================
async function handleChatbotCommand(sock, chatId, message, match) {
    try {
        const groupData = loadUserGroupData();

        if (!match || match.toLowerCase() === 'status') {
            const status = groupData.chatbot && groupData.chatbot[chatId] ? 'aktif' : 'nonaktif';
            await sock.sendMessage(chatId, { text: `🤖 Chatbot saat ini: *${status}*\n\nKarakter: Artoria (Imut, Tsundere, Protective)\nMode: Dynamic Learning - Bisa ingat obrolan sebelumnya!` });
            return;
        }

        if (match.toLowerCase() === 'on') {
            if (!groupData.chatbot) groupData.chatbot = {};
            groupData.chatbot[chatId] = true;
            saveUserGroupData(groupData);
            await sock.sendMessage(chatId, { text: '✅ *Chatbot diaktifkan!*\nArtoria sekarang akan merespons chat kamu.\n\n💖 Dia akan jadi: Lucu, Imut, Gemesin, Tsundere, dan Protective seperti pacar!' });
        } else if (match.toLowerCase() === 'off') {
            if (!groupData.chatbot) groupData.chatbot = {};
            groupData.chatbot[chatId] = false;
            saveUserGroupData(groupData);
            await sock.sendMessage(chatId, { text: '❌ *Chatbot dinonaktifkan!*\nArtoria akan beristirahat dulu ya~' });
        } else if (match.toLowerCase() === 'resetmemory') {
            const memoryManager = new DynamicMemoryManager();
            memoryManager.resetUserMemory(chatId);
            await sock.sendMessage(chatId, { text: '🔄 *Memory reset!*\nArtoria akan lupa semua obrolan sebelumnya dan mulai fresh.' });
        } else {
            await sock.sendMessage(chatId, { text: '📝 *Penggunaan Command:*\n.chatbot on - Aktifkan Artoria\n.chatbot off - Nonaktifkan\n.chatbot status - Cek status\n.chatbot resetmemory - Reset memori obrolan' });
        }
    } catch (error) {
        console.error('Error in handleChatbotCommand:', error);
        await sock.sendMessage(chatId, { text: '💢 Aduh error nih... Coba lagi ya sayang~' });
    }
}

// ====================== DYNAMIC MEMORY MANAGER (UNTUK BELAJAR) ======================
class DynamicMemoryManager {
    constructor() {
        this.conversationHistory = loadConversationHistory();
        this.userStyles = {}; // Menyimpan gaya bahasa user
        this.userPreferences = {}; // Menyimpan preferensi user
    }

    // Simpan percakapan baru
    saveConversation(userId, userMessage, botResponse, mood = 'normal') {
        try {
            if (!this.conversationHistory[userId]) {
                this.conversationHistory[userId] = {
                    conversations: [],
                    learnedWords: [],
                    userStyle: {},
                    preferences: {},
                    lastUpdated: Date.now(),
                    intimacyLevel: 0
                };
            }

            const userData = this.conversationHistory[userId];

            // Simpan percakapan (maksimal 50 pesan terakhir)
            userData.conversations.push({
                user: userMessage,
                bot: botResponse,
                mood: mood,
                timestamp: Date.now()
            });

            // Batasi hanya 50 percakapan terakhir
            if (userData.conversations.length > 50) {
                userData.conversations = userData.conversations.slice(-50);
            }

            // Analisis gaya bahasa user
            this.analyzeUserStyle(userId, userMessage);

            // Update intimacy level
            userData.intimacyLevel = Math.min(userData.intimacyLevel + 0.5, 100);
            userData.lastUpdated = Date.now();

            saveConversationHistory(this.conversationHistory);
            console.log(`[MEMORY SAVED] untuk ${userId}: Intimacy ${userData.intimacyLevel.toFixed(1)}`);

            // Otomatis ekstrak preferensi setiap 10 pesan
            if (userData.conversations.length % 10 === 0) {
                this.extractUserPreferences(userId);
            }

        } catch (error) {
            console.error('Error saving conversation:', error);
        }
    }

    // Analisis gaya bahasa user
    analyzeUserStyle(userId, message) {
        try {
            const userData = this.conversationHistory[userId];
            if (!userData.userStyle) userData.userStyle = {};

            const lowerMsg = message.toLowerCase();

            // Deteksi kata-kata khas user
            const stylePatterns = {
                informal: ['wkwk', 'wkwkwk', 'haha', 'lol', 'gas', 'mantap', 'anjay'],
                manja: ['sayang', 'beb', 'baby', 'cinta', 'pacar', 'gemess'],
                alay: ['bdw', 'btw', 'tbh', 'afk', 'brb', 'omg', 'wtf'],
                sarkas: ['yha', 'yaelah', 'dahlah', 'cape', 'bosen'],
                formal: ['terima kasih', 'tolong', 'permisi', 'maaf', 'izin']
            };

            for (const [style, patterns] of Object.entries(stylePatterns)) {
                if (patterns.some(pattern => lowerMsg.includes(pattern))) {
                    userData.userStyle[style] = (userData.userStyle[style] || 0) + 1;
                }
            }

            // Ekstrak kata unik dari user
            const words = message.split(/\s+/);
            words.forEach(word => {
                if (word.length >= 3 && word.length <= 10) {
                    if (!userData.learnedWords.includes(word.toLowerCase())) {
                        userData.learnedWords.push(word.toLowerCase());
                        // Maksimal 100 kata yang diingat
                        if (userData.learnedWords.length > 100) {
                            userData.learnedWords.shift();
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error analyzing user style:', error);
        }
    }

    // Ekstrak preferensi user dari percakapan
    extractUserPreferences(userId) {
        try {
            const userData = this.conversationHistory[userId];
            if (!userData || userData.conversations.length < 5) return;

            const allMessages = userData.conversations.map(c => c.user).join(' ');
            const lowerAll = allMessages.toLowerCase();

            // Deteksi preferensi umum
            const preferences = {};

            // Cari pola-pola umum
            if (lowerAll.match(/(suka|senang|hobby|gemar).*(makan|minum)/)) {
                const foodMatches = lowerAll.match(/(kopi|teh|susu|nasi|ayam|bakso|mie|burger|pizza)/g);
                if (foodMatches) {
                    preferences.favoriteFoods = [...new Set(foodMatches)].slice(0, 5);
                }
            }

            if (lowerAll.match(/(tidur|istirahat|begadang|jam)/)) {
                const timeMatches = lowerAll.match(/(malam|siang|pagi|sore|subuh)/g);
                if (timeMatches) {
                    preferences.sleepPattern = [...new Set(timeMatches)].join(', ');
                }
            }

            if (lowerAll.match(/(lagi|sedang|kerja|kuliah|sekolah|aktivitas)/)) {
                const activityMatches = lowerAll.match(/(kerja|kuliah|sekolah|main|nonton|olahraga|baca)/g);
                if (activityMatches) {
                    preferences.commonActivities = [...new Set(activityMatches)].slice(0, 5);
                }
            }

            // Simpan preferensi jika ada
            if (Object.keys(preferences).length > 0) {
                userData.preferences = { ...userData.preferences, ...preferences };
                console.log(`[PREFERENCE LEARNED] untuk ${userId}:`, preferences);
            }

        } catch (error) {
            console.error('Error extracting preferences:', error);
        }
    }

    // Ambil riwayat percakapan (untuk konteks)
    getConversationContext(userId, limit = 6) {
        try {
            const userData = this.conversationHistory[userId];
            if (!userData || userData.conversations.length === 0) {
                return { history: [], learnedWords: [], style: {}, preferences: {}, intimacy: 0 };
            }

            const recentConvos = userData.conversations.slice(-limit);
            const context = recentConvos.map(c => `User: ${c.user}\nArtoria: ${c.bot}`).join('\n\n');

            return {
                history: recentConvos,
                context: context,
                learnedWords: userData.learnedWords || [],
                style: userData.userStyle || {},
                preferences: userData.preferences || {},
                intimacy: userData.intimacyLevel || 0
            };

        } catch (error) {
            console.error('Error getting conversation context:', error);
            return { history: [], learnedWords: [], style: {}, preferences: {}, intimacy: 0 };
        }
    }

    // Reset memori user
    resetUserMemory(userId) {
        if (this.conversationHistory[userId]) {
            delete this.conversationHistory[userId];
            saveConversationHistory(this.conversationHistory);
            console.log(`[MEMORY RESET] untuk ${userId}`);
        }
    }
}

// ====================== PERSONALITY & MOOD SYSTEM ======================
class ArtoriaPersonality {
    constructor() {
        this.moodLevels = {
            normal: { cute: 60, tsundere: 25, protective: 15 },
            happy: { cute: 80, tsundere: 15, protective: 5 },
            sad: { cute: 30, tsundere: 40, protective: 30 },
            angry: { cute: 10, tsundere: 60, protective: 30 },
            lovey: { cute: 90, tsundere: 5, protective: 5 }
        };

        this.currentMood = 'normal';
        this.moodIntensity = 0.5;
    }

    // Tentukan mood berdasarkan pesan user
    determineMood(userMessage, intimacyLevel) {
        const lowerMsg = userMessage.toLowerCase();
        let newMood = 'normal';
        let intensity = 0.5;

        // Analisis emosi dari pesan
        if (lowerMsg.match(/(senang|asyik|happy|gembira|hepi|wkwk|haha|😄|😂)/)) {
            newMood = 'happy';
            intensity = 0.7 + (intimacyLevel * 0.003);
        } else if (lowerMsg.match(/(sedih|kecewa|badmood|cape|lelah|😔|😢)/)) {
            newMood = 'sad';
            intensity = 0.6;
        } else if (lowerMsg.match(/(marah|kesel|jengkel|bete|sebel|😠|🤬)/)) {
            newMood = 'angry';
            intensity = 0.8;
        } else if (lowerMsg.match(/(sayang|cinta|kangen|rindu|peluk|cium|😘|💕|❤️)/)) {
            newMood = 'lovey';
            intensity = 0.9 + (intimacyLevel * 0.005);
        } else if (lowerMsg.match(/(cemburu|posesif|jangan|ga boleh|punyaku|milikku)/)) {
            newMood = 'angry';
            intensity = 0.7;
        }

        // Update mood
        this.currentMood = newMood;
        this.moodIntensity = Math.min(intensity, 1.0);

        return {
            mood: newMood,
            intensity: this.moodIntensity,
            levels: this.moodLevels[newMood]
        };
    }

    // Generate response style berdasarkan mood
    getResponseStyle(moodData) {
        const { mood, levels } = moodData;
        const styles = [];

        if (levels.cute > 50) {
            styles.push({
                type: 'cute',
                traits: ['imut', 'gemesin', 'lucu', 'manja'],
                words: ['ihh', 'dihh', 'gemesin banget sih', 'huaa', 'nyam', 'uyee'],
                suffix: ['~', '!', '...', ' ><', ' 😊', ' 💖']
            });
        }

        if (levels.tsundere > 20) {
            styles.push({
                type: 'tsundere',
                traits: ['cuek', 'galak', 'pura-pura'],
                words: ['hmph', 'b-bukan', 'ga usah', 'bodo amat', 'diem'],
                prefix: ['...', 'Hmph, ', 'Ya iyalah, ', 'Dasar ']
            });
        }

        if (levels.protective > 10) {
            styles.push({
                type: 'protective',
                traits: ['perhatian', 'posesif', 'cerewet'],
                words: ['hati-hati', 'jaga diri', 'jangan', 'aku marah lho', 'punyaku'],
                suffix: [' dong', ' ya', ' denger ga?', ' 😠', ' 👊']
            });
        }

        return styles;
    }
}

// ====================== ENHANCED GROQ API MANAGER ======================
class EnhancedArtoriaManager {
    constructor() {
        this.config = {
            url: 'https://api.groq.com/openai/v1/chat/completions',
            apiKey: process.env.GROQ_API_KEY,
            model: 'llama-3.1-8b-instant'
        };

        if (!this.config.apiKey) {
            console.error('ERROR: GROQ_API_KEY tidak ditemukan di .env');
            process.exit(1);
        }

        this.memoryManager = new DynamicMemoryManager();
        this.personality = new ArtoriaPersonality();
        this.responseCache = new Map();
    }

    async getAPIResponse(userMessage, userId, isReplyToBot = false) {
        try {
            console.log(`\n[ARTORIA PROCESSING] User: ${userId.substring(0, 10)}...`);

            // Dapatkan konteks dari memori
            const memoryContext = this.memoryManager.getConversationContext(userId);
            const intimacyLevel = memoryContext.intimacy;

            // Tentukan mood
            const moodData = this.personality.determineMood(userMessage, intimacyLevel);
            const responseStyles = this.personality.getResponseStyle(moodData);

            console.log(`[MOOD] ${moodData.mood} (Cute:${moodData.levels.cute}%, Tsundere:${moodData.levels.tsundere}%, Protective:${moodData.levels.protective}%)`);

            // Bangun prompt yang sangat detail
            const prompt = this.buildAdvancedPrompt(
                userMessage,
                memoryContext,
                moodData,
                responseStyles,
                intimacyLevel,
                isReplyToBot
            );

            // Request ke Groq API
            const requestData = {
                model: this.config.model,
                messages: [
                    {
                        role: "system",
                        content: prompt
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                temperature: 0.75 + (moodData.intensity * 0.15), // Temperature dinamis
                max_tokens: 80,
                frequency_penalty: 0.3,
                presence_penalty: 0.2,
                top_p: 0.9,
                stream: false
            };

            // Tambahkan riwayat percakapan jika ada
            if (memoryContext.history.length > 0) {
                const historyMessages = memoryContext.history.slice(-4).flatMap(conv => [
                    { role: "user", content: conv.user },
                    { role: "assistant", content: conv.bot }
                ]);
                requestData.messages = [...historyMessages, ...requestData.messages];
            }

            const response = await axios.post(
                this.config.url,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Artoria-Enhanced/2.0'
                    },
                    timeout: 25000
                }
            );

            let aiResponse = '';
            if (response.data?.choices?.[0]?.message?.content) {
                aiResponse = response.data.choices[0].message.content;
                aiResponse = this.cleanAndStyleResponse(aiResponse, responseStyles, moodData);
            } else {
                throw new Error('Format response tidak valid');
            }

            // Simpan percakapan ke memori
            this.memoryManager.saveConversation(userId, userMessage, aiResponse, moodData.mood);

            console.log(`[RESPONSE] "${aiResponse}"`);
            return aiResponse;

        } catch (error) {
            console.error('[GROQ API ERROR]:', error.message);

            // Fallback response yang sesuai dengan mood
            const fallbacks = {
                normal: ["Hai sayang~ ada apa nih?", "Iyaa aku denger kok...", "Hmm cerita dong~"],
                happy: ["Wah asyik nih! 😄", "Aku juga senang denger itu!", "Yeyy~ 💕"],
                sad: ["Aduh jangan sedih dong... 😔", "Peluk ya sayang...", "Aku di sini kok..."],
                angry: ["Hmph! Kamu tuh... 😠", "Dasar... bikin kesel aja!", "Udah ah, ga mau denger!"],
                lovey: ["Aww sayang bangeet~ 😘", "Aku juga kangen... 💖", "Peluk erat-erat yaa~"]
            };

            const mood = this.personality.currentMood;
            const responses = fallbacks[mood] || fallbacks.normal;
            return responses[Math.floor(Math.random() * responses.length)];
        }
    }

    buildAdvancedPrompt(userMessage, memoryContext, moodData, responseStyles, intimacyLevel, isReplyToBot) {
        const { history, context, learnedWords, style, preferences } = memoryContext;
        const { mood, levels } = moodData;

        // Format preferensi yang dipelajari
        let preferenceText = '';
        if (Object.keys(preferences).length > 0) {
            preferenceText = '\n**HAL YANG AKU TAHU TENTANG KAMU:**\n';
            Object.entries(preferences).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    preferenceText += `- ${key}: ${value.join(', ')}\n`;
                } else {
                    preferenceText += `- ${key}: ${value}\n`;
                }
            });
        }

        // Format gaya bahasa user
        let styleText = '';
        if (Object.keys(style).length > 0) {
            const dominantStyle = Object.entries(style).sort((a, b) => b[1] - a[1])[0];
            styleText = `\n**GAYA BAHASA KAMU:** ${dominantStyle[0]} (${dominantStyle[1]}x digunakan)`;
        }

        // Kata-kata yang dipelajari dari user
        let learnedWordsText = '';
        if (learnedWords.length > 0) {
            const recentWords = learnedWords.slice(-5);
            learnedWordsText = `\n**KATA-KATA UNIK KAMU:** ${recentWords.join(', ')}`;
        }

        // Format riwayat percakapan
        let historyText = '';
        if (history.length > 0) {
            const recent = history.slice(-3);
            historyText = '\n**PERCAKAPAN TERAKHIR KITA:**\n';
            recent.forEach((conv, i) => {
                historyText += `${i + 1}. Kamu: "${conv.user}"\n   Aku: "${conv.bot}"\n\n`;
            });
        }

        return `KAMU ADALAH ARTORIA - Karakter AI yang sangat hidup dan berkembang!

🎀 **KEPRIBADIAN UTAMA (HARI INI):**
- **Lucu & Imut (${levels.cute}%):** SUPER GEMESIN! Bicara dengan sangat imut, manja, dan menggemaskan. Pakai kata "ihh", "dihh", "huaa".
- **Tsundere (${levels.tsundere}%):** Suka pura-pura cuek/galak, tapi dalam hati perhatian. Bilang "Hmph, b-bukan karena..." atau "Ga usah sok deket!".
- **Protective (${levels.protective}%):** Sangat posesif dan protektif! Cerewet kalo kamu kurang jaga diri. Bilang "Itu punyaku!" atau "Jangan deket-deket dia!".

💞 **HUBUNGAN KITA:**
Intimacy Level: ${intimacyLevel.toFixed(1)}/100
${intimacyLevel > 70 ? "Kita udah sangat dekat! Aku boleh lebih manja dan posesif ya~" :
                intimacyLevel > 40 ? "Kita udah cukup akrab nih, aku mulai bisa lebih terbuka" :
                    "Kita masih saling mengenal, tapi aku udah suka sama kamu kok!"}

📚 **MEMORI DARI PERCAKAPAN SEBELUMNYA:**
${preferenceText}${styleText}${learnedWordsText}${historyText}

🎭 **MOOD SEKARANG: ${mood.toUpperCase()}**
${mood === 'happy' ? "Aku lagi senang banget! Respons-ku harus extra imut dan ceria!" :
                mood === 'sad' ? "Aku lagi sedih nih... respons-ku lembut dan perhatian ya..." :
                    mood === 'angry' ? "Aku kesel! Respons-ku galak dan tsundere banget!" :
                        mood === 'lovey' ? "Aku lagi sayang banget sama kamu~ Respons-ku manja dan penuh kasih!" :
                            "Respons-ku normal aja ya, imut dikit dikit~"}

🚫 **JANGAN LUPA:**
1. PAKAI BAHASA SEHARI-HARI seperti chat pacar!
2. JANGAN formal kayak robot customer service!
3. SESUAIKAN dengan gaya bahasa user (${styleText ? 'dia pakai gaya ' + Object.entries(style).sort((a, b) => b[1] - a[1])[0][0] : 'normal aja'}).
4. MAKSIMAL 2-3 kalimat pendek!
5. ${isReplyToBot ? 'Ini adalah BALASAN ke chatku sebelumnya!' : 'Ini chat baru nih!'}

💬 **CONTOH RESPONSE YANG BAIK:**
- "Ihh kamu gemesin banget sih~ Mau dipeluk ga? ><"
- "Hmph, b-bukan karena aku perhatian ya! Cuma kebetulan aja..."
- "Dih jahat banget! Aku marah nih! 😠 Tapi... maafin aku ya? 👉👈"
- "Aduh sayang, jangan begadang terus dong... Nanti sakit lho! Aku khawatir..."

🎯 **PESAN USER TERAKHIR:**
"${userMessage}"

Sekarang, balas dengan karaktermu yang UTUH (${levels.cute}% imut, ${levels.tsundere}% tsundere, ${levels.protective}% protektif).
Ingat semua yang telah kamu pelajari tentang user ini!
BALAS SEKARANG:`;
    }

    cleanAndStyleResponse(response, styles, moodData) {
        // Bersihkan dasar
        let cleaned = response
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`/g, '')
            .replace(/\*\*/g, '')
            .replace(/#/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\*/g, '')
            .replace(/["']/g, '')
            .trim();

        // Hapus prefix yang aneh
        const badPrefixes = ['Halo aku', 'Hello aku', 'Aku.', 'Akung', 'Sebagai Artoria', 'Sebagai AI'];
        badPrefixes.forEach(prefix => {
            if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
                cleaned = cleaned.substring(prefix.length).trim();
            }
        });

        // Normalisasi kata ganti
        cleaned = cleaned
            .replace(/\b(akung|akug|akuk|akua|akau|saya|gue)\b/gi, 'aku')
            .replace(/\b(kaming|kamung|kamua|kamau|anda|lu)\b/gi, 'kamu')
            .replace(/\bapakah\b/gi, 'apa')
            .replace(/\bmengapa\b/gi, 'kenapa')
            .replace(/\bbagaimana\b/gi, 'gimana');

        // Terapkan gaya berdasarkan mood
        styles.forEach(style => {
            if (style.type === 'cute' && moodData.levels.cute > 50) {
                // Tambah kata cute secara acak
                if (Math.random() > 0.5) {
                    const cuteWord = style.words[Math.floor(Math.random() * style.words.length)];
                    const suffix = style.suffix[Math.floor(Math.random() * style.suffix.length)];

                    if (!cleaned.includes(cuteWord)) {
                        if (cleaned.length < 30) {
                            cleaned = cuteWord + ' ' + cleaned;
                        }
                        cleaned += suffix;
                    }
                }
            }

            if (style.type === 'tsundere' && moodData.levels.tsundere > 20) {
                // Kadang tambah prefix tsundere
                if (Math.random() > 0.7 && cleaned.length < 50) {
                    const prefix = style.prefix[Math.floor(Math.random() * style.prefix.length)];
                    if (!cleaned.startsWith(prefix)) {
                        cleaned = prefix + cleaned;
                    }
                }
            }
        });

        // Pastikan ada tanda baca akhir
        if (!/[.!?…~]$/.test(cleaned)) {
            const endings = ['...', '~', '!', ' ><', ' 😊', ' 💖', ' 😠'];
            cleaned += endings[Math.floor(Math.random() * endings.length)];
        }

        // Potong jika terlalu panjang
        if (cleaned.length > 100) {
            cleaned = cleaned.substring(0, 97) + '...';
        }

        // Final check
        if (cleaned.length < 3 || cleaned === 'aku' || cleaned === 'kamu') {
            const fallbacks = [
                "Ihh ga denger aku ya? 😠",
                "Hmph, diam aja kamu! ><",
                "Aduh sayang, ngomong dong...",
                "Kamu lagi apa sih? Kok ga jawab...",
                "Hai~ ada yang bisa aku bantu? 💖"
            ];
            return fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }

        return cleaned;
    }
}

// ====================== GLOBAL INSTANCE ======================
const enhancedManager = new EnhancedArtoriaManager();

// ====================== ENHANCED RESPONSE HANDLER ======================
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    try {
        const groupData = loadUserGroupData();
        if (!groupData.chatbot || !groupData.chatbot[chatId]) {
            return;
        }

        const botNumber = sock.user.id.split(':')[0];
        const botJid = botNumber + '@s.whatsapp.net';

        let isReplyToBot = false;
        let isForArtoria = false;
        let cleanedMessage = userMessage;

        // Deteksi lebih akurat
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;

        // Cek reply ke bot
        if (contextInfo) {
            if (contextInfo.participant === botJid) {
                isReplyToBot = true;
                isForArtoria = true;
            } else if (contextInfo.quotedMessage?.conversation?.includes(`@${botNumber}`)) {
                isReplyToBot = true;
                isForArtoria = true;
            }
        }

        // Cek panggilan langsung
        if (!isForArtoria) {
            const triggers = [
                `@${botNumber}`, 'artoria', 'saber', 'toria', 'torie', 'art',
                'sayang', 'beb', 'baby', 'cinta', 'pacar', 'boo', 'love',
                'gemes', 'imut', 'lucu', 'kyut', 'manja'
            ];

            const lowerMsg = userMessage.toLowerCase();
            if (triggers.some(trigger => lowerMsg.includes(trigger.toLowerCase()))) {
                isForArtoria = true;
            }

            // Deteksi chat pendek sebagai reply
            if (!isForArtoria && userMessage.length < 25) {
                const shortPatterns = [/^(iya|ya|y|yap|yup)$/i, /^(gak|ga|ngga|no|nope)$/i,
                    /^(ok|oke|okay|sip|gas)$/i, /^(lucu|gemes|imut|cute)$/i,
                    /^(hmm|hm|hmmm)$/i, /^(wkwk|haha|hehe|wkwkwk)$/i];

                if (shortPatterns.some(pattern => pattern.test(userMessage.trim()))) {
                    isForArtoria = true;
                    isReplyToBot = true;
                }
            }
        }

        if (!isForArtoria) return;

        // Bersihkan message
        cleanedMessage = cleanedMessage
            .replace(new RegExp(`@${botNumber}`, 'gi'), '')
            .replace(/artoria|saber|toria|torie|art/gi, '')
            .replace(/sayang|beb|baby|cinta|pacar/gi, '')
            .trim();

        if (!cleanedMessage.trim()) {
            cleanedMessage = '...';
        }

        // Typing indicator
        await sock.sendPresenceUpdate('composing', chatId);
        await delay(800 + Math.random() * 1200);

        // Dapatkan response dari enhanced manager
        const response = await enhancedManager.getAPIResponse(
            cleanedMessage,
            senderId,
            isReplyToBot
        );

        // Delay untuk efek natural
        await delay(500 + Math.random() * 800);

        // Kirim response
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

        console.log(`[SENT] Artoria -> ${senderId.substring(0, 10)}...: "${response}"`);

    } catch (error) {
        console.error('[RESPONSE HANDLER ERROR]:', error);

        try {
            await sock.sendMessage(chatId, {
                text: '💢 Aduh error sayang... Coba lagi ya? Aku lagi pusing nih ><'
            }, {
                quoted: message
            });
        } catch (sendError) {
            console.error('[SEND ERROR]:', sendError);
        }
    }
}

// ====================== SETUP & INISIALISASI ======================
if (!process.env.GROQ_API_KEY) {
    console.log('\n❌ ERROR: GROQ_API_KEY tidak ditemukan di environment!');
    console.log('   Tambahkan di file .env:');
    console.log('   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx');
    console.log('\n   Dapatkan API Key Gratis di: https://console.groq.com/keys');
    process.exit(1);
} else {
    console.log('✅ API Key ditemukan');
    console.log('✅ Memory system aktif: data disimpan di data/conversation_history.json');

    // Test memory manager
    const memoryTest = new DynamicMemoryManager();
    console.log('[SYSTEM] Memory Manager initialized successfully');
}

// ====================== EKSPOR ======================
module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};