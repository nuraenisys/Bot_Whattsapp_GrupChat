const { commands } = require('./commands');
const { moderasi } = require('./moderasi');

function handler(sock, config) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === "status@broadcast") return;

        try {
            await moderasi(sock, msg, config);
        } catch (e) {
            console.log("Error di moderasi:", e);
        }

        try {
            await commands(sock, msg, config);
        } catch (e) {
            console.log("Error di commands:", e);
        }
    });
}

module.exports = { handler };
