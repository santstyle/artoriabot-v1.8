const fs = require('fs');
const path = require('path');

// Load language files
const langDir = path.join(__dirname, '..', 'lang');
const enLang = JSON.parse(fs.readFileSync(path.join(langDir, 'en.json'), 'utf8'));
const idLang = JSON.parse(fs.readFileSync(path.join(langDir, 'id.json'), 'utf8'));

// In-memory storage for chat language preferences
const chatLanguages = new Map();

// Default language
const DEFAULT_LANG = 'id';

// Available languages
const AVAILABLE_LANGS = ['en', 'id'];

/**
 * Get the language messages for a specific chat
 * @param {string} chatId - The chat ID
 * @returns {object} Language messages object
 */
function getLang(chatId) {
    const langCode = chatLanguages.get(chatId) || DEFAULT_LANG;
    return langCode === 'en' ? enLang : idLang;
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
