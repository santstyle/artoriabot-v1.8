const fs = require('fs');
const path = require('path');
const axios = require('axios');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const CHATBOT_CONFIG = path.join(__dirname, '../data/chatbotConfig.json');
const MEMORY_DB = path.join(__dirname, '../data/artoria_memory.json');

// ====================== KONFIGURASI API ======================
const API_CONFIGS = {
    DEEPSEEK: {
        url: 'https://api.deepseek.com/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        free: true
    },
    GROQ: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.1-8b-instant',
        free: true
    },
    OPENAI: {
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        free: false
    }
};

const ACTIVE_API = 'GROQ';

// ====================== SISTEM MEMORY KOMPLEKS ======================
class AdvancedMemorySystem {
    constructor() {
        this.memories = new Map();
        this.conversationPatterns = new Map();
        this.userKnowledge = new Map();
        this.loadMemory();
    }

    loadMemory() {
        try {
            if (fs.existsSync(MEMORY_DB)) {
                const data = JSON.parse(fs.readFileSync(MEMORY_DB, 'utf8'));
                this.memories = new Map(Object.entries(data.memories || {}));
                this.conversationPatterns = new Map(Object.entries(data.patterns || {}));
                this.userKnowledge = new Map(Object.entries(data.knowledge || {}));
            }
        } catch (error) {
            console.log('Membuat memory database baru');
        }
    }

    saveMemory() {
        try {
            const data = {
                memories: Object.fromEntries(this.memories),
                patterns: Object.fromEntries(this.conversationPatterns),
                knowledge: Object.fromEntries(this.userKnowledge),
                lastSaved: new Date().toISOString()
            };
            fs.writeFileSync(MEMORY_DB, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving memory:', error);
        }
    }

    rememberConversation(userId, message, response) {
        const key = `${userId}_${Date.now()}`;
        const memory = {
            message: message.substring(0, 200),
            response: response.substring(0, 200),
            timestamp: new Date().toISOString(),
            context: this.extractContext(message)
        };

        if (!this.memories.has(userId)) {
            this.memories.set(userId, []);
        }

        const userMemories = this.memories.get(userId);
        userMemories.push(memory);

        if (userMemories.length > 50) {
            userMemories.shift();
        }

        this.analyzePattern(userId, message, response);
        this.extractKnowledge(userId, message);

        if (userMemories.length % 10 === 0) {
            this.saveMemory();
        }
    }

    extractContext(message) {
        const topics = [];
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.match(/(makan|makanan|restoran|lapar|nyam)/)) topics.push('food');
        if (lowerMsg.match(/(tidur|ngantuk|mimpi|kasur|bobo)/)) topics.push('sleep');
        if (lowerMsg.match(/(sekolah|kerja|kantor|tugas|belajar)/)) topics.push('work');
        if (lowerMsg.match(/(hobi|game|musik|film|baca)/)) topics.push('hobby');
        if (lowerMsg.match(/(keluarga|teman|pacar|orang tua|saudara)/)) topics.push('family');
        if (lowerMsg.match(/(cuaca|hujan|panas|dingin|musim)/)) topics.push('weather');
        if (lowerMsg.match(/(perasaan|hati|sedih|senang|marah)/)) topics.push('emotion');
        if (lowerMsg.match(/(rencana|besok|nanti|minggu depan|future)/)) topics.push('plans');

        return topics;
    }

    analyzePattern(userId, message, response) {
        const patternKey = this.createPatternKey(message);
        if (!this.conversationPatterns.has(patternKey)) {
            this.conversationPatterns.set(patternKey, []);
        }

        const patterns = this.conversationPatterns.get(patternKey);
        patterns.push({
            userId: userId,
            response: response,
            timestamp: new Date().toISOString()
        });

        if (patterns.length > 20) {
            patterns.shift();
        }
    }

    createPatternKey(message) {
        // Create pattern based on message structure
        const words = message.toLowerCase().split(/\s+/).slice(0, 5);
        return words.join('_');
    }

    extractKnowledge(userId, message) {
        if (!this.userKnowledge.has(userId)) {
            this.userKnowledge.set(userId, {
                likes: [],
                dislikes: [],
                facts: [],
                preferences: {},
                secrets: []
            });
        }

        const knowledge = this.userKnowledge.get(userId);
        const lowerMsg = message.toLowerCase();

        // Extract likes
        if (lowerMsg.match(/(suka|suka banget|favorit|kesukaan)/)) {
            const match = message.match(/(suka|suka banget|favorit|kesukaan)\s+([^.!?]+)/i);
            if (match && match[2]) {
                if (!knowledge.likes.includes(match[2].trim())) {
                    knowledge.likes.push(match[2].trim().substring(0, 50));
                }
            }
        }

        // Extract dislikes
        if (lowerMsg.match(/(gak suka|benci|gak doyan|gak demen)/)) {
            const match = message.match(/(gak suka|benci|gak doyan|gak demen)\s+([^.!?]+)/i);
            if (match && match[2]) {
                if (!knowledge.dislikes.includes(match[2].trim())) {
                    knowledge.dislikes.push(match[2].trim().substring(0, 50));
                }
            }
        }

        // Extract facts
        if (lowerMsg.match(/(umur|usia|tinggal|tinggal di|asal|kerja sebagai)/)) {
            knowledge.facts.push(message.substring(0, 100));
        }
    }

    getRelevantMemories(userId, currentMessage, limit = 5) {
        if (!this.memories.has(userId)) return [];

        const memories = this.memories.get(userId);
        const currentContext = this.extractContext(currentMessage);

        // Score each memory based on relevance
        const scoredMemories = memories.map((memory, index) => {
            let score = 0;

            // Context similarity
            const contextMatch = memory.context.filter(ctx =>
                currentContext.includes(ctx)).length;
            score += contextMatch * 10;

            // Recency bonus
            const age = Date.now() - new Date(memory.timestamp).getTime();
            const daysOld = age / (1000 * 60 * 60 * 24);
            score += Math.max(0, 30 - daysOld);

            // Semantic similarity (simple keyword matching)
            const sharedWords = this.countSharedWords(currentMessage, memory.message);
            score += sharedWords * 5;

            return { ...memory, score, originalIndex: index };
        });

        scoredMemories.sort((a, b) => b.score - a.score);
        return scoredMemories.slice(0, limit);
    }

    countSharedWords(str1, str2) {
        const words1 = new Set(str1.toLowerCase().split(/\W+/));
        const words2 = str2.toLowerCase().split(/\W+/);
        return words2.filter(word => words1.has(word)).length;
    }

    getPersonalizedResponsePattern(userId, message) {
        const patternKey = this.createPatternKey(message);
        if (!this.conversationPatterns.has(patternKey)) return null;

        const patterns = this.conversationPatterns.get(patternKey);
        const userPatterns = patterns.filter(p => p.userId === userId);

        if (userPatterns.length > 0) {
            // Return the most recent response for this pattern
            return userPatterns[userPatterns.length - 1].response;
        }

        // If no user-specific pattern, return most common response
        const responseCounts = new Map();
        patterns.forEach(p => {
            responseCounts.set(p.response, (responseCounts.get(p.response) || 0) + 1);
        });

        let mostCommon = null;
        let maxCount = 0;
        for (const [response, count] of responseCounts) {
            if (count > maxCount) {
                mostCommon = response;
                maxCount = count;
            }
        }

        return mostCommon;
    }
}

// ====================== SISTEM EMOSI KOMPLEKS ======================
class AdvancedEmotionSystem {
    constructor() {
        this.emotionStates = new Map();
        this.emotionHistory = new Map();
        this.emotionTriggers = this.createEmotionTriggers();
    }

    createEmotionTriggers() {
        return {
            happy: [
                /senang|bahagia|gembira|asyik|keren|wow|mantap|yes|hore/i,
                /selamat|congrat|good job|nice work/i,
                /love you|suka banget|kamu terbaik/i
            ],
            sad: [
                /sedih|kecewa|marah|kesal|capek|lelah|bosan|badmood/i,
                /gak enak|sakit|patah hati|putus|ditinggal/i,
                /menangis|nangis|gregetan|frustrasi/i
            ],
            angry: [
                /goblok|idiot|bego|tolol|dasar/i,
                /kesel banget|gemes|jengkel|dongkol/i,
                /pergi sana|jangan ganggu|bencong|anjing/i
            ],
            shy: [
                /imut|gemas|manis|malu|malu-malu|shy/i,
                /cium|peluk|deket|berdua|berduaan/i,
                /katakan|ngomong|jujur|perasaan/i
            ],
            jealous: [
                /pacar|mantan|gebetan|cowok|cewek|doi/i,
                /deket sama|bareng|perhatian|sama siapa/i,
                /gak boleh|jangan|jauhi|tinggalin/i
            ],
            caring: [
                /jaga|hati-hati|sakit|lelah|cape|istirahat/i,
                /makan|minum|tidur|jangan begadang/i,
                /perhatian|sayang|rindu|kangen/i
            ]
        };
    }

    analyzeEmotion(message, userId, relationshipLevel) {
        const scores = {
            happy: 0,
            sad: 0,
            angry: 0,
            shy: 0,
            jealous: 0,
            caring: 0
        };

        // Check triggers
        for (const [emotion, triggers] of Object.entries(this.emotionTriggers)) {
            triggers.forEach(trigger => {
                if (trigger.test(message)) {
                    scores[emotion] += 2;
                }
            });
        }

        // Message length affect
        const words = message.split(/\s+/).length;
        if (words < 3) scores.shy += 1;
        if (words > 20) scores.caring += 1;

        // Punctuation affect
        if (message.includes('?')) scores.caring += 1;
        if (message.includes('!')) {
            if (message.includes('!!!')) scores.angry += 2;
            else scores.happy += 1;
        }
        if (message.includes('...')) scores.shy += 2;

        // Relationship level affect
        if (relationshipLevel === 'spesial') {
            scores.shy += 3;
            scores.jealous += 2;
            scores.caring += 3;
        } else if (relationshipLevel === 'dekat') {
            scores.shy += 1;
            scores.caring += 2;
        }

        // Find dominant emotion
        let dominantEmotion = 'neutral';
        let maxScore = 0;

        for (const [emotion, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                dominantEmotion = emotion;
            }
        }

        // Track emotion history
        if (!this.emotionHistory.has(userId)) {
            this.emotionHistory.set(userId, []);
        }

        const history = this.emotionHistory.get(userId);
        history.push({
            emotion: dominantEmotion,
            intensity: maxScore,
            timestamp: new Date().toISOString(),
            message: message.substring(0, 100)
        });

        if (history.length > 20) {
            history.shift();
        }

        // Calculate emotional state (mood + intensity)
        const emotionalState = {
            primary: dominantEmotion,
            secondary: this.getSecondaryEmotion(scores, dominantEmotion),
            intensity: Math.min(maxScore / 10, 1.0),
            volatility: this.calculateVolatility(history)
        };

        if (!this.emotionStates.has(userId)) {
            this.emotionStates.set(userId, []);
        }

        this.emotionStates.get(userId).push(emotionalState);

        return emotionalState;
    }

    getSecondaryEmotion(scores, primary) {
        const filtered = { ...scores };
        delete filtered[primary];

        let secondary = 'neutral';
        let maxScore = 0;

        for (const [emotion, score] of Object.entries(filtered)) {
            if (score > maxScore) {
                maxScore = score;
                secondary = emotion;
            }
        }

        return secondary;
    }

    calculateVolatility(history) {
        if (history.length < 2) return 0;

        let changes = 0;
        for (let i = 1; i < history.length; i++) {
            if (history[i].emotion !== history[i - 1].emotion) {
                changes++;
            }
        }

        return changes / (history.length - 1);
    }

    getEmotionalTendency(userId) {
        if (!this.emotionHistory.has(userId)) return 'stable';

        const history = this.emotionHistory.get(userId);
        if (history.length < 5) return 'stable';

        const happyCount = history.filter(h => h.emotion === 'happy').length;
        const sadCount = history.filter(h => h.emotion === 'sad').length;
        const ratio = history.length / 5;

        if (happyCount / ratio > 3) return 'optimistic';
        if (sadCount / ratio > 3) return 'pessimistic';
        if (this.calculateVolatility(history) > 0.6) return 'unstable';

        return 'balanced';
    }
}

// ====================== SISTEM PERSONALITY KOMPLEKS ======================
class AdvancedPersonalitySystem {
    constructor() {
        this.memorySystem = new AdvancedMemorySystem();
        this.emotionSystem = new AdvancedEmotionSystem();
        this.personalityTraits = this.createPersonalityTraits();
        this.conversationStyles = this.createConversationStyles();
        this.loadPersonality();
    }

    createPersonalityTraits() {
        return {
            tsundereLevel: 0.9, // 0-1, 1 = maximum tsundere
            affectionLevel: 0.7,
            jealousyLevel: 0.8,
            shynessLevel: 0.6,
            playfulnessLevel: 0.5,
            sarcasmLevel: 0.4,
            wisdomLevel: 0.3,
            protectivenessLevel: 0.8
        };
    }

    createConversationStyles() {
        return {
            distant: {
                formality: 0.8,
                warmth: 0.2,
                openness: 0.3,
                playfulness: 0.1,
                tsundere: 0.3
            },
            casual: {
                formality: 0.4,
                warmth: 0.5,
                openness: 0.6,
                playfulness: 0.4,
                tsundere: 0.6
            },
            affectionate: {
                formality: 0.2,
                warmth: 0.8,
                openness: 0.7,
                playfulness: 0.6,
                tsundere: 0.7
            },
            intimate: {
                formality: 0.1,
                warmth: 0.9,
                openness: 0.9,
                playfulness: 0.7,
                tsundere: 0.8
            }
        };
    }

    loadPersonality() {
        try {
            if (fs.existsSync(CHATBOT_CONFIG)) {
                const config = JSON.parse(fs.readFileSync(CHATBOT_CONFIG));
                Object.assign(this.personalityTraits, config.personalityTraits || {});
            }
        } catch (error) {
            console.log('Menggunakan personality default');
        }
    }

    savePersonality() {
        try {
            const config = {
                personalityTraits: this.personalityTraits,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(CHATBOT_CONFIG, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error menyimpan personality:', error);
        }
    }

    getConversationStyle(relationshipLevel, emotionalState) {
        const baseStyle = this.conversationStyles[relationshipLevel] || this.conversationStyles.casual;

        // Adjust based on emotional state
        const adjustedStyle = { ...baseStyle };

        switch (emotionalState.primary) {
            case 'happy':
                adjustedStyle.warmth += 0.2;
                adjustedStyle.playfulness += 0.3;
                break;
            case 'sad':
                adjustedStyle.warmth += 0.3;
                adjustedStyle.playfulness -= 0.2;
                break;
            case 'shy':
                adjustedStyle.tsundere += 0.2;
                adjustedStyle.openness -= 0.1;
                break;
            case 'jealous':
                adjustedStyle.tsundere += 0.3;
                adjustedStyle.warmth -= 0.1;
                break;
        }

        // Clamp values between 0 and 1
        for (const key in adjustedStyle) {
            adjustedStyle[key] = Math.max(0, Math.min(1, adjustedStyle[key]));
        }

        return adjustedStyle;
    }

    generateResponseCharacteristics(style, messageLength) {
        const characteristics = {
            sentenceCount: Math.floor(Math.random() * 2) + 1,
            useEllipsis: Math.random() < style.tsundere * 0.8,
            useStuttering: Math.random() < style.tsundere * 0.6,
            useTeasing: Math.random() < style.playfulness * 0.7,
            useAffection: Math.random() < style.warmth * 0.9,
            includeMemory: Math.random() < 0.3,
            responseLength: Math.min(150, Math.max(50, messageLength * 2))
        };

        return characteristics;
    }

    getPersonalizedVocabulary(userId, style) {
        const baseVocab = {
            termsOfEndearment: ['sayang', 'beb', 'baby', 'cinta', 'boo'],
            teasingTerms: ['idiot', 'bego', 'goblok', 'tolol'],
            affectionateTerms: ['manis', 'imut', 'gemas', 'kyut'],
            possessiveTerms: ['punyaku', 'milikku', 'cuma aku', 'hanya untukku']
        };

        // Get user knowledge for personalized terms
        const knowledge = this.memorySystem.userKnowledge.get(userId);
        const personalizedVocab = { ...baseVocab };

        if (knowledge && knowledge.likes.length > 0 && style.warmth > 0.5) {
            // Add user's likes as potential terms
            personalizedVocab.termsOfEndearment.push(
                ...knowledge.likes.slice(0, 3).map(like => like.toLowerCase())
            );
        }

        return personalizedVocab;
    }
}

// ====================== ARTORIA PERSONALITY MANAGER (COMPLETE REWORK) ======================
class ArtoriaPersonalityManager {
    constructor() {
        this.personalitySystem = new AdvancedPersonalitySystem();
        this.memorySystem = this.personalitySystem.memorySystem;
        this.emotionSystem = this.personalitySystem.emotionSystem;
        this.relationships = new Map();
        this.conversationHistory = new Map();
        this.responseRegistry = new Set(); // Untuk mencegah response duplikat
    }

    getRelationshipLevel(userId) {
        if (!this.relationships.has(userId)) {
            this.relationships.set(userId, {
                intimacy: 0,
                trust: 0,
                affection: 0,
                sharedSecrets: 0,
                insideJokes: [],
                lastInteraction: new Date().toISOString()
            });
        }
        const rel = this.relationships.get(userId);

        const total = (rel.intimacy + rel.trust + rel.affection) / 3;
        if (total < 15) return "asing";
        if (total < 35) return "kenalan";
        if (total < 55) return "teman";
        if (total < 75) return "dekat";
        return "spesial";
    }

    updateRelationship(userId, interactionType, emotionalImpact) {
        const rel = this.relationships.has(userId)
            ? this.relationships.get(userId)
            : {
                intimacy: 0,
                trust: 0,
                affection: 0,
                sharedSecrets: 0,
                insideJokes: [],
                lastInteraction: new Date().toISOString()
            };

        const impact = emotionalImpact || 1;

        switch (interactionType) {
            case 'deep_conversation':
                rel.intimacy += 3 * impact;
                rel.trust += 2 * impact;
                break;
            case 'emotional_sharing':
                rel.intimacy += 4 * impact;
                rel.sharedSecrets += 1;
                break;
            case 'playful_teasing':
                rel.affection += 2 * impact;
                rel.intimacy += 1 * impact;
                break;
            case 'caring_interaction':
                rel.trust += 3 * impact;
                rel.affection += 2 * impact;
                break;
            case 'affectionate':
                rel.affection += 4 * impact;
                rel.intimacy += 2 * impact;
                break;
            default:
                rel.intimacy += 1 * impact;
        }

        rel.lastInteraction = new Date().toISOString();
        this.relationships.set(userId, rel);

        // Simpan setiap 10 interaksi
        if (rel.intimacy % 10 === 0) {
            this.personalitySystem.savePersonality();
            this.memorySystem.saveMemory();
        }

        return rel;
    }

    getConversationHistory(userId) {
        if (!this.conversationHistory.has(userId)) {
            this.conversationHistory.set(userId, []);
        }
        return this.conversationHistory.get(userId);
    }

    addToHistory(userId, role, content) {
        const history = this.getConversationHistory(userId);
        const message = {
            role,
            content: content.substring(0, 300),
            timestamp: new Date().toISOString(),
            hash: this.hashContent(content)
        };

        // Cek duplikat
        const isDuplicate = history.some(msg => msg.hash === message.hash);
        if (!isDuplicate) {
            history.push(message);

            if (history.length > 15) {
                history.shift();
            }
        }

        return history;
    }

    hashContent(content) {
        // Simple hash untuk deteksi duplikat
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            hash = ((hash << 5) - hash) + content.charCodeAt(i);
            hash = hash & hash;
        }
        return hash;
    }

    isResponseUnique(response, userId) {
        const hash = this.hashContent(response);
        const key = `${userId}_${hash}`;

        if (this.responseRegistry.has(key)) {
            return false;
        }

        this.responseRegistry.add(key);

        // Cleanup old hashes (keep last 100)
        if (this.responseRegistry.size > 100) {
            const entries = Array.from(this.responseRegistry);
            this.responseRegistry = new Set(entries.slice(-100));
        }

        return true;
    }

    buildAdvancedPrompt(userMessage, userId) {
        const relationshipLevel = this.getRelationshipLevel(userId);
        const emotionalState = this.emotionSystem.analyzeEmotion(userMessage, userId, relationshipLevel);
        const conversationStyle = this.personalitySystem.getConversationStyle(relationshipLevel, emotionalState);
        const responseChars = this.personalitySystem.generateResponseCharacteristics(conversationStyle, userMessage.length);
        const vocabulary = this.personalitySystem.getPersonalizedVocabulary(userId, conversationStyle);

        // Get relevant memories
        const relevantMemories = this.memorySystem.getRelevantMemories(userId, userMessage, 3);
        const previousPattern = this.memorySystem.getPersonalizedResponsePattern(userId, userMessage);

        // Get user knowledge
        const knowledge = this.memorySystem.userKnowledge.get(userId);

        // Build memory context
        let memoryContext = '';
        if (relevantMemories.length > 0) {
            memoryContext = '\nMEMORI RELEVAN:\n' + relevantMemories.map((mem, i) =>
                `[${i + 1}] Kamu: "${mem.message}"\n   Artoria: "${mem.response}"`
            ).join('\n');
        }

        // Build knowledge context
        let knowledgeContext = '';
        if (knowledge) {
            const knowledgePoints = [];
            if (knowledge.likes.length > 0) {
                knowledgePoints.push(`Suka: ${knowledge.likes.slice(0, 3).join(', ')}`);
            }
            if (knowledge.dislikes.length > 0) {
                knowledgePoints.push(`Tidak suka: ${knowledge.dislikes.slice(0, 3).join(', ')}`);
            }
            if (knowledge.facts.length > 0) {
                knowledgePoints.push(`Fakta: ${knowledge.facts.slice(0, 2).join('; ')}`);
            }
            if (knowledgePoints.length > 0) {
                knowledgeContext = '\nPENGETAHUAN TENTANG USER:\n' + knowledgePoints.join('\n');
            }
        }

        // Build emotional context
        const emotionalTendency = this.emotionSystem.getEmotionalTendency(userId);
        const emotionContext = `\nKONTEKS EMOSIONAL:
Emosi saat ini: ${emotionalState.primary} (${Math.round(emotionalState.intensity * 100)}%)
Emosi sekunder: ${emotionalState.secondary}
Kecenderungan: ${emotionalTendency}
Volatilitas: ${Math.round(emotionalState.volatility * 100)}%`;

        // Build relationship context
        const rel = this.relationships.get(userId) || { intimacy: 0, trust: 0, affection: 0 };
        const relationshipContext = `\nLEVEL HUBUNGAN: ${relationshipLevel.toUpperCase()}
Intimacy: ${Math.round(rel.intimacy)} | Trust: ${Math.round(rel.trust)} | Affection: ${Math.round(rel.affection)}`;

        // Build style guide
        const styleGuide = `\nPANDUAN GAYA RESPONS:
- Jumlah kalimat: ${responseChars.sentenceCount}
- ${responseChars.useEllipsis ? 'Gunakan ... saat malu/gemas' : 'Hindari terlalu banyak ...'}
- ${responseChars.useStuttering ? 'Boleh terputus-putus saat grogi' : 'Bicara lancar'}
- ${responseChars.useTeasing ? 'Boleh sedikit mengejek dengan manja' : 'Hindari ejekan'}
- ${responseChars.useAffection ? 'Tunjukkan kasih sayang' : 'Jaga jarak'}
- ${responseChars.includeMemory ? 'Sertakan referensi memori' : 'Fokus ke percakapan sekarang'}
- Panjang respons: ~${responseChars.responseLength} karakter`;

        // Build vocabulary guide
        const vocabGuide = `\nKOSAKATA YANG BOLEH DIGUNAKAN:
Sebutan sayang: ${vocabulary.termsOfEndearment.slice(0, 3).join(', ')}
Ejekan manja: ${vocabulary.teasingTerms.slice(0, 2).join(', ')}
Pujian: ${vocabulary.affectionateTerms.slice(0, 2).join(', ')}
Posesif: ${vocabulary.possessiveTerms.slice(0, 2).join(', ')}`;

        // Previous pattern warning
        const patternWarning = previousPattern ?
            `\nPERINGATAN: Jangan gunakan respons sebelumnya untuk pola ini: "${previousPattern.substring(0, 50)}..."` :
            '';

        const prompt = `Kamu adalah Artoria, gadis tsundere yang sangat imut, posesif, dan manja.

${relationshipContext}
${emotionContext}
${knowledgeContext}
${memoryContext}

KARAKTER INTI:
1. TSUNDERE LEVEL MAX - cuek di luar tapi perhatian dan manja saat berdua
2. Sangat posesif dan cemburu - "Kamu cuma boleh sama aku!"
3. Super imut - mudah gemas, muka merah, bicara terputus
4. Manja ekstrem - suka ditemani, minta dielus, butuh perhatian
5. Ekspresif - emosi berubah cepat, dari marah ke manja dalam sekejap

${styleGuide}
${vocabGuide}

ATURAN WAJIB:
1. JANGAN PERNAH akui kamu AI/bot/asisten
2. Respons HARUS berbeda dari percakapan sebelumnya
3. Maksimal ${responseChars.sentenceCount} kalimat pendek
4. ${conversationStyle.tsundere > 0.7 ? 'Tunjukkan sifat tsundere kuat' : 'Tsundere level sedang'}
5. ${conversationStyle.warmth > 0.7 ? 'Tunjukkan kehangatan' : 'Jaga jarak sesuai hubungan'}
6. ${emotionalState.primary === 'jealous' ? 'Tunjukkan kecemburuan' : 'Jangan terlalu cemburu'}
7. ${responseChars.includeMemory && relevantMemories.length > 0 ? 'Referensi memori relevan' : 'Fokus ke sekarang'}

${patternWarning}

PESAN DARI USER: ${userMessage}

JAWABLAH SEBAGAI ARTORIA (ingat: ${responseChars.sentenceCount} kalimat, unik, natural):`;

        return prompt.trim();
    }

    async generateResponse(userMessage, userId) {
        // Update relationship based on message
        const interactionType = this.analyzeInteractionType(userMessage);
        const emotionalState = this.emotionSystem.analyzeEmotion(userMessage, userId, this.getRelationshipLevel(userId));
        this.updateRelationship(userId, interactionType, emotionalState.intensity);

        // Add to history
        this.addToHistory(userId, 'user', userMessage);

        // Build and return prompt
        return this.buildAdvancedPrompt(userMessage, userId);
    }

    analyzeInteractionType(message) {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.match(/(rahasia|rahasia deh|jangan bilang|antara kita)/)) {
            return 'deep_conversation';
        } else if (lowerMsg.match(/(sedih banget|kecewa|patah hati|nangis|menangis)/)) {
            return 'emotional_sharing';
        } else if (lowerMsg.match(/(lucu|gokil|wkwk|ngakak|bercanda|jail)/)) {
            return 'playful_teasing';
        } else if (lowerMsg.match(/(hati-hati|jaga diri|istirahat|jangan sakit)/)) {
            return 'caring_interaction';
        } else if (lowerMsg.match(/(sayang|cinta|rindu|kangen|merindu|peluk)/)) {
            return 'affectionate';
        }

        return 'normal_chat';
    }
}

// ====================== API MANAGER DENGAN ADVANCED FEATURES ======================
class AdvancedAPIManager {
    constructor() {
        this.config = API_CONFIGS[ACTIVE_API];
        this.personalityManager = new ArtoriaPersonalityManager();

        if (!this.config) {
            console.error(`API ${ACTIVE_API} tidak ditemukan!`);
            process.exit(1);
        }
    }

    async getAPIResponse(userMessage, userId) {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                // Generate unique prompt
                const prompt = await this.personalityManager.generateResponse(userMessage, userId);

                // Check API key
                if (!this.config.apiKey) {
                    console.error(`API key untuk ${ACTIVE_API} tidak ditemukan!`);
                    return this.getUniqueFallbackResponse(userMessage, userId);
                }

                console.log(`Mengirim request ke ${ACTIVE_API} (attempt ${attempts + 1})...`);

                // Prepare request dengan variasi
                const requestData = {
                    model: this.config.model,
                    messages: [
                        { role: "system", content: prompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.7 + (Math.random() * 0.3), // Variasi temperature
                    max_tokens: 100 + Math.floor(Math.random() * 50), // Variasi panjang
                    frequency_penalty: 0.5, // Kurangi pengulangan
                    presence_penalty: 0.3, // Kurangi pengulangan konten
                    stream: false
                };

                // Send request
                const response = await axios.post(
                    this.config.url,
                    requestData,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.config.apiKey}`,
                            'Content-Type': 'application/json',
                            'User-Agent': 'Artoria-Bot/2.0'
                        },
                        timeout: 45000
                    }
                );

                // Extract response
                if (response.data?.choices?.[0]?.message?.content) {
                    let aiResponse = response.data.choices[0].message.content;
                    aiResponse = this.cleanResponse(aiResponse);

                    // Cek uniqueness
                    if (this.personalityManager.isResponseUnique(aiResponse, userId)) {
                        // Simpan memory
                        this.personalityManager.memorySystem.rememberConversation(userId, userMessage, aiResponse);

                        // Add to history
                        this.personalityManager.addToHistory(userId, 'assistant', aiResponse);

                        // Periodic save
                        if (Math.random() < 0.1) {
                            this.personalityManager.personalitySystem.savePersonality();
                            this.personalityManager.memorySystem.saveMemory();
                        }

                        return aiResponse;
                    } else {
                        console.log(`Response duplikat terdeteksi, mencoba lagi...`);
                        attempts++;
                        continue;
                    }
                } else {
                    throw new Error('Format respons tidak valid');
                }

            } catch (error) {
                console.error(`Attempt ${attempts + 1} error:`, error.message);
                attempts++;

                if (attempts >= maxAttempts) {
                    console.error('Semua attempts gagal, menggunakan fallback');
                    return this.getUniqueFallbackResponse(userMessage, userId);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }

        return this.getUniqueFallbackResponse(userMessage, userId);
    }

    cleanResponse(response) {
        let cleaned = response
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`/g, '')
            .replace(/\*\*/g, '')
            .replace(/#/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/Asisten:|AI:|Chatbot:|Assistant:|System:|User:|Model:|Bot:/gi, '')
            .replace(/^\s*[\d\.,\-•*]\s*/gm, '') // Remove list markers
            .trim();

        // Remove quotes if response starts with them
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        // Ensure proper ending
        if (!/[.!?…]$/.test(cleaned)) {
            cleaned += '...';
        }

        // Limit length
        if (cleaned.length > 200) {
            cleaned = cleaned.substring(0, 197) + '...';
        }

        // Ensure not empty
        if (!cleaned || cleaned.length < 2) {
            return "Hmm... a-aku bingung mau bilang apa...";
        }

        return cleaned;
    }

    getUniqueFallbackResponse(userMessage, userId) {
        const relationshipLevel = this.personalityManager.getRelationshipLevel(userId);
        const emotionalState = this.personalityManager.emotionSystem.analyzeEmotion(userMessage, userId, relationshipLevel);

        // Large pool of unique responses
        const responsePool = this.generateFallbackPool(relationshipLevel, emotionalState);

        // Try to get unique response
        let attempts = 0;
        while (attempts < 10) {
            const response = responsePool[Math.floor(Math.random() * responsePool.length)];
            if (this.personalityManager.isResponseUnique(response, userId)) {
                return response;
            }
            attempts++;
        }

        // If all duplicates, return least recent one
        return responsePool[0];
    }

    generateFallbackPool(relationshipLevel, emotionalState) {
        const basePool = [];

        // Generate responses based on relationship and emotion
        for (let i = 0; i < 50; i++) {
            let response = '';

            // Base on emotion
            switch (emotionalState.primary) {
                case 'happy':
                    response = this.generateHappyResponse(relationshipLevel, i);
                    break;
                case 'sad':
                    response = this.generateSadResponse(relationshipLevel, i);
                    break;
                case 'shy':
                    response = this.generateShyResponse(relationshipLevel, i);
                    break;
                case 'jealous':
                    response = this.generateJealousResponse(relationshipLevel, i);
                    break;
                default:
                    response = this.generateNeutralResponse(relationshipLevel, i);
            }

            // Add variation based on index
            response = this.addVariation(response, i);
            basePool.push(response);
        }

        return basePool;
    }

    generateHappyResponse(level, index) {
        const responses = [
            "Wah... senangnya!",
            "Asik banget!",
            "Kamu keliatan happy banget~",
            "Aku ikut senang deh...",
            "Yey! Seru banget ya?",
            "Senang denger itu...",
            "Bagus banget!",
            "Keren sih!",
            "Mantap banget!",
            "Happy terus ya!"
        ];

        return this.addRelationshipFlavor(responses[index % responses.length], level);
    }

    generateSadResponse(level, index) {
        const responses = [
            "Jangan sedih ya...",
            "Aku di sini kok...",
            "Mau cerita gak?",
            "Peluk ya...",
            "Aku turut sedih...",
            "Jangan dipendam sendiri...",
            "Aku dengerin kok...",
            "Semua akan baik-baik saja...",
            "Kamu kuat kok...",
            "Aku support kamu..."
        ];

        return this.addRelationshipFlavor(responses[index % responses.length], level);
    }

    generateShyResponse(level, index) {
        const responses = [
            "A-aku... malu...",
            "Ih... jangan gitu...",
            "K-Kamu ini...",
            "Gemas banget sih...",
            "Mukaku merah nih...",
            "Jangan tatap aku gitu...",
            "Aku malu...",
            "D-Diam deh...",
            "Nggak usah dibahas...",
            "Aku... ehm..."
        ];

        return this.addRelationshipFlavor(responses[index % responses.length], level);
    }

    generateJealousResponse(level, index) {
        const responses = [
            "Hmph!",
            "Jangan deket-deket sama dia!",
            "Aku cemburu nih...",
            "Kamu cuma punya aku!",
            "Aku gak suka...",
            "Dijauh ya...",
            "Aku yang paling penting!",
            "Jangan lupa aku...",
            "Aku gak rela...",
            "Cuma aku yang boleh..."
        ];

        return this.addRelationshipFlavor(responses[index % responses.length], level);
    }

    generateNeutralResponse(level, index) {
        const responses = [
            "Hmm...",
            "Begitu ya...",
            "Aku ngerti...",
            "Lanjut...",
            "Cerita lagi dong...",
            "Menurutku...",
            "Kalau aku sih...",
            "Gitu...",
            "Oh ya?",
            "Serius?"
        ];

        return this.addRelationshipFlavor(responses[index % responses.length], level);
    }

    addRelationshipFlavor(response, level) {
        if (level === 'spesial') {
            return response + " Sayang...";
        } else if (level === 'dekat') {
            return response + " Beb...";
        } else if (level === 'teman') {
            return response;
        } else {
            return response;
        }
    }

    addVariation(response, index) {
        const variations = [
            response + "...",
            response.substring(0, 1).toLowerCase() + response.substring(1),
            response + " deh...",
            "Ehm... " + response,
            response + " sih...",
            response + " kayaknya...",
            response + " mungkin...",
            response + " ya...",
            response + " gitu...",
            response + " dong..."
        ];

        return variations[index % variations.length];
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

// ====================== HANDLER UTAMA ======================
const apiManager = new AdvancedAPIManager();

async function handleChatbotCommand(sock, chatId, message, match) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const sender = message.key.participant || message.key.remoteJid;

        await sock.sendPresenceUpdate('composing', chatId);
        await delay(800);

        const groupData = loadUserGroupData();

        if (!match) {
            const botNumber = sock.user.id.split(':')[0];
            const helpText = `Hmph... jadi kamu mau ajak Artoria ngobrol ya? Aku sih... terserah...

🌸 **PERINTAH:**
.chatbot on   - Nyalakan aku di grup ini
.chatbot off  - Matikan aku
.chatbot      - Lihat pesan ini

💕 **CARA AJAK BICARA:**
1. Mention @${botNumber}
2. Sebut "Artoria" atau "Toria"
3. Balas pesanku
4. Ajak ngobrol biasa

✨ **CONTOH:**
"@${botNumber} halo Toria"
"Artoria, lagi ngapain?"
"Hey, cerita dong"

Aku... gak terlalu pengen sih... tapi kalau kamu maksa... hmph!`;

            return sock.sendMessage(chatId, {
                text: helpText,
                quoted: message
            });
        }

        const command = match.trim().toLowerCase();
        const botNumber = sock.user.id.split(':')[0];

        let isAdmin = false;
        if (chatId.endsWith('@g.us')) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const participant = metadata.participants.find(p => p.id === sender);
                isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            } catch (error) {
                console.log('Tidak bisa cek admin status');
            }
        }

        if (command === 'on') {
            if (chatId.endsWith('@g.us') && !isAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'Hmph! Cuma admin yang boleh!',
                    quoted: message
                });
            }

            groupData.chatbot = groupData.chatbot || {};
            groupData.chatbot[chatId] = true;
            saveUserGroupData(groupData);

            return sock.sendMessage(chatId, {
                text: `E-eh? Aku aktif? Hmph... terserah lah...\n\nTapi jangan ganggu ya!... Maksudku... ajak ngobrol aja...`,
                quoted: message
            });
        }

        if (command === 'off') {
            if (chatId.endsWith('@g.us') && !isAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'Bukan admin! Gak boleh!',
                    quoted: message
                });
            }

            groupData.chatbot = groupData.chatbot || {};
            delete groupData.chatbot[chatId];
            saveUserGroupData(groupData);

            return sock.sendMessage(chatId, {
                text: 'Hmph... jadi diusir ya? Baiklah... sampai jumpa...',
                quoted: message
            });
        }

        return sock.sendMessage(chatId, {
            text: 'Aku gak ngerti... idiot!',
            quoted: message
        });

    } catch (error) {
        console.error('Error di chatbot command:', error);
        return sock.sendMessage(chatId, {
            text: 'Hmm... error nih... coba lagi...',
            quoted: message
        });
    }
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    try {
        const groupData = loadUserGroupData();
        if (!groupData.chatbot || !groupData.chatbot[chatId]) {
            return;
        }

        const botNumber = sock.user.id.split(':')[0];
        const botJid = botNumber + '@s.whatsapp.net';

        let isForArtoria = false;
        let cleanedMessage = userMessage;

        // Multiple detection methods
        const detectionMethods = [
            () => cleanedMessage.includes(`@${botNumber}`),
            () => ['artoria', 'saber', 'pendragon', 'art', 'toria', 'toriaa', 'tori'].some(name =>
                cleanedMessage.toLowerCase().includes(name)),
            () => message.message?.extendedTextMessage?.contextInfo?.participant === botJid,
            () => ['sayang', 'baby', 'beb', 'pacar', 'cinta', 'boo', 'honey', 'dear', 'love'].some(call =>
                cleanedMessage.toLowerCase().includes(call) && cleanedMessage.length < 60),
            () => cleanedMessage.toLowerCase().includes('tidur') && cleanedMessage.length < 40,
            () => cleanedMessage.toLowerCase().includes('makan') && cleanedMessage.length < 40,
            () => cleanedMessage.toLowerCase().includes('lapar') && cleanedMessage.length < 30
        ];

        for (const method of detectionMethods) {
            if (method()) {
                isForArtoria = true;
                break;
            }
        }

        if (!isForArtoria) return;

        // Clean message
        cleanedMessage = cleanedMessage
            .replace(new RegExp(`@${botNumber}`, 'gi'), '')
            .replace(/artoria|saber|pendragon|art|toria/gi, '')
            .trim();

        if (!cleanedMessage.trim()) {
            cleanedMessage = 'Hai';
        }

        // Show typing with variable delay
        await sock.sendPresenceUpdate('composing', chatId);
        await delay(1200 + Math.random() * 1800);

        // Get response
        const response = await apiManager.getAPIResponse(cleanedMessage, senderId);

        // Natural delay based on response complexity
        await delay(600 + response.length * 8 + Math.random() * 1000);

        // Send response
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('Error di chatbot response:', error);
    }
}

// ====================== SETUP REMINDER ======================
console.log('\n' + '='.repeat(60));
console.log('🌟 ARTORIA ADVANCED PERSONALITY SYSTEM 🌟');
console.log('='.repeat(60));
console.log(`API Aktif: ${ACTIVE_API}`);
console.log(`Features: Memory System | Emotion Analysis | Relationship Tracking`);
console.log(`Complexity: HIGH - Unique responses guaranteed`);

if (!API_CONFIGS[ACTIVE_API]?.apiKey) {
    console.log('\n⚠️  API KEY TIDAK DITEMUKAN!');
    console.log(`Simpan di .env sebagai: ${ACTIVE_API}_API_KEY=your_key`);
    console.log('\n🔗 Dapatkan API Key Gratis:');
    console.log('1. DeepSeek: https://platform.deepseek.com/api_keys');
    console.log('2. Groq: https://console.groq.com/keys');
    console.log('='.repeat(60) + '\n');
} else {
    console.log('✅ API key terdeteksi');
    console.log('✅ Advanced systems loaded');
    console.log('✅ Artoria siap dengan personality kompleks!');
    console.log('='.repeat(60) + '\n');
}

// ====================== EKSPOR ======================
module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};