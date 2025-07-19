
/*
  WhatsApp Bot - Final Version
  ✅ Ambil config dari Vercel panel
  ✅ Perintah .menu, .on, .off, .owner, dll
  ✅ Akses dibatasi: Owner, Admin, Member
  ✅ Moderasi: antivirtex (kick), badword (hapus), antilink (hapus), antispam (peringatan + kick)
*/

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const pino = require('pino');
const axios = require('axios');

const qrcode = require('qrcode-terminal');
const prefix = '.';
const ownerNumber = "6283130936696@s.whatsapp.net";
let config = {};
let spamCounter = {};

async function loadConfig() {
  try {
    const res = await axios.get('https://panel-inst-store-icep.vercel.app/api/updateConfig');
    config = res.data;
    console.log("✅ Konfigurasi berhasil diambil dari panel.");
  } catch (e) {
    console.log("⚠️ Gagal ambil dari API panel. Pakai config lokal.");
    config = JSON.parse(fs.readFileSync('./config.json'));
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const m = msg.message;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const isOwner = sender === ownerNumber;
    const isCmd = m.conversation?.startsWith(prefix) || m.extendedTextMessage?.text?.startsWith(prefix);
    const body = m.conversation || m.extendedTextMessage?.text || '';
    const command = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : '';
    const args = isCmd ? body.trim().split(/ +/).slice(1) : [];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const isAdmin = isOwner || (isGroup && (await sock.groupMetadata(from)).participants.find(p => p.id === sender && p.admin));

    // SPAM DETECTION (light)
    if (!isAdmin && body.startsWith('.') && config.ANTISPAMCHAT) {
      spamCounter[sender] = spamCounter[sender] ? spamCounter[sender] + 1 : 1;
      if (spamCounter[sender] >= 3) {
        await sock.groupParticipantsUpdate(from, [sender], 'remove');
        spamCounter[sender] = 0;
        return;
      } else {
        return; // delete message
      }
    }

    // BADWORD
    if (config.BADWORD && /(BANK|BRI|DANAMON|SLOT)/i.test(body)) {
      await sock.sendMessage(from, { delete: msg.key });
      return;
    }

    // ANTIVIRTEX
    if (config.ANTIVIRTEX && body.length > 500) {
      await sock.groupParticipantsUpdate(from, [sender], 'remove');
      return;
    }

    // ANTILINK
    if (config.ANTILINK && /https?:\/\//i.test(body)) {
      await sock.sendMessage(from, { delete: msg.key });
      return;
    }

    // Perintah Khusus
    if (isCmd) {
      switch (command) {
        case 'owner':
          await sock.sendMessage(from, { text: `Owner: wa.me/6283130936696` }, { quoted: msg });
          break;
        case 'menu':
          if (!isAdmin) return;
          let txt = '*Fitur Moderasi:*
';
          for (let [f, on] of Object.entries(config)) {
            txt += `[${on ? '🔴' : '⚪️'}] ${f}
`;
          }
          txt += '
Keterangan: 🔴 aktif, ⚪️ nonaktif';
          await sock.sendMessage(from, { text: txt }, { quoted: msg });
          break;
        case 'on':
        case 'off':
          if (!isAdmin) return;
          if (!args[0]) return sock.sendMessage(from, { text: 'Contoh: .on antilink' }, { quoted: msg });
          const fitur = args[0].toUpperCase();
          config[fitur] = command === 'on';
          await axios.post('https://panel-inst-store-icep.vercel.app/api/updateConfig', config);
          await sock.sendMessage(from, { text: `Fitur ${fitur} berhasil ${command === 'on' ? 'diaktifkan' : 'dinonaktifkan'}` }, { quoted: msg });
          break;
        case 'reloadconfig':
          if (!isAdmin) return;
          await loadConfig();
          await sock.sendMessage(from, { text: '✅ Config berhasil dimuat ulang dari panel' }, { quoted: msg });
          break;
        case 'kick':
          if (!isAdmin) return;
          let targetKick = quoted || args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
          if (targetKick) await sock.groupParticipantsUpdate(from, [targetKick], 'remove');
          break;
        case 'promote':
          if (!isAdmin) return;
          let promote = quoted || args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
          if (promote) await sock.groupParticipantsUpdate(from, [promote], 'promote');
          break;
        case 'demote':
          if (!isAdmin) return;
          let demote = quoted || args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
          if (demote) await sock.groupParticipantsUpdate(from, [demote], 'demote');
          break;
        case 'add':
          if (!isAdmin) return;
          let nomor = args[0]?.replace(/[^0-9]/g, '');
          if (nomor) await sock.groupParticipantsUpdate(from, [nomor + '@s.whatsapp.net'], 'add');
          break;
        case 'delete':
          if (!isAdmin) return;
          await sock.sendMessage(from, { delete: msg.message?.extendedTextMessage?.contextInfo?.stanzaId });
          break;
      }
    }
  });

  sock.ev.on('connection.update', async ({ connection }) => {
    if (connection === 'open') {
      console.log("✅ Bot Siap!");
    }
  });
}

(async () => {
  await loadConfig();
  startBot();
})();
