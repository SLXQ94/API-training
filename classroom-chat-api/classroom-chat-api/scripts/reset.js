// npm run reset  ->  wipe all users and messages
const { writeDB, EMPTY, DB_FILE } = require('../lib/store');

writeDB(JSON.parse(JSON.stringify(EMPTY)));
console.log(`Reset ${DB_FILE}`);
