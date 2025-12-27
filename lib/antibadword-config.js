const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/antibadword-config.json');

// Default configuration
const defaultConfig = {
    enabled: false,
    action: 'delete', // delete, warn, kick, mute
    muteDuration: 5, // in minutes
    maxWarnings: 3,
    badwords: [], // Custom badwords list
    autoDelete: true,
    warningMessages: [
        "Hai {user}, kata-kata kasar tidak diperbolehkan di grup ini!",
        "Kedua kalinya {user}, hati-hati ya dengan kata-katamu!",
        "Terakhir kali peringatan {user}! Masih kasar lagi akan di-kick!"
    ],
    excludedUsers: [],
    excludedRoles: ['admin']
};

// Load config for specific group
function loadGroupConfig(groupId) {
    try {
        if (!fs.existsSync(configPath)) {
            return { ...defaultConfig };
        }
        
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...data[groupId] };
    } catch (error) {
        console.error('Error loading antibadword config:', error);
        return { ...defaultConfig };
    }
}

// Save config for specific group
function saveGroupConfig(groupId, config) {
    try {
        let allData = {};
        
        if (fs.existsSync(configPath)) {
            allData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        allData[groupId] = config;
        fs.writeFileSync(configPath, JSON.stringify(allData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving antibadword config:', error);
        return false;
    }
}

// Update specific field in config
function updateGroupConfig(groupId, updates) {
    const config = loadGroupConfig(groupId);
    const newConfig = { ...config, ...updates };
    return saveGroupConfig(groupId, newConfig);
}

// Add badword to list
function addBadword(groupId, word) {
    const config = loadGroupConfig(groupId);
    if (!config.badwords.includes(word.toLowerCase())) {
        config.badwords.push(word.toLowerCase());
        return saveGroupConfig(groupId, config);
    }
    return false;
}

// Remove badword from list
function removeBadword(groupId, word) {
    const config = loadGroupConfig(groupId);
    const index = config.badwords.indexOf(word.toLowerCase());
    if (index > -1) {
        config.badwords.splice(index, 1);
        return saveGroupConfig(groupId, config);
    }
    return false;
}

// Get all badwords
function getBadwords(groupId) {
    const config = loadGroupConfig(groupId);
    return config.badwords;
}

// Check if word is badword
function isBadword(groupId, word) {
    const config = loadGroupConfig(groupId);
    return config.badwords.includes(word.toLowerCase());
}

// Reset config for group
function resetGroupConfig(groupId) {
    return saveGroupConfig(groupId, { ...defaultConfig });
}

module.exports = {
    loadGroupConfig,
    saveGroupConfig,
    updateGroupConfig,
    addBadword,
    removeBadword,
    getBadwords,
    isBadword,
    resetGroupConfig
};