// database.js
const sqlite3 = require('sqlite3').verbose();

// Substitua 'myDatabase.db' pelo nome desejado para o seu arquivo de banco de dados
const db = new sqlite3.Database('bot.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Conectado bot database.');
});

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)', (err) => {
        if (err) {
            console.error(err.message);
        }
        
    });
});

module.exports = db;
