import os
import re
import sqlite3
from pathlib import Path
from functools import wraps
from flask import Flask, jsonify, request, render_template, session, redirect, url_for, flash
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "library.db"))
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-secret-key")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'General',
                isbn TEXT DEFAULT '',
                year INTEGER,
                copies INTEGER NOT NULL DEFAULT 1,
                available INTEGER NOT NULL DEFAULT 1,
                description TEXT NOT NULL DEFAULT ''
            )
        """)
        count = db.execute("SELECT COUNT(*) FROM books").fetchone()[0]
        if count == 0:
            sample_books = [
                ("Clean Code", "Robert C. Martin", "Programming", "9780132350884", 2008, 4, 3, "A handbook of agile software craftsmanship, with practical guidance for writing readable and maintainable code."),
                ("Introduction to Algorithms", "Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein", "Computer Science", "9780262046305", 2022, 3, 1, "A comprehensive textbook covering algorithms, data structures, graph algorithms, dynamic programming, and complexity."),
                ("The Pragmatic Programmer", "Andrew Hunt and David Thomas", "Programming", "9780135957059", 2019, 2, 2, "Practical advice and techniques for improving software development skills and building robust systems."),
                ("Database System Concepts", "Abraham Silberschatz, Henry F. Korth, S. Sudarshan", "Database", "9780078022159", 2019, 5, 4, "An introduction to database systems, SQL, transactions, indexing, normalization, and database design."),
                ("Artificial Intelligence: A Modern Approach", "Stuart Russell and Peter Norvig", "Artificial Intelligence", "9780134610993", 2021, 2, 0, "A broad introduction to AI, search, knowledge representation, machine learning, reasoning, and intelligent agents."),
                ("The Design of Everyday Things", "Don Norman", "Design", "9780465050659", 2013, 2, 1, "Explains human-centered design, usability, feedback, affordances, and how to design products people can use."),
                ("Cosmos", "Carl Sagan", "Science", "9780345539434", 2013, 3, 2, "An accessible exploration of astronomy, the origins of life, and humanity's place in the universe."),
                ("Deep Work", "Cal Newport", "Productivity", "9781455586691", 2016, 2, 2, "Strategies for focused work, reducing distraction, and producing meaningful results.")
            ]
            db.executemany("""INSERT INTO books
                (title, author, category, isbn, year, copies, available, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", sample_books)

def book_dict(row):
    return {key: row[key] for key in row.keys()}

def find_books(query="", category=""):
    sql = "SELECT * FROM books WHERE 1=1"
    params = []
    if query.strip():
        term = f"%{query.strip()}%"
        sql += " AND (title LIKE ? OR author LIKE ? OR category LIKE ? OR isbn LIKE ? OR description LIKE ?)"
        params.extend([term, term, term, term, term])
    if category.strip():
        sql += " AND category = ?"
        params.append(category.strip())
    sql += " ORDER BY title COLLATE NOCASE"
    with get_db() as db:
        return [book_dict(r) for r in db.execute(sql, params).fetchall()]

def tokenize(text):
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))

def answer_question(message):
    msg = (message or "").strip()
    if not msg:
        return {"answer": "Type a question about books, authors, subjects, or availability.", "books": []}
    lower = msg.lower()
    if any(greet in lower for greet in ["hello", "hi", "hey", "good morning", "good afternoon"]):
        return {"answer": "Hi! I'm your college library assistant. Ask me to find a book, check availability, explore a subject, or recommend something to read.", "books": []}

    all_books = find_books()
    # Rank catalog entries by how many query terms match their searchable metadata.
    query_tokens = tokenize(msg)
    stop_words = {"the", "a", "an", "is", "are", "do", "does", "can", "i", "me", "my", "you", "your", "for", "of", "to", "in", "on", "about", "book", "books", "find", "show", "want", "need", "have", "any", "please", "what", "which", "who", "available"}
    useful = query_tokens - stop_words
    ranked = []
    for book in all_books:
        searchable = " ".join(str(book.get(k) or "") for k in ("title", "author", "category", "isbn", "description"))
        tokens = tokenize(searchable)
        score = len(useful & tokens)
        if score:
            ranked.append((score, book))
    ranked.sort(key=lambda item: (-item[0], item[1]["title"].lower()))
    matches = [b for _, b in ranked[:5]]

    if any(word in lower for word in ["available", "borrow", "issue", "checkout", "copies", "in stock"]):
        if matches:
            available_matches = [b for b in matches if b["available"] > 0]
            unavailable = [b for b in matches if b["available"] == 0]
            if available_matches:
                names = ", ".join(f'{b["title"]} ({b["available"]} available)' for b in available_matches[:4])
                answer = f"Here are matching books that are currently available: {names}."
                if unavailable:
                    answer += " Some matching titles currently have no available copies."
            else:
                answer = "I found matching titles, but they currently have no available copies. Ask library staff about return dates."
            return {"answer": answer, "books": matches}
        return {"answer": "I couldn't match that to a title in the current catalog. Try the book title, author, or subject.", "books": []}

    if any(word in lower for word in ["recommend", "suggest", "what should", "beginner", "learn"]):
        if matches:
            return {"answer": "Based on your question, these catalog titles may be useful. Check each description and availability below.", "books": matches}
        return {"answer": "Tell me a subject you are interested in, such as programming, databases, AI, science, or productivity, and I'll suggest matching catalog titles.", "books": []}

    if matches:
        best_score = ranked[0][0]
        if best_score == 1 and len(useful) > 2:
            answer = "I found a few possible matches, but I'm not completely sure which you mean. Try a book title, author name, or subject."
        else:
            answer = f'I found {len(matches)} relevant title(s) in the library catalog. Here are the closest matches, including their descriptions and availability.'
        return {"answer": answer, "books": matches}

    categories = sorted({b["category"] for b in all_books})
    if any(word in lower for word in ["category", "subject", "subjects", "what do you have", "catalog"]):
        return {"answer": "The current catalog includes these subjects: " + ", ".join(categories) + ". Ask for a subject or a specific title to see matching books.", "books": []}
    return {"answer": "I couldn't find a confident match in the current catalog. Try a title, author, ISBN, or subject. I can answer using the books currently stored in this demo catalog.", "books": []}

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/admin")
def admin():
    return render_template("admin.html", logged_in=bool(session.get("admin")))

@app.get("/api/books")
def api_books():
    query = request.args.get("q", "")
    category = request.args.get("category", "")
    books = find_books(query, category)
    return jsonify({"books": books, "count": len(books)})

@app.get("/api/categories")
def api_categories():
    with get_db() as db:
        rows = db.execute("SELECT DISTINCT category FROM books ORDER BY category").fetchall()
    return jsonify({"categories": [r["category"] for r in rows]})

@app.post("/api/chat")
def api_chat():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", ""))[:1000]
    return jsonify(answer_question(message))

@app.get("/api/admin/session")
def admin_session():
    if session.get("admin"):
        return jsonify({"ok": True})
    return jsonify({"error": "Admin login required"}), 401

@app.post("/api/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    if data.get("password") and data["password"] == ADMIN_PASSWORD:
        session["admin"] = True
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Incorrect admin password"}), 401

@app.post("/api/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return jsonify({"ok": True})

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return jsonify({"error": "Admin login required"}), 401
        return fn(*args, **kwargs)
    return wrapper

@app.post("/api/admin/books")
@admin_required
def add_book():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    author = str(data.get("author", "")).strip()
    if not title or not author:
        return jsonify({"error": "Title and author are required"}), 400
    try:
        year = int(data["year"]) if data.get("year") else None
        copies = max(0, int(data.get("copies", 1)))
        available = max(0, min(copies, int(data.get("available", copies))))
    except (ValueError, TypeError):
        return jsonify({"error": "Year, copies, and available must be valid numbers"}), 400
    with get_db() as db:
        cur = db.execute("""INSERT INTO books
            (title, author, category, isbn, year, copies, available, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (title, author, str(data.get("category") or "General").strip(),
             str(data.get("isbn") or "").strip(), year, copies, available,
             str(data.get("description") or "").strip()))
        book_id = cur.lastrowid
    return jsonify({"ok": True, "id": book_id}), 201

@app.delete("/api/admin/books/<int:book_id>")
@admin_required
def delete_book(book_id):
    with get_db() as db:
        cur = db.execute("DELETE FROM books WHERE id = ?", (book_id,))
    if cur.rowcount == 0:
        return jsonify({"error": "Book not found"}), 404
    return jsonify({"ok": True})

@app.put("/api/admin/books/<int:book_id>/availability")
@admin_required
def update_availability(book_id):
    data = request.get_json(silent=True) or {}
    try:
        available = max(0, int(data.get("available")))
    except (ValueError, TypeError):
        return jsonify({"error": "Available must be a number"}), 400
    with get_db() as db:
        row = db.execute("SELECT copies FROM books WHERE id = ?", (book_id,)).fetchone()
        if not row:
            return jsonify({"error": "Book not found"}), 404
        available = min(available, row["copies"])
        db.execute("UPDATE books SET available = ? WHERE id = ?", (available, book_id))
    return jsonify({"ok": True, "available": available})

@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "college-library-chatbot"})

init_db()

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
            host="127.0.0.1", port=int(os.getenv("PORT", "5000")))
