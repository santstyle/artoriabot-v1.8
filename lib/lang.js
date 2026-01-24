const chatLanguages = new Map();

const DEFAULT_LANG = 'id';

const AVAILABLE_LANGS = ['en', 'id'];

const messages = {
    en: {
        setlang_usage: 'Usage: .setlang <en/id>\nExample: .setlang id\n\nen = English\nid = Indonesia',
        invalid_lang: 'Invalid language code. Available options: {langs}',
        lang_set_success: 'Language set successfully!',
        error_setting_lang: 'Error setting language. Please try again.',
        lang_status: 'Current language: {lang}'
    },
    id: {
        setlang_usage: 'Cara pakai: .setlang <en/id>\nContoh: .setlang id\n\nen = English\nid = Indonesia',
        invalid_lang: 'Kode bahasa tidak valid. Pilihan yang tersedia: {langs}',
        lang_set_success: 'Bahasa berhasil diatur!',
        error_setting_lang: 'Error mengatur bahasa. Silakan coba lagi.',
        lang_status: 'Bahasa saat ini: {lang}'
    }
};

/**
 * @param {string} chatId 
 * @returns {object} 
 */
function getLang(chatId) {
    const langCode = chatLanguages.get(chatId) || DEFAULT_LANG;
    return messages[langCode] || messages[DEFAULT_LANG];
}

/**
 * @param {string} chatId 
 * @param {string} langCode 
 * @returns {boolean} 
 */
function setLang(chatId, langCode) {
    if (!AVAILABLE_LANGS.includes(langCode)) {
        return false;
    }
    chatLanguages.set(chatId, langCode);
    return true;
}

/**
 * @param {string} chatId 
 * @returns {string}
 */
function getCurrentLang(chatId) {
    return chatLanguages.get(chatId) || DEFAULT_LANG;
}

/**
 * @returns {array} 
 */
function getAvailableLangs() {
    return AVAILABLE_LANGS;
}

module.exports = {
    getLang,
    setLang,
    getCurrentLang,
    getAvailableLangs,
    DEFAULT_LANG,
    AVAILABLE_LANGS
};
