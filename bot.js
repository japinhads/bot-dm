require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('./src/database');

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot Online!');
});


const states = {};

client.on('message', async message => {
    const { body, from } = message;
    const args = body.split(' ');
    const command = args.shift().toLowerCase();

    if (from === process.env.ADMIN_ID) {
        if (command === '!textoentrada') {
            const texto = args.join(' ');
            db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['textoEntrada', texto], function(err) {
                if (err) return console.log(err.message);
                message.reply(`Texto de entrada salvo: ${texto}`);
            });
        } else if (command === '!textosaida') {
            const texto = args.join(' ');
            db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['textoSaida', texto], function(err) {
                if (err) return console.log(err.message);
                message.reply(`Texto de saída salvo: ${texto}`);
            });
        } else if (command === '!ativar') {
            db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['ativado', 'true'], function(err) {
                if (err) return console.log(err.message);
                message.reply('Função ativada.');
            });
        } else if (command === '!desativar') {
            db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['ativado', 'false'], function(err) {
                if (err) return console.log(err.message);
                message.reply('Função desativada.');
            });
        }
        if (command === '!listartextos') {
            db.all('SELECT * FROM settings', [], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    message.reply('Ocorreu um erro ao listar os textos.');
                    return;
                }

                let response = 'Textos salvos:\n\n';
                rows.forEach(row => {
                    
                    response += `*${row.key}*: ${row.value}\n\n`;
                });

                message.reply(response);
            });
        }
        if (command === '!listargrupos') {
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            let response = 'Grupos disponíveis:\n\n';
            groups.forEach((group, index) => {
                response += `*${index + 1}*: ${group.name}\n\n`;
            });
            message.reply(response);
        }
        if (command === '!selecionargrupos') {
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);

            if (groups.length > 0) {
                let responseText = '*Escolha um ou mais grupos para o bot escutar (Ex: 1,3,4):*\n';
                groups.forEach((group, index) => {
                    responseText += `*${index + 1}.* _${group.name}_\n`;
                });
                states[from] = {
                    step: 'CHOOSE_GROUP',
                    groups
                };
                await client.sendMessage(from, responseText);
            } else {
                await client.sendMessage(from, '*O Bot Não é Administrador Em Nenhum Grupo.*');
            }
            return;
        }
    }

    
    if (states[from] && states[from].step === 'CHOOSE_GROUP') {
        const selectedIndexes = body.split(',').map(num => parseInt(num.trim()) - 1);
        const selectedGroups = selectedIndexes
            .filter(index => !isNaN(index) && index >= 0 && index < states[from].groups.length)
            .map(index => states[from].groups[index]);

        if (selectedGroups.length > 0) {
            
            selectedGroups.forEach(async (group, index) => {
                await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`grupo${index + 1}`, group.id._serialized]);
            });
            await client.sendMessage(from, '*Grupos selecionados com sucesso!*');
            delete states[from];
        } else {
            await client.sendMessage(from, '*Seleção inválida. Por favor, selecione um ou mais grupos válidos:*');
        }
        return;
    }
});

client.on('group_join', async (notification) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['ativado'], async (err, row) => {
        if (err) return console.error(err.message);
        if (row && row.value === 'true') {
            const groupId = notification.id.remote;
            db.get('SELECT value FROM settings WHERE key = ?', [`grupo${groupId}`], async (err, row) => {
                if (err) return console.error(err.message);
                if (row && row.value === groupId) {
                    db.get('SELECT value FROM settings WHERE key = ?', ['textoEntrada'], async (err, row) => {
                        if (err) return console.error(err.message);
                        if (row && row.value) {
                            const contact = await client.getContactById(notification.id.participant);
                            await client.sendMessage(contact.id._serialized, row.value);
                        } else {
                            console.log('Nenhum texto de entrada configurado.');
                        }
                    });
                }
            });
        }
    });
});

client.on('group_leave', async (notification) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['ativado'], async (err, row) => {
        if (err) return console.error(err.message);
        if (row && row.value === 'true') {
            const groupId = notification.id.remote;
            db.get('SELECT value FROM settings WHERE key = ?', [`grupo${groupId}`], async (err, row) => {
                if (err) return console.error(err.message);
                if (row && row.value === groupId) {
                    db.get('SELECT value FROM settings WHERE key = ?', ['textoSaida'], async (err, row) => {
                        if (err) return console.error(err.message);
                        if (row && row.value) {
                            const contact = await client.getContactById(notification.id.participant);
                            await client.sendMessage(contact.id._serialized, row.value);
                        } else {
                            console.log('Nenhum texto de saída configurado.');
                        }
                    });
                }
            });
        }
    });
});

client.initialize();
