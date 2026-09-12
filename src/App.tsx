import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  FileUp,
  Eye,
  EyeOff,
  Grid3X3,
  LayoutDashboard,
  List,
  LogIn,
  LogOut,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import "./App.css";

type View = "dashboard" | "calendar" | string;
type Priority = "Low" | "Medium" | "High" | "Urgent";
type Board = { id: string; name: string };
type Column = { id: string; boardId: string; title: string };
type Subtask = { id: string; title: string; completed: number };
type Card = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  notes?: string;
  due: string;
  priority: Priority;
  attachments: string[];
  clientName?: string;
  owner?: string;
  category?: string;
  subtasks?: Subtask[];
  dependencies?: string[];
};
type ImportPreview = { name: string; phases: string[]; cards: Array<Partial<Card>> };
type ModalState = { mode: "new" | "view" | "edit"; card: Partial<Card> } | null;
type ConfirmState = {
  title: string;
  message: string;
  action: () => void;
} | null;
type Notice = { type: "success" | "error"; message: string } | null;

const today = "2026-09-10";
const apiUrl = import.meta.env.VITE_API_URL || "";
const defaultStages = ["To do", "In progress", "Waiting on others", "Done"];
const priorityStyle: Record<Priority, string> = {
  Low: "priority-low",
  Medium: "priority-medium",
  High: "priority-high",
  Urgent: "priority-urgent",
};
let sequence = 100;
const nextId = () => `item-${Date.now()}-${sequence++}`;

function deadlinePriority(card: Pick<Card, "due" | "priority">): Priority {
  if (!card.due) return card.priority || "Medium";
  const daysUntilDue = Math.ceil(
    (new Date(`${card.due}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
      86400000,
  );
  if (daysUntilDue <= 0) return "Urgent";
  if (daysUntilDue <= 2) return "High";
  if (daysUntilDue <= 7) return "Medium";
  return "Low";
}

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [addingBoard, setAddingBoard] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [newBoard, setNewBoard] = useState("");
  const [newColumn, setNewColumn] = useState("");
  const [editingBoard, setEditingBoard] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dragCard, setDragCard] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmation, setConfirmation] = useState<ConfirmState>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const activeBoard = boards.find((board) => board.id === view);
  const activeColumns = columns.filter((column) => column.boardId === view);
  const filteredCards = cards.filter(
    (card) =>
      card.boardId === view &&
      `${card.title} ${(card.subtasks || []).map((step) => step.title).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const nextActions = useMemo(() => {
    const doneIds = new Set(
      columns
        .filter((column) => column.title === "Done")
        .map((column) => column.id),
    );
    return cards
      .filter((card) => !doneIds.has(card.columnId))
      .map((card) => ({ ...card, urgency: deadlinePriority(card) }))
      .sort((left, right) => {
        const priorityOrder: Record<Priority, number> = {
          Urgent: 4,
          High: 3,
          Medium: 2,
          Low: 1,
        };
        const priorityDelta =
          priorityOrder[right.urgency] - priorityOrder[left.urgency];
        if (priorityDelta !== 0) return priorityDelta;
        if (!left.due && !right.due)
          return left.title.localeCompare(right.title);
        if (!left.due) return 1;
        if (!right.due) return -1;
        return left.due.localeCompare(right.due);
      })
      .slice(0, 4);
  }, [cards, columns]);

  useEffect(() => {
    fetch(`${apiUrl}/api/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((account: { displayName: string } | null) => {
        if (account) setUser(account.displayName);
      })
      .catch(() => undefined)
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authChecked || !user) return;
    fetch(`${apiUrl}/api/workspace`, { credentials: "include" })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Workspace could not be loaded")),
      )
      .then(
        (workspace: { boards: Board[]; columns: Column[]; cards: Card[] }) => {
          setBoards(workspace.boards);
          setColumns(workspace.columns);
          setCards(workspace.cards);
        },
      )
      .catch(() => undefined)
      .finally(() => setWorkspaceLoaded(true));
  }, [authChecked, user]);

  useEffect(() => {
    if (!workspaceLoaded || !user) return;
    fetch(`${apiUrl}/api/workspace`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ boards, columns, cards }),
    }).catch(() => undefined);
  }, [boards, columns, cards, workspaceLoaded, user]);

  function createBoard() {
    const name = newBoard.trim();
    if (!name) return;
    const id = nextId();
    setBoards((items) => [...items, { id, name }]);
    setColumns((items) => [
      ...items,
      ...defaultStages.map((title, index) => ({
        id: `${id}-${index}`,
        boardId: id,
        title,
      })),
    ]);
    setNewBoard("");
    setAddingBoard(false);
    setView(id);
  }
  function removeBoard(id: string) {
    const board = boards.find((item) => item.id === id);
    if (!board) return;
    setConfirmation({
      title: "Delete workflow?",
      message: `This will remove ${board.name}, its phases, and all cards.`,
      action: () => {
        setBoards((items) => items.filter((item) => item.id !== id));
        setColumns((items) => items.filter((item) => item.boardId !== id));
        setCards((items) => items.filter((item) => item.boardId !== id));
        if (view === id) setView("dashboard");
      },
    });
  }
  function renameBoard() {
    const name = editingName.trim();
    if (name && editingBoard)
      setBoards((items) =>
        items.map((item) =>
          item.id === editingBoard ? { ...item, name } : item,
        ),
      );
    setEditingBoard(null);
    setEditingName("");
  }
  function cancelBoardRename() {
    setEditingBoard(null);
    setEditingName("");
  }
  function createColumn() {
    const title = newColumn.trim();
    if (!title || !activeBoard) return;
    setColumns((items) => [
      ...items,
      { id: nextId(), boardId: activeBoard.id, title },
    ]);
    setNewColumn("");
    setAddingColumn(false);
  }
  function removeColumn(id: string) {
    const column = columns.find((item) => item.id === id);
    if (!column) return;
    setConfirmation({
      title: "Delete phase?",
      message: `This will remove ${column.title} and all cards inside it.`,
      action: () => {
        setColumns((items) => items.filter((item) => item.id !== id));
        setCards((items) => items.filter((item) => item.columnId !== id));
      },
    });
  }
  function renameColumn() {
    const title = editingColumnName.trim();
    if (title && editingColumn)
      setColumns((items) =>
        items.map((item) =>
          item.id === editingColumn ? { ...item, title } : item,
        ),
      );
    setEditingColumn(null);
    setEditingColumnName("");
  }
  function cancelColumnRename() {
    setEditingColumn(null);
    setEditingColumnName("");
  }
  function saveCard(data: Partial<Card>) {
    const normalizedPriority = (due: string | undefined) =>
      deadlinePriority({ due: due || "", priority: "Medium" });
    const resolvedBoardId = data.boardId || modal?.card.boardId || boards[0].id;
    const resolvedColumnId =
      data.columnId ||
      modal?.card.columnId ||
      columns.find((column) => column.boardId === resolvedBoardId)?.id ||
      columns[0].id;
    if (modal?.mode === "new") {
      const due = data.due || "";
      setCards((items) => [
        ...items,
        {
          id: nextId(),
          title: data.title || "Untitled",
          due,
          priority: normalizedPriority(due),
          boardId: resolvedBoardId,
          columnId: resolvedColumnId,
          attachments: data.attachments || [],
          clientName: data.clientName || "",
          subtasks: data.subtasks || [],
        },
      ]);
    }
    if (modal?.mode !== "new" && modal?.card.id) {
      setCards((items) =>
        items.map((item) =>
          item.id === modal.card.id
            ? {
                ...item,
                ...data,
                boardId: resolvedBoardId,
                columnId: resolvedColumnId,
                due: data.due || item.due,
                priority: normalizedPriority(data.due || item.due),
              }
            : item,
        ),
      );
    }
    setModal(null);
  }
  function moveCard(cardId: string, targetColumn: string) {
    setCards((items) =>
      items.map((item) =>
        item.id === cardId ? { ...item, columnId: targetColumn } : item,
      ),
    );
    setDragCard(null);
  }
  function openNewCard(boardId = activeBoard?.id || boards[0].id, due = "") {
    const firstColumn = columns.find((column) => column.boardId === boardId);
    setModal({
      mode: "new",
      card: {
        boardId,
        columnId: firstColumn?.id,
        due,
        priority: "Medium",
        attachments: [],
      },
    });
  }
  async function importDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append("document", file);
    const response = await fetch(`${apiUrl}/api/import-workflow`, { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) setNotice({ type: "error", message: result.error || "Document could not be imported." });
    else setImportPreview(result);
    event.target.value = "";
  }
  function createImportedWorkflow(preview: ImportPreview) {
    const boardId = nextId();
    const importedColumns = preview.phases.map((title, index) => ({ id: `${boardId}-${index}`, boardId, title }));
    const importedCards = preview.cards.map((card, index) => ({
      id: `${boardId}-card-${index}`,
      title: card.title || "Imported task",
      notes: card.notes || "",
      due: card.due || "",
      priority: deadlinePriority({ due: card.due || "", priority: "Medium" }),
      attachments: card.attachments || [],
      clientName: card.clientName || "",
      boardId,
      columnId: importedColumns[index]?.id || importedColumns[0].id,
      owner: card.owner || "",
      category: card.category || "Imported workflow",
      subtasks: [],
      dependencies: [],
    }));
    setBoards((items) => [...items, { id: boardId, name: preview.name }]);
    setColumns((items) => [...items, ...importedColumns]);
    setCards((items) => [...items, ...importedCards]);
    setImportPreview(null);
    setView(boardId);
  }
  async function signIn(email: string, password: string, displayName?: string, action: "login" | "register" | "reset" = "login") {
    const response = await fetch(`${apiUrl}/api/auth/${action === "reset" ? "reset-password" : action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, displayName }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Authentication failed.");
    if (action !== "login") return result;
    setUser(result.displayName);
    setWorkspaceLoaded(false);
  }

  async function signOut() {
    await fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    setUser(null);
    setBoards([]);
    setColumns([]);
    setCards([]);
    setWorkspaceLoaded(false);
  }

  if (!authChecked || !user) return <LoginScreen onSignIn={signIn} />;

  return (
    <div className="workbench">
      <Notification notice={notice} onDismiss={() => setNotice(null)} />
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-head">
          <span className="wordmark">Workbench</span>
          <button
            className="icon-button quiet"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight size={17} />
            ) : (
              <ChevronsLeft size={17} />
            )}
          </button>
        </div>
        {!collapsed && (
          <p className="sidebar-note">Workflows you're tracking</p>
        )}
        <button
          className={`nav-button ${view === "dashboard" ? "active" : ""}`}
          onClick={() => setView("dashboard")}
          title="Dashboard"
        >
          <LayoutDashboard size={16} />
          {!collapsed && "Dashboard"}
        </button>
        <button
          className={`nav-button ${view === "calendar" ? "active" : ""}`}
          onClick={() => setView("calendar")}
          title="Calendar"
        >
          <CalendarDays size={16} />
          {!collapsed && "Calendar"}
        </button>
        <div className="sidebar-rule" />
        <div className="board-links">
          {boards.map((board) =>
            editingBoard === board.id && !collapsed ? (
              <div className="rename-row" key={board.id}>
                <input
                  autoFocus
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && renameBoard()}
                  onBlur={cancelBoardRename}
                />
                <button
                  className="confirm-button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={renameBoard}
                >
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <div className="board-link-wrap" key={board.id}>
                <button
                  className={`nav-button ${view === board.id ? "active" : ""}`}
                  onClick={() => setView(board.id)}
                  title={board.name}
                >
                  {collapsed ? board.name.charAt(0) : board.name}
                </button>
                {!collapsed && (
                  <div className="board-actions">
                    <button
                      onClick={() => {
                        setEditingBoard(board.id);
                        setEditingName(board.name);
                      }}
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => removeBoard(board.id)}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
        {addingBoard && !collapsed ? (
          <div className="new-row">
            <input
              autoFocus
              value={newBoard}
              onChange={(event) => setNewBoard(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createBoard();
                if (event.key === "Escape") {
                  setNewBoard("");
                  setAddingBoard(false);
                }
              }}
              placeholder="Workflow name"
            />
            <button onClick={createBoard}>Add</button>
            <button
              className="cancel-inline"
              onClick={() => {
                setNewBoard("");
                setAddingBoard(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="new-link"
            onClick={() =>
              collapsed ? setCollapsed(false) : setAddingBoard(true)
            }
          >
            <Plus size={15} />
            {!collapsed && "New workflow"}
          </button>
        )}
        {!collapsed && (
          <button className="new-link" onClick={() => importFileRef.current?.click()}>
            <FileUp size={15} />
            Import document
          </button>
        )}
        <input ref={importFileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" onChange={importDocument} hidden />
        {!collapsed && (
          <div className="sidebar-footer">
            <div className="user-panel">
              <span className="user-avatar">
                {user.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{user}</strong>
                <span>Workspace member</span>
              </div>
              <button
                className="logout-button"
                onClick={() => setConfirmation({ title: "Logout?", message: "Are you sure you want to end your session?", action: signOut })}
                        title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
            <p>
              One board per workflow. Track anything moving through it here.
            </p>
          </div>
        )}
      </aside>
      <main className="main-content">
        {view === "dashboard" && (
          <Dashboard
            boards={boards}
            columns={columns}
            cards={cards}
            nextActions={nextActions}
            onOpen={setView}
          />
        )}
        {view === "calendar" && (
          <CalendarView
            boards={boards}
            cards={cards}
            onEdit={(card) => setModal({ mode: "view", card })}
            onNew={openNewCard}
          />
        )}
        {activeBoard && (
          <BoardView
            board={activeBoard}
            columns={activeColumns}
            cards={filteredCards}
            query={query}
            setQuery={setQuery}
            onNew={() => openNewCard(activeBoard.id)}
            onEdit={(card) => setModal({ mode: "view", card })}
            onDrop={moveCard}
            dragCard={dragCard}
            setDragCard={setDragCard}
            addingColumn={addingColumn}
            setAddingColumn={setAddingColumn}
            newColumn={newColumn}
            setNewColumn={setNewColumn}
            createColumn={createColumn}
            removeColumn={removeColumn}
            editingColumn={editingColumn}
            setEditingColumn={setEditingColumn}
            editingColumnName={editingColumnName}
            setEditingColumnName={setEditingColumnName}
            renameColumn={renameColumn}
            cancelColumnRename={cancelColumnRename}
          />
        )}
      </main>
      {modal && (
        <CardModal
          modal={modal}
          boards={boards}
          columns={columns}
          onClose={() => setModal(null)}
          onSave={saveCard}
          onStepToggle={(id, subtasks) => setCards((items) => items.map((item) => item.id === id ? { ...item, subtasks } : item))}
          onDelete={(id) =>
            setConfirmation({
              title: "Delete card?",
              message: "This card and its details will be permanently removed.",
              action: () => {
                setCards((items) => items.filter((item) => item.id !== id));
                setModal(null);
              },
            })
          }
        />
      )}
      {importPreview && (
        <ImportDialog preview={importPreview} onCancel={() => setImportPreview(null)} onConfirm={() => createImportedWorkflow(importPreview)} />
      )}
      {confirmation && (
        <ConfirmDialog
          confirmation={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            confirmation.action();
            setConfirmation(null);
          }}
        />
      )}
    </div>
  );
}

function Notification({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  if (!notice) return null;
  return <div className={`notification notification-${notice.type}`} role="alert"><span>{notice.message}</span><button type="button" onClick={onDismiss} aria-label="Dismiss notification"><X size={15} /></button></div>;
}

function LoginScreen({ onSignIn }: { onSignIn: (email: string, password: string, displayName?: string, action?: "login" | "register" | "reset") => Promise<{ registered?: boolean; reset?: boolean } | undefined> }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === "forgot" && password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const result = await onSignIn(email, password, displayName, mode === "forgot" ? "reset" : mode);
      if (mode === "register" && result?.registered) {
        setNotice({ type: "success", message: "Account created successfully. Please login to continue." });
        setMode("login");
        setPassword("");
      }
      if (mode === "forgot" && result?.reset) {
        setNotice({ type: "success", message: "Password renewed successfully. Please login with your new password." });
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (submissionError) {
      setNotice({ type: "error", message: submissionError instanceof Error ? submissionError.message : "Authentication failed." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <Notification notice={notice} onDismiss={() => setNotice(null)} />
      <section className="login-panel">
        <div className="login-brand">
          <span>W</span>
          <strong>Workbench</strong>
        </div>
        <div className="login-copy">
          <p className="login-eyebrow">Your work, in one place</p>
          <h1>{mode === "login" ? "Welcome back." : mode === "register" ? "Create your account." : "Renew your password."}</h1>
          <p>{mode === "login" ? "Login to pick up where your workflows left off." : mode === "register" ? "Create credentials for your private workspace." : "Enter your email and choose a new password."}</p>
        </div>
        <form onSubmit={submit} className="login-form">
          {mode === "register" && <label>Display name<input autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
          <label>Email<input autoFocus={mode === "login"} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          {mode === "forgot" && <label>New password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
          {mode === "forgot" && <label>Confirm password<div className="password-field"><input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
          {mode !== "forgot" && <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
          <button className="primary-button" type="submit" disabled={submitting}>
            <LogIn size={15} /> {submitting ? "Checking..." : mode === "login" ? "Login" : mode === "register" ? "Create account" : "Renew password"}
          </button>
        </form>
        {mode === "login" && <button className="auth-switch" type="button" onClick={() => { setMode("forgot"); setNotice(null); setPassword(""); }}>Forgot password?</button>}
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setNotice(null); setPassword(""); setConfirmPassword(""); }}>{mode === "login" ? "Create an account" : "Back to Login"}</button>
        <p className="login-note">Your session is protected by a server-side credential and HTTP-only cookie.</p>
      </section>
      <aside className="login-aside">
        <div className="aside-mark">✦</div>
        <p>
          Track the moving pieces.
          <br />
          <em>Make progress visible.</em>
        </p>
        <span>HR OPERATIONS / 01</span>
      </aside>
    </main>
  );
}

function ConfirmDialog({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: NonNullable<ConfirmState>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon">
          <Trash2 size={17} />
        </div>
        <h2>{confirmation.title}</h2>
        <p>{confirmation.message}</p>
        <div className="confirm-actions">
          <button className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportDialog({ preview, onCancel, onConfirm }: { preview: ImportPreview; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" onClick={onCancel}><div className="modal import-dialog" onClick={(event) => event.stopPropagation()}><header><div><h2>Review imported workflow</h2><p className="modal-hint">Check the detected phases before adding them to your workspace.</p></div><button className="icon-button quiet" onClick={onCancel}><X size={18} /></button></header><div className="import-summary"><span className="detail-label">Workflow</span><strong>{preview.name}</strong><span className="detail-label">Detected phases</span><div className="import-phase-list">{preview.phases.map((phase) => <span key={phase}>{phase}</span>)}</div><span className="detail-label">Imported cards</span><strong>{preview.cards.length}</strong></div><footer className="modal-footer"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={onConfirm}>Create workflow</button></footer></div></div>;
}

function Dashboard({
  boards,
  columns,
  cards,
  nextActions,
  onOpen,
}: {
  boards: Board[];
  columns: Column[];
  cards: Card[];
  nextActions: Card[];
  onOpen: (id: string) => void;
}) {
  const doneIds = new Set(
    columns
      .filter((column) => column.title === "Done")
      .map((column) => column.id),
  );
  const active = cards.filter((card) => !doneIds.has(card.columnId));
  const dueSoon = active
    .filter((card) => card.due && card.due <= "2026-09-17")
    .sort((a, b) => a.due.localeCompare(b.due));
  const metrics = [
    ["Active cards", active.length],
    ["Due within 7 days", dueSoon.length],
    [
      "Urgent",
      active.filter((card) => deadlinePriority(card) === "Urgent").length,
    ],
    ["Workflows tracked", boards.length],
  ];
  return (
    <div className="page-scroll dashboard">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Everything you're tracking, in one place.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => onOpen(boards[0]?.id || "dashboard")}
        >
          <ArrowRight size={15} /> Open a workflow
        </button>
      </header>
      <div className="metrics">
        {metrics.map(([label, value]) => (
          <div className="metric" key={label as string}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section>
          <h2>Your workflows</h2>
          <div className="workflow-list">
            {boards.map((board) => {
              const boardColumns = columns.filter(
                (column) => column.boardId === board.id,
              );
              const boardCards = cards.filter(
                (card) => card.boardId === board.id,
              );
              const activeCount = boardCards.filter(
                (card) => !doneIds.has(card.columnId),
              ).length;
              return (
                <button
                  className="workflow-row"
                  key={board.id}
                  onClick={() => onOpen(board.id)}
                >
                  <div>
                    <strong>{board.name}</strong>
                    <span>
                      {activeCount} active · {boardColumns.length} stages
                    </span>
                  </div>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
        </section>
        <section>
          <h2>Next actions</h2>
          <div className="next-actions">
            {nextActions.length === 0 ? (
              <p className="muted">No active work needs attention right now.</p>
            ) : (
              nextActions.map((card) => (
                <button
                  className="action-row"
                  key={card.id}
                  onClick={() => onOpen(card.boardId)}
                >
                  <div className="action-copy">
                    <strong>{card.title}</strong>
                    <span>
                      {card.due || "No due date"} ·{" "}
                      {boards.find((board) => board.id === card.boardId)
                        ?.name || "Workflow"}
                    </span>
                  </div>
                  <span className="action-badge">
                    <Priority priority={deadlinePriority(card)} />
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section>
          <h2>Coming up</h2>
          <div className="coming-up">
            {dueSoon.length === 0 ? (
              <p className="muted">Nothing due in the next 7 days.</p>
            ) : (
              dueSoon.map((card) => (
                <div className="upcoming-row" key={card.id}>
                  <Clock3 size={14} />
                  <div>
                    <strong>{card.title}</strong>
                    <span>{card.due}</span>
                  </div>
                  <Priority priority={deadlinePriority(card)} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function BoardView({
  board,
  columns,
  cards,
  query,
  setQuery,
  onNew,
  onEdit,
  onDrop,
  dragCard,
  setDragCard,
  addingColumn,
  setAddingColumn,
  newColumn,
  setNewColumn,
  createColumn,
  removeColumn,
  editingColumn,
  setEditingColumn,
  editingColumnName,
  setEditingColumnName,
  renameColumn,
  cancelColumnRename,
}: {
  board: Board;
  columns: Column[];
  cards: Card[];
  query: string;
  setQuery: (value: string) => void;
  onNew: () => void;
  onEdit: (card: Card) => void;
  onDrop: (cardId: string, columnId: string) => void;
  dragCard: string | null;
  setDragCard: (id: string | null) => void;
  addingColumn: boolean;
  setAddingColumn: (value: boolean) => void;
  newColumn: string;
  setNewColumn: (value: string) => void;
  createColumn: () => void;
  removeColumn: (id: string) => void;
  editingColumn: string | null;
  setEditingColumn: (id: string | null) => void;
  editingColumnName: string;
  setEditingColumnName: (value: string) => void;
  renameColumn: () => void;
  cancelColumnRename: () => void;
}) {
  return (
    <div className="board-page">
      <header className="board-toolbar">
        <h1>{board.name}</h1>
        <div className="toolbar-actions">
          <label className="search-box">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards"
            />
          </label>
          <button className="primary-button" onClick={onNew}>
            <Plus size={15} /> New card
          </button>
        </div>
      </header>
      <div className="kanban-scroll">
        <div className="kanban">
          {columns.map((column, columnIndex) => {
            const columnCards = cards.filter(
              (card) => card.columnId === column.id,
            );
            const nextColumn = columns[columnIndex + 1];
            const isEditing = editingColumn === column.id;
            return (
              <section
                className={`stage ${dragCard ? "drop-ready" : ""}`}
                key={column.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dragCard && onDrop(dragCard, column.id)}
              >
                <div className="stage-head">
                  {isEditing ? (
                    <div className="stage-title-edit">
                      <input
                        autoFocus
                        value={editingColumnName}
                        onChange={(event) =>
                          setEditingColumnName(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") renameColumn();
                          if (event.key === "Escape") cancelColumnRename();
                        }}
                        onBlur={cancelColumnRename}
                      />
                      <button
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={renameColumn}
                        title="Save phase name"
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  ) : (
                    <h2>
                      {column.title}
                      <span>{columnCards.length}</span>
                    </h2>
                  )}
                  <div className="stage-actions">
                    {!isEditing && (
                      <button
                        className="icon-button quiet"
                        onClick={() => {
                          setEditingColumn(column.id);
                          setEditingColumnName(column.title);
                        }}
                        title="Rename phase"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    <button
                      className="icon-button quiet"
                      onClick={() => removeColumn(column.id)}
                      title="Remove stage"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="stage-cards">
                  {columnCards.map((card) => (
                    <article
                      className={`card ${dragCard === card.id ? "dragging" : ""}`}
                      key={card.id}
                      draggable
                      onDragStart={() => setDragCard(card.id)}
                      onDragEnd={() => setDragCard(null)}
                      onClick={() => onEdit(card)}
                    >
                      <strong>{card.title}</strong>
                      {card.subtasks && card.subtasks.length > 0 && <p className="step-summary">{card.subtasks.filter((step) => step.completed).length}/{card.subtasks.length} steps complete</p>}
                      <div className="card-meta">
                        <Priority priority={deadlinePriority(card)} />
                        {card.due && <span>{card.due}</span>}
                        {card.attachments.length > 0 && (
                          <span className="attachment">
                            <Paperclip size={12} /> {card.attachments.length}
                          </span>
                        )}
                        {nextColumn && (
                          <button
                            className="next-phase-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDrop(card.id, nextColumn.id);
                            }}
                            title={`Move to ${nextColumn.title}`}
                            aria-label={`Move to ${nextColumn.title}`}
                          >
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <button className="stage-add-card" onClick={() => onNew()} title={`Add card to ${column.title}`}>
                  <Plus size={13} /> Add card
                </button>
              </section>
            );
          })}
          <section className="add-stage">
            {addingColumn ? (
              <div className="new-stage">
                <input
                  autoFocus
                  value={newColumn}
                  onChange={(event) => setNewColumn(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") createColumn();
                    if (event.key === "Escape") {
                      setNewColumn("");
                      setAddingColumn(false);
                    }
                  }}
                  placeholder="Stage name"
                />
                <button onClick={createColumn}>Add</button>
                <button
                  className="cancel-inline"
                  onClick={() => {
                    setNewColumn("");
                    setAddingColumn(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setAddingColumn(true)}>
                <Plus size={15} /> Add stage
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Priority({ priority }: { priority: Priority }) {
  return (
    <span className={`priority ${priorityStyle[priority]}`}>{priority}</span>
  );
}

function CalendarView({
  boards,
  cards,
  onEdit,
  onNew,
}: {
  boards: Board[];
  cards: Card[];
  onEdit: (card: Card) => void;
  onNew: (boardId?: string, due?: string) => void;
}) {
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const [cursor, setCursor] = useState(new Date(2026, 8, 1));
  const [filter, setFilter] = useState("all");
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, 1).getDay();
  const filtered = cards.filter(
    (card) => card.due && (filter === "all" || card.boardId === filter),
  );
  const byDate = useMemo(
    () =>
      filtered.reduce<Record<string, Card[]>>((result, card) => {
        result[card.due] = [...(result[card.due] || []), card];
        return result;
      }, {}),
    [filtered],
  );
  const dateKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const monthName = cursor.toLocaleString("en-US", { month: "long" });
  return (
    <div className="page-scroll calendar-page">
      <header className="calendar-toolbar">
        <div className="calendar-title">
          <h1>{mode === "month" ? `${monthName} ${year}` : "Agenda"}</h1>
          {mode === "month" && (
            <div className="calendar-nav">
              <button
                className="icon-button"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="today-button"
                onClick={() => setCursor(new Date(2026, 8, 1))}
              >
                Today
              </button>
              <button
                className="icon-button"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="toolbar-actions">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All workflows</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <div className="view-toggle">
            <button
              className={mode === "month" ? "selected" : ""}
              onClick={() => setMode("month")}
            >
              <Grid3X3 size={13} /> Month
            </button>
            <button
              className={mode === "agenda" ? "selected" : ""}
              onClick={() => setMode("agenda")}
            >
              <List size={13} /> Agenda
            </button>
          </div>
          <button
            className="primary-button"
            onClick={() => onNew(filter === "all" ? undefined : filter, today)}
          >
            <Plus size={15} /> New card
          </button>
        </div>
      </header>
      {mode === "month" ? (
        <div className="calendar-grid">
          <div className="weekday-row">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="month-cells">
            {Array.from({ length: start }, (_, index) => (
              <div className="calendar-cell blank" key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const key = dateKey(day);
              return (
                <div
                  className="calendar-cell"
                  key={key}
                  onClick={() =>
                    onNew(filter === "all" ? undefined : filter, key)
                  }
                >
                  <span className={key === today ? "today-number" : ""}>
                    {day}
                  </span>
                  {(byDate[key] || []).slice(0, 3).map((card) => (
                    <button
                      className={`calendar-card ${priorityStyle[deadlinePriority(card)]}`}
                      key={card.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(card);
                      }}
                    >
                      {card.title}
                    </button>
                  ))}
                  {(byDate[key] || []).length > 3 && (
                    <small>+{byDate[key].length - 3} more</small>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Agenda cards={filtered} onEdit={onEdit} />
      )}
    </div>
  );
}

function Agenda({
  cards,
  onEdit,
}: {
  cards: Card[];
  onEdit: (card: Card) => void;
}) {
  const groups = cards.reduce<Record<string, Card[]>>((result, card) => {
    result[card.due] = [...(result[card.due] || []), card];
    return result;
  }, {});
  return (
    <div className="agenda">
      {Object.keys(groups)
        .sort()
        .map((date) => (
          <section key={date}>
            <h2>
              {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            {groups[date].map((card) => (
              <button
                className="agenda-card"
                key={card.id}
                onClick={() => onEdit(card)}
              >
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.subtasks && card.subtasks.length > 0 ? `${card.subtasks.filter((step) => step.completed).length}/${card.subtasks.length} steps complete` : "No steps added"}</span>
                </div>
                <Priority priority={deadlinePriority(card)} />
              </button>
            ))}
          </section>
        ))}
    </div>
  );
}

function StepChecklist({
  steps,
  editable,
  allowToggle = editable,
  onChange,
}: {
  steps: Subtask[];
  editable: boolean;
  allowToggle?: boolean;
  onChange: (steps: Subtask[]) => void;
}) {
  const [newStep, setNewStep] = useState("");

  function updateStep(index: number, changes: Partial<Subtask>) {
    onChange(steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...changes } : step)));
  }

  function addStep() {
    const title = newStep.trim();
    if (!title) return;
    onChange([...steps, { id: nextId(), title, completed: 0 }]);
    setNewStep("");
  }

  function renderStepTitle(value: string) {
    return value.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
      /^https?:\/\//.test(part) ? (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(event) => event.stopPropagation()}
        >
          {part}
        </a>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      ),
    );
  }

  return (
    <div className="step-checklist">
      {steps.length === 0 && <p className="muted">No steps added yet.</p>}
      {steps.map((step, index) => (
        <div className={`step-row ${step.completed ? "completed" : ""}`} key={`${step.id}-${index}`}>
          <input
            type="checkbox"
            checked={Boolean(step.completed)}
            disabled={!allowToggle}
            onChange={(event) => updateStep(index, { completed: event.target.checked ? 1 : 0 })}
          />
          {editable ? (
            <input
              className="step-title-input"
              value={step.title}
              onChange={(event) => updateStep(index, { title: event.target.value })}
            />
          ) : (
            <span>{renderStepTitle(step.title)}</span>
          )}
          {editable && (
            <button
              className="step-delete"
              type="button"
              title="Delete step"
              aria-label={`Delete ${step.title}`}
              onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index))}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {editable && (
        <div className="add-step-row">
          <input
            value={newStep}
            onChange={(event) => setNewStep(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addStep()}
            placeholder="Add a step"
          />
          <button type="button" onClick={addStep}>
            <Plus size={13} /> Add step
          </button>
        </div>
      )}
    </div>
  );
}

function CardModal({
  modal,
  boards,
  columns,
  onClose,
  onSave,
  onStepToggle,
  onDelete,
}: {
  modal: NonNullable<ModalState>;
  boards: Board[];
  columns: Column[];
  onClose: () => void;
  onSave: (data: Partial<Card>) => void;
  onStepToggle: (id: string, subtasks: Subtask[]) => void;
  onDelete: (id: string) => void;
}) {
  const resolvedBoardId = modal.card.boardId || boards[0].id;
  const [form, setForm] = useState({
    title: modal.card.title || "",
    due: modal.card.due || "",
    boardId: resolvedBoardId,
    columnId:
      modal.card.columnId ||
      columns.find((column) => column.boardId === resolvedBoardId)?.id ||
      "",
    attachments: modal.card.attachments || [],
    clientName: modal.card.clientName || "",
    subtasks: modal.card.subtasks || [],
  });
  const [isEditing, setIsEditing] = useState(
    modal.mode === "new" || modal.mode === "edit",
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const boardColumns = columns.filter(
    (column) => column.boardId === form.boardId,
  );
  const boardName =
    boards.find((board) => board.id === form.boardId)?.name || "Workflow";
  const viewOnly = modal.mode === "view" && !isEditing;

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function attach(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        ...Array.from(event.target.files || []).map((file) => file.name),
      ],
    }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>
            {modal.mode === "new"
              ? "New card"
              : viewOnly
                ? "View card"
                : "Edit card"}
          </h2>
          <button className="icon-button quiet" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {viewOnly ? (
          <div className="card-view">
            <div className="detail-block">
              <span className="detail-label">Title</span>
              <h3>{form.title || "Untitled"}</h3>
            </div>
            <div className="detail-block">
              <span className="detail-label">Steps</span>
              <StepChecklist steps={form.subtasks} editable={false} allowToggle onChange={(subtasks) => { setForm((current) => ({ ...current, subtasks })); if (modal.card.id) onStepToggle(modal.card.id, subtasks); }} />
            </div>
            {form.clientName && (
              <div className="detail-block">
                <span className="detail-label">Client name</span>
                <p>{form.clientName}</p>
              </div>
            )}
            <div className="detail-block">
              <span className="detail-label">Priority</span>
              <p>{deadlinePriority({ due: form.due, priority: "Medium" })}</p>
            </div>
            <div className="form-split">
              <div className="detail-block">
                <span className="detail-label">Due date</span>
                <p>{form.due || "No due date"}</p>
              </div>
            </div>
            {form.attachments.length > 0 && (
              <div className="detail-block">
                <span className="detail-label">Attachments</span>
                <div className="attachment-list">
                  {form.attachments.map((file, index) => (
                    <a
                      key={`${file}-${index}`}
                      href={file}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="attachment-link"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {file}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <label>
              Title
              <input
                autoFocus
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="What needs tracking?"
              />
            </label>
            <label>
              Steps
              <StepChecklist steps={form.subtasks} editable={true} onChange={(subtasks) => setForm((current) => ({ ...current, subtasks }))} />
            </label>
            <label>
              Client name
              <input
                value={form.clientName}
                onChange={(event) => update("clientName", event.target.value)}
                placeholder="Optional"
              />
            </label>
            <div className="form-split">
              <label>
                Workflow<div className="read-only-field">{boardName}</div>
              </label>
              <label>
                Stage
                <select
                  value={form.columnId}
                  onChange={(event) => update("columnId", event.target.value)}
                >
                  {boardColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Due date
              <input
                type="date"
                value={form.due}
                onChange={(event) => update("due", event.target.value)}
              />
            </label>
            <label>
              Attachments
              <div className="attachment-list">
                {form.attachments.map((file, index) => (
                  <span key={`${file}-${index}`}>
                    <Paperclip size={12} />
                    {file}
                    <button
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          attachments: current.attachments.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <button
                className="attach-button"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={13} /> Attach file
              </button>
              <input
                ref={fileRef}
                hidden
                type="file"
                multiple
                onChange={attach}
              />
            </label>
          </>
        )}
        {modal.mode === "new" ? (
          <footer className="modal-footer">
            <button className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() =>
                form.title.trim() &&
                onSave({
                  ...form,
                  boardId: resolvedBoardId,
                  columnId: form.columnId || boardColumns[0]?.id || "",
                  priority: deadlinePriority({
                    due: form.due,
                    priority: "Medium",
                  }),
                })
              }
            >
              Add card
            </button>
          </footer>
        ) : viewOnly ? (
          <footer className="modal-footer">
            <button
              className="delete-button"
              onClick={() => modal.card.id && onDelete(modal.card.id)}
            >
              <Trash2 size={14} /> Delete
            </button>
            <div className="modal-actions-right">
              <button
                className="primary-button"
                onClick={() => setIsEditing(true)}
              >
                <Pencil size={15} /> Edit
              </button>
            </div>
          </footer>
        ) : (
          <footer className="modal-footer">
            <button
              className="delete-button"
              onClick={() => modal.card.id && onDelete(modal.card.id)}
            >
              <Trash2 size={14} /> Delete
            </button>
            <div className="modal-actions-right">
              <button
                className="secondary-button"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={() =>
                  form.title.trim() &&
                  onSave({
                    ...form,
                    boardId: resolvedBoardId,
                    columnId: form.columnId || boardColumns[0]?.id || "",
                    priority: deadlinePriority({
                      due: form.due,
                      priority: "Medium",
                    }),
                  })
                }
              >
                Save changes
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default App;
