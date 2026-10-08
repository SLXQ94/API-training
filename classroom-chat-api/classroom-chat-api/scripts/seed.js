// npm run seed  ->  wipe the database, then add 3 demo users and a few messages
// Demo logins:  CS101 / pass101,  CS102 / pass102,  CS103 / pass103
const { writeDB, EMPTY, DB_FILE } = require('../lib/store');
const { hashPassword } = require('../lib/password');

const now = () => new Date().toISOString();
const db = JSON.parse(JSON.stringify(EMPTY));

for (const [rollNo, name] of [['CS101', 'Asha'], ['CS102', 'Ravi'], ['CS103', 'Meera']]) {
  db.users.push({
    rollNo,
    name,
    passwordHash: hashPassword('pass' + rollNo.slice(2)),
    createdAt: now(),
  });
}

const add = (from, to, text) =>
  db.messages.push({ id: db.nextMessageId++, from, to, text, createdAt: now() });

add('CS101', 'CS102', 'Hey Ravi, did you get the assignment?');
add('CS102', 'CS101', 'Yes! Will share my notes after class.');
add('CS103', 'class', 'Good morning everyone!');

writeDB(db);
console.log(`Seeded ${DB_FILE}`);
console.log('Logins: CS101/pass101  CS102/pass102  CS103/pass103');
