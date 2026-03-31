# DigiCrave Backend — Local Setup Guide

## Prerequisites

| Tool       | Min Version | Check             |
|------------|-------------|-------------------|
| Python     | 3.10+       | `python --version`|
| PostgreSQL | 14+         | `psql --version`  |
| Redis      | 6+          | `redis-cli ping`  |

---

## Step 1 — Install PostgreSQL (if not installed)

### Option A: Native installer
Download from https://www.postgresql.org/download/windows/ and install.  
Default port: `5432`, remember the password you set for user `postgres`.

### Option B: Using Chocolatey
```bash
choco install postgresql
```

After install, verify it's running:
```bash
psql -U postgres -c "SELECT version();"
```

---

## Step 2 — Create the database

```bash
psql -U postgres
```
```sql
CREATE DATABASE digicrave;
\q
```

---

## Step 3 — Install Redis (if not installed)

### Option A: Memurai (Redis-compatible for Windows)
Download from https://www.memurai.com/get-memurai — installs as a Windows service.

### Option B: WSL
```bash
wsl --install
# Inside WSL:
sudo apt install redis-server
sudo service redis-server start
```

### Option C: Docker (if you have Docker Desktop)
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

Verify:
```bash
redis-cli ping
# Should return: PONG
```

---

## Step 4 — Python virtual environment

```bash
cd c:\Antigravity\digicrave\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

> **Note:** `requirements.txt` needs both `asyncpg` (for the app) and `psycopg2-binary` (for Alembic migrations). If either is missing, run:
> ```bash
> pip install asyncpg psycopg2-binary
> ```

---

## Step 5 — Create `.env` file

Create `c:\Antigravity\digicrave\backend\.env`:

```env
# Database — adjust user/password to match your PostgreSQL setup
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/digicrave

# JWT Secret — generate a random one:
#   python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AES Encryption Key — exactly 32 characters:
#   python -c "import secrets; print(secrets.token_hex(16))"
AES_ENCRYPTION_KEY=CHANGE_ME_TO_32_CHAR_STRING_HERE

# Redis
REDIS_URL=redis://localhost:6379/0

# Razorpay (optional for dev — payments won't work without these)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# MSG91 (optional — OTP prints to console without this)
MSG91_AUTH_KEY=
```

### Generate your secrets quickly:
```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('AES_ENCRYPTION_KEY=' + secrets.token_hex(16))"
```

---

## Step 6 — Run database migrations

```bash
cd c:\Antigravity\digicrave\backend
venv\Scripts\activate
alembic upgrade head
```

This creates all tables: restaurants, staff, customers, menu_items, orders, etc.

---

## Step 7 — Start the backend

```bash
cd c:\Antigravity\digicrave\backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
[DigiCrave] SLA Monitor started ✅
```

---

## Step 8 — Verify it works

### Health check
Open in browser or curl:
```
http://localhost:8000/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "db": "up",
    "redis": "up",
    "workers": "no_workers",
    "aggregators": "not_configured",
    "sla_monitor": "running"
  }
}
```

- `db: up` + `redis: up` = you're good to go ✅
- `workers: no_workers` is fine (Celery is optional for dev)

### API docs (auto-generated)
```
http://localhost:8000/docs
```
This gives you interactive Swagger UI to test all endpoints.

---

## Step 9 — Start the frontend

In a **separate terminal**:
```bash
cd c:\Antigravity\digicrave\frontend
npm run dev
```

Open `http://localhost:3000` — it should connect to the backend at `:8000`.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError: No module named 'asyncpg'` | `pip install asyncpg` |
| `ModuleNotFoundError: No module named 'psycopg2'` | `pip install psycopg2-binary` |
| Alembic: `FATAL: password authentication failed` | Check `DATABASE_URL` password in `.env` |
| Alembic: `FATAL: database "digicrave" does not exist` | Run `psql -U postgres -c "CREATE DATABASE digicrave;"` |
| `ConnectionRefusedError` on Redis | Start Redis/Memurai service |
| `ValidationError: SECRET_KEY field required` | Make sure `.env` file is in the `backend/` directory |
| CORS errors from frontend | Backend already allows `localhost:3000` in `main.py` |

---

## Optional: Start Celery worker (for background tasks)

Only needed if you want WhatsApp OTP delivery via MSG91:
```bash
cd c:\Antigravity\digicrave\backend
venv\Scripts\activate
celery -A app.core.celery_app worker --loglevel=info --pool=solo
```
