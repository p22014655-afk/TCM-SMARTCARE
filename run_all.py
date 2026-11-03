import threading

from backend.app import app as admin_app, connect
from backend.appointment_expiry import expire_overdue_appointments
from user_backend.app import app as patient_app


class UnifiedApp:
    def __init__(self):
        self._lock = threading.Lock()
        self._started = False
        self._stop = threading.Event()

    def _expiry_loop(self):
        while not self._stop.is_set():
            try:
                with connect() as connection:
                    expire_overdue_appointments(connection)
            except Exception as error:
                print('Appointment expiry update failed:', repr(error))
            self._stop.wait(30)

    def _start_expiry(self):
        with self._lock:
            if self._started:
                return
            self._started = True
            threading.Thread(target=self._expiry_loop, daemon=True, name='tcm-appointment-expiry').start()

    async def __call__(self, scope, receive, send):
        self._start_expiry()
        path = scope.get('path', '')
        target = patient_app if path == '/api/user' or path.startswith('/api/user/') else admin_app
        await target(scope, receive, send)


app = UnifiedApp()
