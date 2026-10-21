# TCM SMARTCARE

## Run the admin portal with the Python backend

The admin portal uses FastAPI and Microsoft SQL Server LocalDB. The existing HTML/CSS/JavaScript pages are served by the Python app. On first startup, the backend creates the `TcmSmartCare` database and its tables in the `(localdb)\MSSQLLocalDB` instance if they do not exist.

1. Install Python 3.10 or newer, SQL Server LocalDB, and Microsoft ODBC Driver 17 or 18 for SQL Server.
2. Confirm the LocalDB instance is running:

   ```powershell
   sqllocaldb start MSSQLLocalDB
   ```

3. From the project root, install the backend dependencies:

   ```powershell
   python -m pip install -r backend/requirements.txt
   ```

4. Start the server:

   ```powershell
   python -m uvicorn backend.app:app --reload
   ```

5. Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The first visit initializes the SQL Server database from the browser's existing demo/local data. Then use the existing Staff ID/email and password login, or one of the demo-login options.

In SSMS, connect to `(localdb)\MSSQLLocalDB`, refresh **Databases**, and open `TcmSmartCare` to inspect the `admin_state`, `accounts`, and `sessions` tables.

The demo accounts are `staff@tcmsmartcare.com` / `Staff123!` and `lim@tcmsmartcare.com` / `Doctor123!`. The admin portal supports the existing dashboard, appointments, schedules, patients, care plans, products, orders, messages, feedback, announcements, analytics, account directory, profile, and password workflows.

Use `TCM_SQLSERVER_SERVER` to select a different SQL Server instance and `TCM_SQLSERVER_DATABASE` to choose the database name. The default connection uses Windows Authentication. Demo login is enabled by default for local development; set `TCM_ALLOW_DEMO_LOGIN=false` to disable the quick-login shortcuts. That setting does not change the seeded demo passwords, so change those from the profile screen before exposing the app. When serving over HTTPS, set `TCM_COOKIE_SECURE=true`.

The existing admin SQLite database, if present, is not automatically copied; the first SQL Server initialization imports the browser's current local demo data. This backend is a local-development integration, not a production-ready deployment for real patient records. Before deployment, use HTTPS, disable demo login, set up access controls appropriate to the clinic, protect and back up the database, and review applicable privacy and health-data requirements. The remaining user-facing pages continue to use their existing browser storage.
