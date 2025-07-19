const fs = require("fs");

async function commands(sock, msg, config) {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    const isGroup = jid.endsWith("@g.us");
    const groupMetadata = isGroup ? await sock.groupMetadata(jid) : {};
    const isAdmin = isGroup ? groupMetadata.participants.find(p => p.id === sender && p.admin !== null) : false;
    const isOwner = isGroup && sender.includes(config.owner);

    // 1. command biasa
    if (text === ".h") {
        await sock.sendMessage(jid, { text: "on bos", quoted: msg });
    }

    if (text === ".owner") {
        await sock.sendMessage(jid, { text: `👑 Owner: wa.me/${config.owner}`, quoted: msg });
    }

    // 2. .menu fitur
    if (text === ".menu") {
        const fiturList = Object.entries(config)
            .filter(([k, v]) => typeof v === "boolean")
            .map(([k, v]) => `[${v ? "🔴" : "⚪️"}] ${k.toUpperCase()}`)
            .join("\n");

        const menu = `🛡️ *Menu Fitur*\n\n${fiturList}\n\n🔴 = Aktif\n⚪️ = Tidak Aktif`;
        await sock.sendMessage(jid, { text: menu, quoted: msg });
    }

    // 3. .on/.off
    if (text.startsWith(".on") || text.startsWith(".off")) {
        if (!isOwner && !isAdmin) return;
        const fitur = text.split(" ")[1]?.toUpperCase();
        if (!fitur || !config.hasOwnProperty(fitur)) {
            return await sock.sendMessage(jid, { text: `⚠️ *Fitur tidak ditemukan*`, quoted: msg });
        }

        config[fitur] = text.startsWith(".on");
        fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
        await sock.sendMessage(jid, { text: `✅ *${fitur}* di${text.startsWith(".on") ? "aktifkan" : "matikan"}`, quoted: msg });
    }

    // 4. .kick
    if (text.startsWith(".kick") && isGroup && (isAdmin || isOwner)) {
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return await sock.sendMessage(jid, { text: "❌ Tag atau reply orang yang mau di-kick", quoted: msg });
        await sock.groupParticipantsUpdate(jid, [target], "remove");
    }

    // 5. .promote
    if (text.startsWith(".promote") && isGroup && (isAdmin || isOwner)) {
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return await sock.sendMessage(jid, { text: "❌ Tag atau reply orang yang mau di-promote", quoted: msg });
        await sock.groupParticipantsUpdate(jid, [target], "promote");
    }

    // 6. .demote
    if (text.startsWith(".demote") && isGroup && (isAdmin || isOwner)) {
        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return await sock.sendMessage(jid, { text: "❌ Tag atau reply orang yang mau di-demote", quoted: msg });
        await sock.groupParticipantsUpdate(jid, [target], "demote");
    }

    // 7. .delete (hapus pesan reply)
    if (text === ".delete" && isAdmin && isGroup) {
        const targetMsg = msg.message?.extendedTextMessage?.contextInfo;
        if (targetMsg?.stanzaId && targetMsg?.participant) {
            await sock.sendMessage(jid, {
                delete: {
                    remoteJid: jid,
                    fromMe: false,
                    id: targetMsg.stanzaId,
                    participant: targetMsg.participant
                }
            });
        }
    }

    // 8. .add
    if (text.startsWith(".add") && isGroup && isOwner) {
        const nomor = text.split(" ")[1];
        if (!nomor || nomor.length < 5) return;
        const userJid = nomor.replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.groupParticipantsUpdate(jid, [userJid], "add");
    }
}

module.exports = { commands };
