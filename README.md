# Campus Library Assistant — Full-Stack Project

A responsive college-library chatbot and book catalog built with **Flask (Python), SQLite, HTML, CSS, and vanilla JavaScript**. It runs locally and does not require a paid AI API key.

## Features

- Chat interface for finding titles, authors, subjects, and book availability.
- Catalog search and category filtering.
- Seeded sample catalog so the app works immediately.
- Admin sign-in, add-book form, availability updates, and book deletion.
- SQLite persistence.
- Responsive desktop/mobile layout.
- JSON REST API and a health endpoint.

## How the chatbot works

The starter version uses lightweight keyword matching against book titles, authors, categories, ISBNs, and descriptions. This makes it free to run and easy to understand, but it is **not an LLM** and can misunderstand complex questions. It only knows books stored in the local database. You can later replace `answer_question()` in `app.py` with an LLM + retrieval-augmented generation (RAG) pipeline.

## Requirements

- Python 3.10+
- pip

## Run locally

### 1. Create a virtual environment

Windows PowerShell:
```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
```

macOS/Linux:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install packages

```bash
pip install -r requirements.txt
```

### 3. Configure secrets

Copy `.env.example` to `.env`. Change `SECRET_KEY` and `ADMIN_PASSWORD`.

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

macOS/Linux:
```bash
cp .env.example .env
```

### 4. Start the app

```bash
python app.py
```

Open http://127.0.0.1:5000 in your browser. Open `/admin` to manage the catalog.

The SQLite database (`library.db`) is created automatically with sample books on first run.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/books?q=clean&category=Programming` | Search books |
| GET | `/api/categories` | List categories |
| POST | `/api/chat` | Ask the chatbot; JSON body: `{"message":"..."}` |
| POST | `/api/admin/login` | Admin login; JSON body: `{"password":"..."}` |
| POST | `/api/admin/logout` | Log out |
| POST | `/api/admin/books` | Add a book (admin session required) |
| PUT | `/api/admin/books/<id>/availability` | Update available copies |
| DELETE | `/api/admin/books/<id>` | Delete a book |

Example chat request:
```bash
curl -X POST http://127.0.0.1:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Which programming books are available?"}'
```

## Project structure

```text
college_library_chatbot/
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── templates/
│   ├── index.html
│   └── admin.html
└── static/
    ├── styles.css
    ├── app.js
    └── admin.js
```

## Important before deployment

- Set a strong `SECRET_KEY` and `ADMIN_PASSWORD`.
- Use HTTPS and a production WSGI server (for example, Gunicorn) instead of Flask's development server.
- Add CSRF protection, login rate limiting, backups, and institutional authentication before exposing the admin interface publicly.
- Replace the sample data with the college's real catalog and confirm that circulation/availability data is current.
- Never enter real student records into this demo.

## Notes

The app is a complete runnable starter project, not connected to a college's actual library management system. Sample availability is illustrative. A real deployment needs catalog/circulation integration and a clearly defined data source.
