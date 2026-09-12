import db from './server/db.js';

console.log('=== All Cards ===');
const cards = db.prepare('SELECT id, title, notes, due, priority FROM cards').all();
console.log(JSON.stringify(cards, null, 2));

console.log('\n=== Card Count ===');
const count = db.prepare('SELECT COUNT(*) as total FROM cards').get();
console.log('Total cards:', count.total);

console.log('\n=== TEST Card Details ===');
const testCard = db.prepare('SELECT * FROM cards WHERE title LIKE ?').all('%TEST%');
console.log(JSON.stringify(testCard, null, 2));
