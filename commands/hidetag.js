const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

async function hidetagCommand(sock, m, prefix) {
    try {
        console.log("HIDETAG FITURE");

        // Cek grup
        if (!m.key.remoteJid.endsWith("@g.us")) {
            await sock.sendMessage(m.key.remoteJid, { text: "Hanya untuk grup!" });
            return;
        }

        // Ambil metadata grup dan daftar participants
        const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
        const participants = groupMetadata.participants.map(p => p.id);

        console.log("Participants:", participants.length);

        // Ambil teks setelah command
        let body = "";
        let textAfterCommand = "";

        if (m.message?.conversation) {
            body = m.message.conversation;
        } else if (m.message?.extendedTextMessage?.text) {
            body = m.message.extendedTextMessage.text;
        }

        // Ekstrak teks setelah command
        if (body.startsWith(prefix + "hidetag")) {
            textAfterCommand = body.replace(prefix + "hidetag", "").trim();
        }

        console.log("Text after command:", `"${textAfterCommand}"`);

        // Cek apakah ini reply
        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedMessage = contextInfo?.quotedMessage;
        const isReply = contextInfo && quotedMessage;

        console.log("Is reply:", isReply);

        if (isReply) {
            console.log("Processing REPLY message");
            // Handle pesan yang di-reply
            await handleQuotedMessage(sock, m.key.remoteJid, quotedMessage, textAfterCommand, participants);
        } else {
            console.log("Processing DIRECT message");
            // Jika tidak reply, gunakan teks setelah command atau default
            const finalText = textAfterCommand || "Haiiii izin tag semua member yaaa!";

            await sock.sendMessage(m.key.remoteJid, {
                text: finalText,
                mentions: participants
            });
        }

    } catch (error) {
        console.error("Error in hidetag:", error);
        try {
            const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
            const participants = groupMetadata.participants.map(p => p.id);

            await sock.sendMessage(m.key.remoteJid, {
                text: "Error: " + error.message,
                mentions: participants
            });
        } catch (e) {
            console.error("Gagal kirim error message:", e);
        }
    }
}

/**
 * Handle berbagai jenis pesan yang di-reply
 */
async function handleQuotedMessage(sock, remoteJid, quotedMessage, textAfterCommand, participants) {
    const messageType = Object.keys(quotedMessage)[0];

    console.log("Quoted message type:", messageType);
    console.log("Text after command:", `"${textAfterCommand}"`);

    try {
        switch (messageType) {
            case "conversation":
                // Handle pesan teks biasa
                const quotedText = quotedMessage.conversation;
                const messageText = textAfterCommand || quotedText || "Hidetag semua member!";
                await sock.sendMessage(remoteJid, {
                    text: messageText,
                    mentions: participants
                });
                break;

            case "extendedTextMessage":
                // Handle pesan teks extended
                const extendedText = quotedMessage.extendedTextMessage.text;
                const extendedMessageText = textAfterCommand || extendedText || "Hidetag semua member!";
                await sock.sendMessage(remoteJid, {
                    text: extendedMessageText,
                    mentions: participants
                });
                break;

            case "imageMessage":
                // Handle gambar
                console.log("Processing image message");
                const imageStream = await downloadContentFromMessage(quotedMessage.imageMessage, "image");
                let imageBuffer = Buffer.from([]);
                for await (const chunk of imageStream) {
                    imageBuffer = Buffer.concat([imageBuffer, chunk]);
                }
                const imageCaption = textAfterCommand || quotedMessage.imageMessage.caption || "";

                await sock.sendMessage(remoteJid, {
                    image: imageBuffer,
                    caption: imageCaption,
                    mentions: participants
                });
                break;

            case "videoMessage":
                // Handle video
                console.log("Processing video message");
                const videoStream = await downloadContentFromMessage(quotedMessage.videoMessage, "video");
                let videoBuffer = Buffer.from([]);
                for await (const chunk of videoStream) {
                    videoBuffer = Buffer.concat([videoBuffer, chunk]);
                }
                const videoCaption = textAfterCommand || quotedMessage.videoMessage.caption || "";

                await sock.sendMessage(remoteJid, {
                    video: videoBuffer,
                    caption: videoCaption,
                    mentions: participants
                });
                break;

            case "audioMessage":
                // Handle audio/lagu
                console.log("Processing audio message");
                const audioStream = await downloadContentFromMessage(quotedMessage.audioMessage, "audio");
                let audioBuffer = Buffer.from([]);
                for await (const chunk of audioStream) {
                    audioBuffer = Buffer.concat([audioBuffer, chunk]);
                }

                await sock.sendMessage(remoteJid, {
                    audio: audioBuffer,
                    mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
                    mentions: participants
                });
                break;

            case "documentMessage":
                // Handle document/file
                console.log("Processing document message");
                const documentStream = await downloadContentFromMessage(quotedMessage.documentMessage, "document");
                let documentBuffer = Buffer.from([]);
                for await (const chunk of documentStream) {
                    documentBuffer = Buffer.concat([documentBuffer, chunk]);
                }
                const documentFileName = quotedMessage.documentMessage.fileName || "document";

                await sock.sendMessage(remoteJid, {
                    document: documentBuffer,
                    fileName: documentFileName,
                    mimetype: quotedMessage.documentMessage.mimetype,
                    mentions: participants
                });
                break;

            case "stickerMessage":
                // Handle sticker
                console.log("Processing sticker message");
                const stickerStream = await downloadContentFromMessage(quotedMessage.stickerMessage, "sticker");
                let stickerBuffer = Buffer.from([]);
                for await (const chunk of stickerStream) {
                    stickerBuffer = Buffer.concat([stickerBuffer, chunk]);
                }

                await sock.sendMessage(remoteJid, {
                    sticker: stickerBuffer,
                    mentions: participants
                });
                break;

            case "contactMessage":
                // Handle contact
                console.log("Processing contact message");
                const contact = quotedMessage.contactMessage;
                await sock.sendMessage(remoteJid, {
                    contacts: {
                        displayName: contact.displayName || "Kontak",
                        contacts: [contact]
                    },
                    mentions: participants
                });
                break;

            case "locationMessage":
                // Handle location
                console.log("Processing location message");
                const location = quotedMessage.locationMessage;
                await sock.sendMessage(remoteJid, {
                    location: {
                        degreesLatitude: location.degreesLatitude,
                        degreesLongitude: location.degreesLongitude
                    },
                    mentions: participants
                });
                break;

            case "pollCreationMessage":
                // Handle poll/vote
                console.log("Processing poll message");
                const poll = quotedMessage.pollCreationMessage;
                await sock.sendMessage(remoteJid, {
                    text: `Poll: ${poll.name}\n\nPilihan:\n${poll.options.map((opt, idx) => `${idx + 1}. ${opt.optionName}`).join('\n')}`,
                    mentions: participants
                });
                break;

            case "ephemeralMessage":
                // Handle ephemeral message (pesan sementara)
                console.log("Processing ephemeral message");
                const ephemeralContent = quotedMessage.ephemeralMessage.message;
                await handleQuotedMessage(sock, remoteJid, ephemeralContent, textAfterCommand, participants);
                break;

            case "viewOnceMessage":
                // Handle view once message
                console.log("Processing view once message");
                const viewOnceContent = quotedMessage.viewOnceMessage.message;
                await handleQuotedMessage(sock, remoteJid, viewOnceContent, textAfterCommand, participants);
                break;

            case "buttonsMessage":
                // Handle buttons message
                console.log("Processing buttons message");
                const buttonsText = quotedMessage.buttonsMessage.text || quotedMessage.buttonsMessage.contentText || "";
                const finalText = textAfterCommand || buttonsText || "Hidetag semua member!";
                await sock.sendMessage(remoteJid, {
                    text: finalText,
                    mentions: participants
                });
                break;

            case "templateMessage":
                // Handle template message
                console.log("Processing template message");
                const templateContent = quotedMessage.templateMessage?.hydratedTemplate?.hydratedContentText ||
                    quotedMessage.templateMessage?.hydratedTemplate?.hydratedTitle ||
                    "Pesan template";
                const templateFinalText = textAfterCommand || templateContent || "Hidetag semua member!";
                await sock.sendMessage(remoteJid, {
                    text: templateFinalText,
                    mentions: participants
                });
                break;

            default:
                // Untuk jenis pesan yang belum didukung
                console.log("Unsupported message type:", messageType);
                const fallbackText = textAfterCommand || "Hidetag semua member!";
                await sock.sendMessage(remoteJid, {
                    text: fallbackText,
                    mentions: participants
                });
                break;
        }
    } catch (error) {
        console.error("Error processing quoted message:", error);
        // Fallback: kirim teks saja
        const fallbackText = textAfterCommand || "Hidetag semua member!";
        await sock.sendMessage(remoteJid, {
            text: fallbackText,
            mentions: participants
        });
    }
}

module.exports = { hidetagCommand };