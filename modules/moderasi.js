const spamCount = {};
const lastMessageTime = {};

async function moderasi(sock, msg, config) {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    // 1. ANTIVIRTEX
    if (config.ANTIVIRTEX && text.length > 5000) {
        try {
            await sock.groupParticipantsUpdate(jid, [sender], "remove");
        } catch (e) {
            console.log("Gagal kick virtex:", e.message);
        }
    }

    // 2. BADWORD
    if (config.BADWORD && /anjing|babi|danamon/i.test(text)) {
        await sock.sendMessage(jid, { delete: msg.key });
    }

    // 3. ANTISPAMCHAT
    if (config.ANTISPAMCHAT && text.startsWith(".") && jid.endsWith("@g.us")) {
        const metadata = await sock.groupMetadata(jid);
        const admins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
        const isAdmin = admins.includes(sender);
        const isOwner = sender.includes(config.owner);
        if (isAdmin || isOwner) return;

        const now = Date.now();
        const lastTime = lastMessageTime[sender] || 0;

        if (now - lastTime < 10000) {
            spamCount[sender] = (spamCount[sender] || 0) + 1;
        } else {
            spamCount[sender] = 1;
        }

        lastMessageTime[sender] = now;

        if (spamCount[sender] >= 3) {
            try {
                await sock.groupParticipantsUpdate(jid, [sender], "remove");
            } catch (e) {
                console.log("Gagal kick spammer:", e.message);
            }
            spamCount[sender] = 0;
        } else {
            await sock.sendMessage(jid, {
                text: `⚠️ Spam terdeteksi (${spamCount[sender]}/3)`
            });
        }
    }
}

module.exports = { moderasi };
