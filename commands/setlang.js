/**
 * .setlang command
 * Usage:
 *   .setlang en - Set language to English
 *   .setlang id - Set language to Indonesian
 */

const langHelper = require('../lib/lang');

async function setLangCommand(sock, chatId, message, args) {
    try {
        const lang = langHelper.getLang(chatId);

        if (!args || args.length === 0) {
            await sock.sendMessage(chatId, {
                text: lang.setlang_usage
            }, { quoted: message });
            return;
        }

        const selectedLang = args[0].toLowerCase();
        const availableLangs = langHelper.getAvailableLangs();

        if (!availableLangs.includes(selectedLang)) {
            await sock.sendMessage(chatId, {
                text: lang.invalid_lang.replace('{langs}', availableLangs.join(', '))
            }, { quoted: message });
            return;
        }

        const success = langHelper.setLang(chatId, selectedLang);
        if (!success) {
            await sock.sendMessage(chatId, {
                text: lang.error_setting_lang
            }, { quoted: message });
            return;
        }

        // Get the new language messages after setting
        const newLang = langHelper.getLang(chatId);
        await sock.sendMessage(chatId, {
            text: newLang.lang_set_success
        }, { quoted: message });

    } catch (error) {
        console.error('Error di setlang command:', error);
        const lang = langHelper.getLang(chatId);
        await sock.sendMessage(chatId, {
            text: lang.error_setting_lang
        }, { quoted: message });
    }
}

module.exports = setLangCommand;