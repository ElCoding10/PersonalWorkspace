import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const databasePath = resolve(process.env.DATABASE_PATH || './data/workbench.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })
const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    due TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'Medium',
    attachments TEXT NOT NULL DEFAULT '[]',
    owner TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS card_dependencies (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    depends_on_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    board_template TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

if (!db.prepare('PRAGMA table_info(cards)').all().some((column) => column.name === 'client_name')) {
  db.exec("ALTER TABLE cards ADD COLUMN client_name TEXT NOT NULL DEFAULT ''")
}
if (!db.prepare('PRAGMA table_info(boards)').all().some((column) => column.name === 'user_id')) {
  db.exec("ALTER TABLE boards ADD COLUMN user_id TEXT")
}

export function readWorkspace(userId) {
  const boards = userId
    ? db.prepare('SELECT id, name FROM boards WHERE user_id = ? ORDER BY created_at, rowid').all(userId)
    : db.prepare('SELECT id, name FROM boards ORDER BY created_at, rowid').all()
  const boardIds = new Set(boards.map((board) => board.id))
  const columns = db.prepare('SELECT id, board_id AS boardId, title FROM columns ORDER BY board_id, position, rowid').all().filter((column) => boardIds.has(column.boardId))
  const cards = db.prepare('SELECT id, board_id AS boardId, column_id AS columnId, title, notes, due, priority, attachments, client_name AS clientName, owner, category FROM cards ORDER BY board_id, column_id, position, rowid').all().filter((card) => boardIds.has(card.boardId)).map((card) => ({
    ...card,
    attachments: JSON.parse(card.attachments),
    subtasks: db.prepare('SELECT id, title, completed FROM subtasks WHERE card_id = ? ORDER BY position').all(card.id),
    dependencies: db.prepare('SELECT depends_on_card_id FROM card_dependencies WHERE card_id = ?').all(card.id).map(d => d.depends_on_card_id)
  }))
  
  return { boards, columns, cards }
}

export function replaceWorkspace(workspace, userId) {
  const replace = db.transaction((data) => {
    if (userId) {
      db.prepare('DELETE FROM card_dependencies WHERE card_id IN (SELECT id FROM cards WHERE board_id IN (SELECT id FROM boards WHERE user_id = ?))').run(userId)
      db.prepare('DELETE FROM subtasks WHERE card_id IN (SELECT id FROM cards WHERE board_id IN (SELECT id FROM boards WHERE user_id = ?))').run(userId)
      db.prepare('DELETE FROM cards WHERE board_id IN (SELECT id FROM boards WHERE user_id = ?)').run(userId)
      db.prepare('DELETE FROM columns WHERE board_id IN (SELECT id FROM boards WHERE user_id = ?)').run(userId)
      db.prepare('DELETE FROM boards WHERE user_id = ?').run(userId)
    } else {
      db.prepare('DELETE FROM card_dependencies').run()
      db.prepare('DELETE FROM subtasks').run()
      db.prepare('DELETE FROM cards').run()
      db.prepare('DELETE FROM columns').run()
      db.prepare('DELETE FROM boards').run()
    }
    
    const boardInsert = db.prepare('INSERT INTO boards (id, name, user_id) VALUES (?, ?, ?)')
    const columnInsert = db.prepare('INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)')
    const cardInsert = db.prepare('INSERT INTO cards (id, board_id, column_id, title, notes, due, priority, attachments, client_name, owner, category, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const subtaskInsert = db.prepare('INSERT INTO subtasks (id, card_id, title, completed, position) VALUES (?, ?, ?, ?, ?)')
    const dependencyInsert = db.prepare('INSERT INTO card_dependencies (id, card_id, depends_on_card_id) VALUES (?, ?, ?)')
    
    data.boards.forEach((board) => boardInsert.run(board.id, board.name, userId || null))
    data.columns.forEach((column, index) => columnInsert.run(column.id, column.boardId, column.title, index))
    data.cards.forEach((card, index) => {
      cardInsert.run(card.id, card.boardId, card.columnId, card.title, card.notes || '', card.due || '', card.priority || 'Medium', JSON.stringify(card.attachments || []), card.clientName || '', card.owner || '', card.category || '', index)
      
      if (card.subtasks && Array.isArray(card.subtasks)) {
        card.subtasks.forEach((subtask, subIndex) => {
          subtaskInsert.run(subtask.id, card.id, subtask.title, subtask.completed ? 1 : 0, subIndex)
        })
      }
      
      if (card.dependencies && Array.isArray(card.dependencies)) {
        card.dependencies.forEach((depId) => {
          dependencyInsert.run(`dep-${card.id}-${depId}`, card.id, depId)
        })
      }
    })
  })
  replace(workspace)
  return readWorkspace(userId)
}

export function seedWorkspace(workspace) {
  if (db.prepare('SELECT COUNT(*) AS count FROM boards').get().count === 0) replaceWorkspace(workspace, null)
}

export default db
