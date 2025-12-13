// In-memory storage for chat language preferences
const chatLanguages = new Map();

// Default language
const DEFAULT_LANG = 'id';

// Available languages
const AVAILABLE_LANGS = ['en', 'id'];

// Basic language messages (hardcoded since lang files are removed)
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
 * Get the language messages for a specific chat
 * @param {string} chatId - The chat ID
 * @returns {object} Language messages object
 */
function getLang(chatId) {
    const langCode = chatLanguages.get(chatId) || DEFAULT_LANG;
    return messages[langCode] || messages[DEFAULT_LANG];
}

/**
 * Set the language for a specific chat
 * @param {string} chatId - The chat ID
 * @param {string} langCode - The language code ('en' or 'id')
 * @returns {boolean} True if language was set successfully, false otherwise
 */
function setLang(chatId, langCode) {
    if (!AVAILABLE_LANGS.includes(langCode)) {
        return false;
    }
    chatLanguages.set(chatId, langCode);
    return true;
}

/**
 * Get the current language code for a chat
 * @param {string} chatId - The chat ID
 * @returns {string} Language code
 */
function getCurrentLang(chatId) {
    return chatLanguages.get(chatId) || DEFAULT_LANG;
}

/**
 * Get available languages
 * @returns {array} Array of available language codes
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
