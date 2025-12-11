require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')

// === FIXED FFMPEG CONFIGURATION ===
console.log('Starting Artoria Bot V1...')

// Gunakan FFmpeg dari sistem Ubuntu
process.env.FFMPEG_PATH = 'ffmpeg'
process.env.FFPROBE_PATH = 'ffprobe'

// Hapus folder ffmpeg Windows jika ada
try {
    if (fs.existsSync('./ffmpeg')) {
        console.log('🗑️  Removing Windows FFmpeg folder...')
        fs.rmSync('./ffmpeg', { recursive: true, force: true })
    }
} catch (err) {
    console.log('Note: Could not remove ffmpeg folder:', err.message)
}

console.log('✅ Using system FFmpeg')
// === END FFMPEG CONFIG ===

const FileType = require('file-type')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60000)

// Memory monitoring
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️  RAM too high (>400MB), restarting...')
        process.exit(1)
    }
}, 30000)

let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "Artoria Bot V1"
global.themeemoji = "•"

// Clear old session data
function clearOldSessionData() {
    try {
        const sessionDir = './session'
        if (fs.existsSync(sessionDir)) {
            const stats = fs.statSync(sessionDir)
            const now = new Date()
            const sessionAge = now - stats.mtime
            const oneDay = 24 * 60 * 60 * 1000

            if (sessionAge > oneDay) {
                console.log('🧹 Clearing old session data...')
                fs.rmSync(sessionDir, { recursive: true, force: true })
                console.log('✅ Old session cleared')
            }
        }
    } catch (error) {
        console.log('ℹ️  No session to clear:', error.message)
    }
}

async function startXeonBotInc() {
    clearOldSessionData()

    let { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState('./session')
    const msgRetryCounterCache = new NodeCache()

    const logger = pino({
        level: 'error',
        timestamp: () => `,"time":"${new Date().toLocaleTimeString()}"`
    })

    const XeonBotInc = makeWASocket({
        version,
        logger: logger,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "error" })),
        },
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        getMessage: async (key) => {
            try {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            } catch (error) {
                console.log('Error loading message:', error.message)
                return ""
            }
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: 30000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 250,
        fireInitQueries: true,
        emitOwnEvents: true,
        defaultCacheSize: 100
    })

    store.bind(XeonBotInc.ev)

    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            if (!chatUpdate.messages || chatUpdate.messages.length === 0) return

            const mek = chatUpdate.messages[0]
            if (!mek.message) return

            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
                ? mek.message.ephemeralMessage.message
                : mek.message

            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate)
                return
            }

            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') return

            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            if (XeonBotInc?.msgRetryCounterCache && Math.random() < 0.01) {
                XeonBotInc.msgRetryCounterCache.clear()
            }

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err.message)
                if (mek.key && mek.key.remoteJid && !err.message.includes('Bad MAC') && !err.message.includes('decrypt')) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: 'An error occurred while processing your message.'
                    }).catch(console.error)
                }
            }
        } catch (err) {
            if (!err.message.includes('Bad MAC') && !err.message.includes('decrypt')) {
                console.error("Error in messages.upsert:", err.message)
            }
        }
    })

    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    const qrcode = require('qrcode-terminal')
    let connectionAttempts = 0
    const maxConnectionAttempts = 5

    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s

        if (qr) {
            console.log('\n' + '═'.repeat(40))
            console.log('📱 SCAN QR CODE INI')
            console.log('═'.repeat(40))
            qrcode.generate(qr, { small: true })
            console.log('═'.repeat(40))
            console.log('Scan dengan WhatsApp > Link Device\n')
            connectionAttempts = 0
        }

        if (connection === 'open') {
            console.log('✅ Bot connected successfully!')
            connectionAttempts = 0
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const errorMessage = lastDisconnect?.error?.message || ''

            console.log(`🔌 Connection closed. Attempt: ${connectionAttempts + 1}/${maxConnectionAttempts}`)

            if (!errorMessage.includes('Bad MAC') && !errorMessage.includes('decrypt')) {
                console.log('Reason:', errorMessage)
            }

            connectionAttempts++

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log('🔑 Session logged out. Clearing session...')
                try {
                    fs.rmSync('./session', { recursive: true, force: true })
                } catch (error) {
                    console.log('Error clearing session:', error.message)
                }
                await delay(3000)
                startXeonBotInc()
            } else if (connectionAttempts <= maxConnectionAttempts) {
                console.log(`🔄 Reconnecting... (${connectionAttempts}/${maxConnectionAttempts})`)
                await delay(5000)
                startXeonBotInc()
            } else {
                console.log('❌ Max connection attempts reached. Restart manually.')
            }
        }
    })

    XeonBotInc.ev.on('creds.update', saveCreds)

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupParticipantUpdate(XeonBotInc, update)
        } catch (error) {
            console.error('Error in group update:', error.message)
        }
    })

    XeonBotInc.ev.on('status.update', async (status) => {
        try {
            await handleStatus(XeonBotInc, status)
        } catch (error) {
            console.error('Error handling status:', error.message)
        }
    })

    return XeonBotInc
}

// Start bot
startXeonBotInc().catch(error => {
    console.error('💥 Fatal error:', error)
    setTimeout(() => {
        console.log('🔄 Restarting in 10 seconds...')
        startXeonBotInc()
    }, 10000)
})

process.on('uncaughtException', (err) => {
    if (!err.message.includes('Bad MAC') && !err.message.includes('decrypt')) {
        console.error('⚠️  Uncaught Exception:', err.message)
    }
})

process.on('unhandledRejection', (err) => {
    if (!err.message?.includes('Bad MAC') && !err.message?.includes('decrypt')) {
        console.error('⚠️  Unhandled Rejection:', err.message)
    }
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`🔄 File ${__filename} updated`))
    delete require.cache[file]
    require(file)
})
