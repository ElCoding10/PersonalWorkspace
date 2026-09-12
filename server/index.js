import cors from 'cors'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import express from 'express'
import multer from 'multer'
import { resolve } from 'node:path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { readWorkspace, replaceWorkspace, seedWorkspace } from './db.js'
import db from './db.js'

const app = express()
const port = process.env.PORT || 3001
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

const seedBoards = [
  { id: 'b1', name: 'Recruitment ATS' },
  { id: 'b2', name: 'Payroll system' },
  { id: 'b3', name: 'Onboarding portal' },
  { id: 'b4', name: 'Benefits admin' },
  { id: 'b5', name: 'HR Onboarding' }
]

// Stages for each board
const stagesMap = {
  b1: ['To do', 'In progress', 'Waiting on others', 'Done'],
  b2: ['To do', 'In progress', 'Waiting on others', 'Done'],
  b3: ['To do', 'In progress', 'Waiting on others', 'Done'],
  b4: ['To do', 'In progress', 'Waiting on others', 'Done'],
  b5: ['Job Opening', 'Hiring', 'Airtable Setup', 'HERD Approval', 'Benefits Admin', 'Benefits Update', 'Documentation', 'Complete']
}

const seedColumns = seedBoards.flatMap((board) => 
  stagesMap[board.id].map((title, index) => ({ id: `${board.id}-${index}`, boardId: board.id, title }))
)

const seedCards = [
  { id: 'c1', boardId: 'b1', columnId: 'b1-0', title: 'Screen candidates for Ops Lead', notes: '12 new applicants in the ATS inbox.', due: '2026-09-15', priority: 'Medium', attachments: [], owner: '', category: '', subtasks: [], dependencies: [] },
  { id: 'c2', boardId: 'b1', columnId: 'b1-1', title: 'Schedule interviews - Design role', notes: 'Waiting on 2 more panel confirmations.', due: '2026-09-12', priority: 'High', attachments: ['panel_availability.xlsx'], owner: '', category: '', subtasks: [], dependencies: [] },
  { id: 'c3', boardId: 'b1', columnId: 'b1-3', title: 'Offer sent - Marketing Coordinator', notes: '', due: '', priority: 'Low', attachments: [], owner: '', category: '', subtasks: [], dependencies: [] },
  { id: 'c4', boardId: 'b2', columnId: 'b2-1', title: 'Reconcile September payroll run', notes: 'Two timesheet discrepancies flagged by finance.', due: '2026-09-11', priority: 'Urgent', attachments: ['timesheet_flags.csv'], owner: '', category: '', subtasks: [], dependencies: [] },
  { id: 'c5', boardId: 'b3', columnId: 'b3-0', title: 'Set up laptop + accounts for new hire', notes: 'Starts Monday.', due: '2026-09-14', priority: 'Medium', attachments: [], owner: '', category: '', subtasks: [], dependencies: [] },
  { id: 'c6', boardId: 'b4', columnId: 'b4-2', title: 'Open enrollment questions from staff', notes: 'Waiting on updated plan comparison sheet from broker.', due: '2026-09-20', priority: 'Medium', attachments: [], owner: '', category: '', subtasks: [], dependencies: [] },
  { id: 'c7', boardId: 'b2', columnId: 'b2-0', title: 'Send Q3 bonus calculations to finance', notes: '', due: '2026-09-10', priority: 'High', attachments: [], owner: '', category: '', subtasks: [], dependencies: [] },
  { id: 'c8', boardId: 'b1', columnId: 'b1-2', title: 'Background check - Warehouse Supervisor', notes: '', due: '2026-09-25', priority: 'Low', attachments: [], owner: '', category: '', subtasks: [], dependencies: [] },
  
  // HR Onboarding workflow cards
  {
    id: 'h1',
    boardId: 'b5',
    columnId: 'b5-0',
    title: 'New Job Opening: AI Hiring Assistant',
    notes: 'Position: Senior AI/ML Engineer\nLevel: Senior\nTeam: Engineering',
    due: '2026-09-18',
    priority: 'High',
    attachments: [],
    owner: 'Recruitment Team',
    category: 'New Opening',
    subtasks: [
      { id: 'st1-1', title: 'Create job description', completed: 1 },
      { id: 'st1-2', title: 'Get manager approval', completed: 1 },
      { id: 'st1-3', title: 'Publish on career site', completed: 0 },
      { id: 'st1-4', title: 'Set up interview panel', completed: 0 }
    ],
    dependencies: []
  },
  {
    id: 'h2',
    boardId: 'b5',
    columnId: 'b5-1',
    title: 'John Smith - AI/ML Engineer',
    notes: 'Candidate: John Smith\nInterviews scheduled\nExpected offer date: 2026-09-20',
    due: '2026-09-20',
    priority: 'High',
    attachments: [],
    owner: 'Hiring Manager',
    category: 'Active Candidate',
    subtasks: [
      { id: 'st2-1', title: 'Phone screen with HR', completed: 1 },
      { id: 'st2-2', title: 'Technical round - Sep 12', completed: 0 },
      { id: 'st2-3', title: 'Manager interview - Sep 14', completed: 0 },
      { id: 'st2-4', title: 'Final decision', completed: 0 }
    ],
    dependencies: ['h1']
  },
  {
    id: 'h3',
    boardId: 'b5',
    columnId: 'b5-2',
    title: 'John Smith - Airtable Setup',
    notes: 'Setup new employee record in Airtable\nLink: https://airtable.com/appXXX\nTemplate: WP7 - Job Template\nTemplate Link: https://www.loom.com/share/bb4aa03a3e1b43fe56e208ea516433bd',
    due: '2026-09-21',
    priority: 'High',
    attachments: [],
    owner: 'HR Admin',
    category: 'Airtable',
    subtasks: [
      { id: 'st3-1', title: 'Create employee record in Airtable', completed: 0 },
      { id: 'st3-2', title: 'Fill in personal information', completed: 0 },
      { id: 'st3-3', title: 'Assign to department/role', completed: 0 }
    ],
    dependencies: ['h2']
  },
  {
    id: 'h4',
    boardId: 'b5',
    columnId: 'b5-3',
    title: 'John Smith - HERD Approval',
    notes: 'Step 1: Click "Start Process" in HERD HR\nStep 2: System creates department role if needed\nStep 3: Get approvals from department manager and HR coordinator\nReference: https://docs.google.com/document/d/1d8rp52lQjHjwmwxh55_wpYKAnil7zgUYS90leQl?gid=0#gid=0',
    due: '2026-09-22',
    priority: 'High',
    attachments: [],
    owner: 'HR Admin',
    category: 'HERD',
    subtasks: [
      { id: 'st4-1', title: 'Login to HERD and start process', completed: 0 },
      { id: 'st4-2', title: 'Wait for approvals (typically 1-2 days)', completed: 0 },
      { id: 'st4-3', title: 'Confirm approval completion', completed: 0 }
    ],
    dependencies: ['h3']
  },
  {
    id: 'h5',
    boardId: 'b5',
    columnId: 'b5-4',
    title: 'John Smith - Benefits Admin',
    notes: 'Enable medical, dental, 401k for employee\nReference: https://docs.google.com/document/d/1d8rp52lQjHjwmwxh55_wpYKAnil7zgUYS90leQl?gid=0#gid=0\nAirtable ID: xxxxx\nFollow company enrollment policies',
    due: '2026-09-23',
    priority: 'Medium',
    attachments: [],
    owner: 'Benefits Admin',
    category: 'Benefits',
    subtasks: [
      { id: 'st5-1', title: 'Enable benefits in system', completed: 0 },
      { id: 'st5-2', title: 'Send benefits enrollment forms', completed: 0 },
      { id: 'st5-3', title: 'Verify completion', completed: 0 }
    ],
    dependencies: ['h4']
  }
]

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '2mb' }))

const sessionDurationMs = 1000 * 60 * 60 * 24 * 7
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`)

seedWorkspace({ boards: seedBoards, columns: seedColumns, cards: seedCards })
const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at, rowid LIMIT 1').get()
if (firstUser) db.prepare('UPDATE boards SET user_id = ? WHERE user_id IS NULL').run(firstUser.id)

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = storedHash.split(':')
  if (!salt || !expected) return false
  const actual = scryptSync(password, salt, 64)
  const expectedBuffer = Buffer.from(expected, 'hex')
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function setSessionCookie(response, token) {
  response.setHeader('Set-Cookie', `workbench_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionDurationMs / 1000}`)
}

function getSessionUser(request) {
  const cookie = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('workbench_session='))
  const token = cookie?.slice('workbench_session='.length)
  if (!token) return null
  const session = db.prepare('SELECT users.id, users.email, users.display_name AS displayName, sessions.expires_at AS expiresAt FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?').get(tokenHash(token))
  if (!session || session.expiresAt < Date.now()) return null
  return session
}

function requireAuth(request, response, next) {
  const user = getSessionUser(request)
  if (!user) return response.status(401).json({ error: 'Authentication required.' })
  request.user = user
  next()
}

app.post('/api/auth/register', (request, response) => {
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  const displayName = String(request.body.displayName || '').trim()
  if (!email || !email.includes('@') || password.length < 8 || !displayName) return response.status(400).json({ error: 'Enter a name, a valid email, and a password with at least 8 characters.' })
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return response.status(409).json({ error: 'An account with that email already exists.' })
  const userId = `user-${randomBytes(12).toString('hex')}`
  db.prepare('INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)').run(userId, email, displayName, hashPassword(password))
  db.prepare('UPDATE boards SET user_id = ? WHERE user_id IS NULL').run(userId)
  response.status(201).json({ id: userId, email, displayName, registered: true })
})

app.post('/api/auth/login', (request, response) => {
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  const user = db.prepare('SELECT id, email, display_name AS displayName, password_hash AS passwordHash FROM users WHERE email = ?').get(email)
  if (!user || !verifyPassword(password, user.passwordHash)) return response.status(401).json({ error: 'Email or password is incorrect.' })
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), user.id, Date.now() + sessionDurationMs)
  setSessionCookie(response, token)
  response.json({ id: user.id, email: user.email, displayName: user.displayName })
})

app.post('/api/auth/reset-password', (request, response) => {
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  if (!email || !email.includes('@') || password.length < 8) return response.status(400).json({ error: 'Enter a valid email and a password with at least 8 characters.' })
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (!user) return response.status(404).json({ error: 'No account was found with that email.' })
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id)
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
  response.json({ reset: true })
})

app.get('/api/auth/me', (request, response) => {
  const user = getSessionUser(request)
  if (!user) return response.status(401).json({ error: 'Not signed in.' })
  response.json({ id: user.id, email: user.email, displayName: user.displayName })
})

app.post('/api/auth/logout', (request, response) => {
  const cookie = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('workbench_session='))
  const token = cookie?.slice('workbench_session='.length)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token))
  response.setHeader('Set-Cookie', 'workbench_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
  response.json({ ok: true })
})

app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'personal-assistant', database: 'sqlite', version: '2.0-enhanced' }))
app.get('/api/workspace', requireAuth, (request, response) => response.json(readWorkspace(request.user.id)))
app.put('/api/workspace', requireAuth, (request, response) => {
  const workspace = request.body
  if (!workspace || !Array.isArray(workspace.boards) || !Array.isArray(workspace.columns) || !Array.isArray(workspace.cards)) return response.status(400).json({ error: 'Invalid workspace payload' })
  response.json(replaceWorkspace(workspace, request.user.id))
})
app.get('/api/boards', requireAuth, (request, response) => response.json({ boards: readWorkspace(request.user.id).boards }))

function titleCase(value) {
  return value.replace(/\s+/g, ' ').replace(/\s+-\s+/g, ' - ').trim()
}

function looksLikePhase(line) {
  const taskStart = /^(add|approve|assign|check|click|collect|communicate|create|disable|enable|enter|fill|get|open|pass|publish|register|review|send|set|tick|update|upload|verify|visit|provide|prepare|schedule|submit)\b/i
  return line.length >= 5 && line.length <= 90 && !taskStart.test(line) && !/[.!?:]$/.test(line) && (/\b(status|recruit|hiring|airtable|herd|benefit|document|orientation|statutory|integrity|improvement|feedback|instruction|compliance)\b/i.test(line) || /^[A-Z][A-Z\s&/-]{8,}$/.test(line))
}

function buildWorkflowFromText(text, fileName) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const phaseLines = lines.filter(looksLikePhase).map(titleCase)
  const phases = [...new Set(phaseLines)].slice(0, 12)
  const selectedPhases = phases.length >= 2 ? phases : ['Imported tasks', 'In progress', 'Review', 'Complete']
  const cards = selectedPhases.map((phase) => {
    const start = lines.findIndex((line) => line.toLowerCase() === phase.toLowerCase())
    const notes = start >= 0 ? lines.slice(start + 1, start + 7).join('\n') : ''
    const links = [...notes.matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0])
    return { title: phase, notes: notes || `Imported from ${fileName}`, due: '', priority: 'Medium', attachments: [], owner: '', category: 'Imported workflow', subtasks: [], dependencies: [], links }
  })
  return { name: titleCase(fileName.replace(/\.[^.]+$/, '')) || 'Imported workflow', phases: selectedPhases, cards }
}

app.post('/api/import-workflow', upload.single('document'), async (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Choose a document to import.' })
  try {
    let text = ''
    if (request.file.mimetype === 'application/pdf' || request.file.originalname.toLowerCase().endsWith('.pdf')) { const parser = new PDFParse({ data: request.file.buffer }); text = (await parser.getText()).text; await parser.destroy() }
    else if (request.file.mimetype.includes('word') || request.file.originalname.toLowerCase().endsWith('.docx')) text = (await mammoth.extractRawText({ buffer: request.file.buffer })).value
    else text = request.file.buffer.toString('utf8')
    if (!text.trim()) return response.status(422).json({ error: 'No readable text was found in this document.' })
    response.json(buildWorkflowFromText(text, request.file.originalname))
  } catch {
    response.status(422).json({ error: 'This document could not be read.' })
  }
})

// Subtask endpoints
app.post('/api/cards/:cardId/subtasks', (request, response) => {
  const { cardId } = request.params
  const { title } = request.body
  const subtaskId = `subtask-${Date.now()}`
  const stmt = db.prepare('INSERT INTO subtasks (id, card_id, title, completed, position) VALUES (?, ?, ?, 0, ?)')
  const position = db.prepare('SELECT COUNT(*) as count FROM subtasks WHERE card_id = ?').get(cardId).count
  stmt.run(subtaskId, cardId, title, position)
  response.json({ id: subtaskId, title, completed: false })
})

app.put('/api/subtasks/:subtaskId', (request, response) => {
  const { subtaskId } = request.params
  const { completed, title } = request.body
  if (title) db.prepare('UPDATE subtasks SET title = ? WHERE id = ?').run(title, subtaskId)
  if (completed !== undefined) db.prepare('UPDATE subtasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, subtaskId)
  response.json({ success: true })
})

app.delete('/api/subtasks/:subtaskId', (request, response) => {
  const { subtaskId } = request.params
  db.prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId)
  response.json({ success: true })
})

// Dependency endpoints
app.post('/api/cards/:cardId/dependencies', (request, response) => {
  const { cardId } = request.params
  const { dependsOnCardId } = request.body
  const depId = `dep-${cardId}-${dependsOnCardId}`
  const stmt = db.prepare('INSERT INTO card_dependencies (id, card_id, depends_on_card_id) VALUES (?, ?, ?)')
  stmt.run(depId, cardId, dependsOnCardId)
  response.json({ id: depId, cardId, dependsOnCardId })
})

app.delete('/api/dependencies/:depId', (request, response) => {
  const { depId } = request.params
  db.prepare('DELETE FROM card_dependencies WHERE id = ?').run(depId)
  response.json({ success: true })
})

const clientDist = resolve(process.cwd(), 'dist')
app.use(express.static(clientDist))
app.get(/^(?!\/api).*/, (_request, response) => response.sendFile(resolve(clientDist, 'index.html')))

app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
