import hashlib
import hmac
import json
import os
import re
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pyodbc

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent.parent
SQLSERVER_NAME = os.environ.get("TCM_SQLSERVER_SERVER", r"(localdb)\MSSQLLocalDB")
DATABASE_NAME = os.environ.get("TCM_SQLSERVER_DATABASE", "TcmSmartCare")
SESSION_COOKIE = "tcm_admin_session"
SESSION_HOURS = 8
PASSWORD_ITERATIONS = 310_000

app = FastAPI(title="TCM SmartCare Admin API")


class QueryResult:
    def __init__(self, cursor: pyodbc.Cursor):
        self.cursor = cursor

    def _row_as_dict(self, row: pyodbc.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        columns = [column[0] for column in self.cursor.description or []]
        return dict(zip(columns, row))

    def fetchone(self) -> dict[str, Any] | None:
        return self._row_as_dict(self.cursor.fetchone())

    def fetchall(self) -> list[dict[str, Any]]:
        return [self._row_as_dict(row) for row in self.cursor.fetchall() if row is not None]

    @property
    def rowcount(self) -> int:
        return self.cursor.rowcount


class DatabaseConnection:
    def __init__(self, connection: pyodbc.Connection):
        self.connection = connection

    def execute(self, sql: str, parameters: tuple[Any, ...] = ()) -> QueryResult:
        cursor = self.connection.cursor()
        cursor.execute(sql, parameters)
        return QueryResult(cursor)


def connection_string(database: str) -> str:
    drivers = pyodbc.drivers()
    driver = next(
        (name for name in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "SQL Server") if name in drivers),
        None,
    )
    if not driver:
        raise RuntimeError("Install Microsoft ODBC Driver 17 or 18 for SQL Server.")
    return (
        f"DRIVER={{{driver}}};SERVER={SQLSERVER_NAME};DATABASE={database};"
        "Trusted_Connection=yes;Encrypt=no;Connection Timeout=10;"
    )


@contextmanager
def connect(database: str = DATABASE_NAME, autocommit: bool = False):
    connection = pyodbc.connect(connection_string(database), autocommit=autocommit)
    try:
        yield DatabaseConnection(connection)
        if not autocommit:
            connection.commit()
    except Exception:
        if not autocommit:
            connection.rollback()
        raise
    finally:
        connection.close()


class DataPayload(BaseModel):
    data: dict[str, Any]


class LoginPayload(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class DemoLoginPayload(BaseModel):
    role: str


class PasswordPayload(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=8, max_length=1024)


def initialize_database() -> None:
    if not re.fullmatch(r"[A-Za-z0-9_]+", DATABASE_NAME):
        raise RuntimeError("TCM_SQLSERVER_DATABASE may contain only letters, numbers, and underscores.")
    with connect("master", autocommit=True) as connection:
        exists = connection.execute(
            "SELECT 1 FROM sys.databases WHERE name = ?", (DATABASE_NAME,)
        ).fetchone()
        if not exists:
            connection.execute(f"CREATE DATABASE [{DATABASE_NAME}]")

    with connect() as connection:
        connection.execute(
            """
            IF OBJECT_ID(N'dbo.admin_state', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.admin_state (
                    id INT NOT NULL PRIMARY KEY CHECK (id = 1),
                    data_json NVARCHAR(MAX) NOT NULL,
                    updated_at DATETIMEOFFSET(7) NOT NULL
                );
            END;
            IF OBJECT_ID(N'dbo.accounts', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.accounts (
                    id NVARCHAR(128) NOT NULL PRIMARY KEY,
                    role NVARCHAR(16) NOT NULL,
                    staff_id NVARCHAR(128) COLLATE Latin1_General_100_CI_AS NOT NULL UNIQUE,
                    email NVARCHAR(254) COLLATE Latin1_General_100_CI_AS NOT NULL UNIQUE,
                    password_salt VARBINARY(32) NOT NULL,
                    password_hash VARBINARY(64) NOT NULL
                );
            END;
            IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.sessions (
                    token_hash CHAR(64) NOT NULL PRIMARY KEY,
                    account_id NVARCHAR(128) NOT NULL,
                    expires_at DATETIMEOFFSET(7) NOT NULL,
                    CONSTRAINT FK_sessions_accounts FOREIGN KEY (account_id)
                        REFERENCES dbo.accounts(id) ON DELETE CASCADE
                );
            END;
            """
        )


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )


def set_password(connection: DatabaseConnection, account_id: str, password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Account passwords must be at least 8 characters.")
    salt = secrets.token_bytes(16)
    connection.execute(
        "UPDATE accounts SET password_salt = ?, password_hash = ? WHERE id = ?",
        (salt, password_digest(password, salt), account_id),
    )


def public_state(data: dict[str, Any]) -> dict[str, Any]:
    safe_data = json.loads(json.dumps(data))
    for key in ("staff", "doctors"):
        safe_data[key] = [
            {field: value for field, value in account.items() if field != "password"}
            for account in safe_data.get(key, [])
        ]
    return safe_data


def validate_state(data: dict[str, Any]) -> None:
    for key in (
        "staff", "doctors", "patients", "appointments", "schedules", "products",
        "orders", "messages", "carePlans", "feedback", "announcements",
    ):
        if key in data and not isinstance(data[key], list):
            raise HTTPException(status_code=422, detail=f"{key} must be a list.")
    if not isinstance(data.get("staff", []), list) or not isinstance(data.get("doctors", []), list):
        raise HTTPException(status_code=422, detail="Account lists are invalid.")

    seen_ids: set[str] = set()
    seen_emails: set[str] = set()
    seen_staff_ids: set[str] = set()
    for role, key in (("staff", "staff"), ("doctor", "doctors")):
        for account in data.get(key, []):
            if not isinstance(account, dict):
                raise HTTPException(status_code=422, detail="Account records must be objects.")
            account_id = str(account.get("id", "")).strip()
            staff_id = str(account.get("staffId", "")).strip()
            email = str(account.get("email", "")).strip().lower()
            if not account_id or not staff_id or not email or account.get("role") != role:
                raise HTTPException(status_code=422, detail="Account records require an ID, sign-in ID, email, and role.")
            if account_id in seen_ids or email in seen_emails or staff_id.lower() in seen_staff_ids:
                raise HTTPException(status_code=409, detail="Account IDs, sign-in IDs, and emails must be unique.")
            seen_ids.add(account_id)
            seen_emails.add(email)
            seen_staff_ids.add(staff_id.lower())


def save_state(connection: DatabaseConnection, data: dict[str, Any]) -> dict[str, Any]:
    validate_state(data)
    for role, key in (("staff", "staff"), ("doctor", "doctors")):
        for account in data.get(key, []):
            existing = connection.execute(
                "SELECT id FROM accounts WHERE id = ?", (account["id"],)
            ).fetchone()
            password = account.get("password")
            if not existing and not password:
                raise HTTPException(status_code=422, detail="New accounts require a temporary password.")

            if existing:
                connection.execute(
                    "UPDATE accounts SET role = ?, staff_id = ?, email = ? WHERE id = ?",
                    (role, account["staffId"], account["email"], account["id"]),
                )
            else:
                salt = secrets.token_bytes(16)
                connection.execute(
                    """
                    INSERT INTO accounts
                        (id, role, staff_id, email, password_salt, password_hash)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        account["id"], role, account["staffId"], account["email"],
                        salt, password_digest(str(password), salt),
                    ),
                )
            if existing and password:
                set_password(connection, account["id"], str(password))

    safe_data = public_state(data)
    serialized_data = json.dumps(safe_data, separators=(",", ":"))
    updated_at = datetime.now(timezone.utc)
    updated = connection.execute(
        "UPDATE admin_state SET data_json = ?, updated_at = ? WHERE id = 1",
        (serialized_data, updated_at),
    )
    if updated.rowcount == 0:
        connection.execute(
            "INSERT INTO admin_state (id, data_json, updated_at) VALUES (1, ?, ?)",
            (serialized_data, updated_at),
        )
    return safe_data


def find_session(request: Request, connection: DatabaseConnection) -> dict[str, Any] | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return connection.execute(
        """
        SELECT accounts.id, accounts.role, accounts.staff_id, accounts.email
        FROM sessions JOIN accounts ON accounts.id = sessions.account_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
        """,
        (token_hash, datetime.now(timezone.utc)),
    ).fetchone()


def require_account(request: Request, connection: DatabaseConnection) -> dict[str, Any]:
    account = find_session(request, connection)
    if not account:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return account


def account_from_state(data: dict[str, Any], account_id: str) -> dict[str, Any] | None:
    for key in ("staff", "doctors"):
        for account in data.get(key, []):
            if account.get("id") == account_id:
                return account
    return None


def new_session(connection: DatabaseConnection, account_id: str, response: Response) -> dict[str, str]:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)
    connection.execute(
        "INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)",
        (hashlib.sha256(token.encode("utf-8")).hexdigest(), account_id, expires),
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_HOURS * 60 * 60,
        httponly=True,
        secure=os.environ.get("TCM_COOKIE_SECURE", "false").lower() == "true",
        samesite="strict",
        path="/api",
    )
    return {"message": "Signed in."}


def current_user(connection: DatabaseConnection, account: dict[str, Any]) -> dict[str, str]:
    state_row = connection.execute("SELECT data_json FROM admin_state WHERE id = 1").fetchone()
    if not state_row:
        raise HTTPException(status_code=503, detail="Admin database has not been initialized.")
    account_data = account_from_state(json.loads(state_row["data_json"]), account["id"])
    if not account_data:
        raise HTTPException(status_code=401, detail="Account is no longer available.")
    return {
        "id": account["id"],
        "name": str(account_data.get("name", "")),
        "role": account["role"],
        "avatar": str(account_data.get("avatar", "")),
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/admin/data")
def get_admin_data(request: Request) -> dict[str, Any]:
    with connect() as connection:
        require_account(request, connection)
        row = connection.execute("SELECT data_json FROM admin_state WHERE id = 1").fetchone()
        if not row:
            raise HTTPException(status_code=503, detail="Admin database has not been initialized.")
        return {"data": json.loads(row["data_json"])}


@app.post("/api/admin/initialize")
def initialize_admin_data(payload: DataPayload) -> dict[str, Any]:
    with connect() as connection:
        if connection.execute("SELECT 1 FROM admin_state WHERE id = 1").fetchone():
            return {"initialized": True}
        save_state(connection, payload.data)
        return {"initialized": False}


@app.put("/api/admin/data")
def put_admin_data(payload: DataPayload, request: Request) -> dict[str, Any]:
    with connect() as connection:
        account = require_account(request, connection)
        state_row = connection.execute("SELECT data_json FROM admin_state WHERE id = 1").fetchone()
        if not state_row:
            raise HTTPException(status_code=503, detail="Admin database has not been initialized.")
        current = json.loads(state_row["data_json"])
        incoming = payload.data
        if account["role"] != "staff":
            allowed = {"appointments", "carePlans", "messages"}
            for key in set(current) | set(incoming):
                if key not in allowed and current.get(key) != incoming.get(key):
                    raise HTTPException(status_code=403, detail="Your account cannot change this admin data.")
            if incoming.get("staff") != current.get("staff"):
                raise HTTPException(status_code=403, detail="Your account cannot change staff accounts.")
            for key in ("staff", "doctors"):
                incoming_accounts = {item.get("id"): item for item in incoming.get(key, [])}
                current_accounts = {item.get("id"): item for item in current.get(key, [])}
                if incoming_accounts.keys() != current_accounts.keys():
                    raise HTTPException(status_code=403, detail="Your account cannot change clinic accounts.")
                for user_id, item in incoming_accounts.items():
                    if user_id != account["id"] and item != current_accounts[user_id]:
                        raise HTTPException(status_code=403, detail="Your account can only update your own profile.")
            if not account_from_state(incoming, account["id"]):
                raise HTTPException(status_code=403, detail="Your account is missing from the submitted data.")
            for key in ("staff", "doctors"):
                for item in incoming.get(key, []):
                    if "password" in item:
                        raise HTTPException(status_code=403, detail="Password changes must use the password endpoint.")

        data = save_state(connection, incoming)
        return {"data": data}


@app.post("/api/auth/login")
def login(payload: LoginPayload, response: Response) -> dict[str, Any]:
    with connect() as connection:
        value = payload.identifier.strip()
        account = connection.execute(
            """
            SELECT id, role, password_salt, password_hash FROM accounts
            WHERE email = ? OR staff_id = ?
            """,
            (value, value),
        ).fetchone()
        if not account or not hmac.compare_digest(
            password_digest(payload.password, account["password_salt"]),
            account["password_hash"],
        ):
            raise HTTPException(status_code=401, detail="Invalid ID/email or password.")
        user = current_user(connection, account)
        new_session(connection, account["id"], response)
        return {"user": user}


@app.post("/api/auth/demo")
def demo_login(payload: DemoLoginPayload, request: Request, response: Response) -> dict[str, Any]:
    if os.environ.get("TCM_ALLOW_DEMO_LOGIN", "true").lower() != "true":
        raise HTTPException(status_code=403, detail="Demo login is disabled.")
    if payload.role not in ("staff", "doctor"):
        raise HTTPException(status_code=422, detail="Choose a valid demo account.")
    with connect() as connection:
        state_row = connection.execute("SELECT data_json FROM admin_state WHERE id = 1").fetchone()
        if not state_row:
            raise HTTPException(status_code=503, detail="Admin database has not been initialized.")
        state = json.loads(state_row["data_json"])
        accounts = state.get("doctors" if payload.role == "doctor" else "staff", [])
        if not accounts:
            raise HTTPException(status_code=404, detail="No demo account is available for this role.")
        user = accounts[0]
        new_session(connection, user["id"], response)
        return {"user": current_user(connection, connection.execute(
            "SELECT id, role, staff_id, email FROM accounts WHERE id = ?", (user["id"],)
        ).fetchone())}


@app.get("/api/auth/me")
def me(request: Request) -> dict[str, Any]:
    with connect() as connection:
        account = require_account(request, connection)
        return {"user": current_user(connection, account)}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with connect() as connection:
            connection.execute(
                "DELETE FROM sessions WHERE token_hash = ?",
                (hashlib.sha256(token.encode("utf-8")).hexdigest(),),
            )
    response.delete_cookie(SESSION_COOKIE, path="/api", httponly=True, samesite="strict")
    return {"message": "Signed out."}


@app.put("/api/auth/password")
def change_password(payload: PasswordPayload, request: Request) -> dict[str, str]:
    with connect() as connection:
        account = require_account(request, connection)
        record = connection.execute(
            "SELECT password_salt, password_hash FROM accounts WHERE id = ?",
            (account["id"],),
        ).fetchone()
        if not hmac.compare_digest(
            password_digest(payload.current_password, record["password_salt"]),
            record["password_hash"],
        ):
            raise HTTPException(status_code=400, detail="Your current password is incorrect.")
        set_password(connection, account["id"], payload.new_password)
        return {"message": "Password updated."}


@app.get("/", include_in_schema=False)
def home() -> RedirectResponse:
    return RedirectResponse("/Admin/admin-login.html")


app.mount("/Admin", StaticFiles(directory=ROOT / "Admin"), name="admin")
app.mount("/User", StaticFiles(directory=ROOT / "User"), name="user")

initialize_database()
