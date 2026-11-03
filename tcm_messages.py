import json
import re
from datetime import datetime, timezone

from fastapi import HTTPException


def ensure_schema(cursor):
    cursor.execute("""
        IF OBJECT_ID(N'dbo.TCMChatMessages', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TCMChatMessages (
                MessageID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                ThreadKind NVARCHAR(20) NOT NULL,
                PatientID INT NULL,
                DoctorCode NVARCHAR(128) NULL,
                SenderRole NVARCHAR(12) NOT NULL,
                Body NVARCHAR(1000) NOT NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                ReadAt DATETIME2 NULL,
                CONSTRAINT CK_TCMChatMessages_Thread CHECK (
                    (ThreadKind = N'support' AND PatientID IS NOT NULL AND DoctorCode IS NULL)
                    OR (ThreadKind = N'patient_doctor' AND PatientID IS NOT NULL AND DoctorCode IS NOT NULL)
                    OR (ThreadKind = N'staff_doctor' AND PatientID IS NULL AND DoctorCode IS NOT NULL)
                ),
                CONSTRAINT CK_TCMChatMessages_Sender CHECK (SenderRole IN (N'patient', N'staff', N'doctor'))
            );
            CREATE INDEX IX_TCMChatMessages_Thread ON dbo.TCMChatMessages
                (ThreadKind, PatientID, DoctorCode, MessageID DESC);
        END
    """)


def doctor_name(cursor, code):
    cursor.execute("""
        SELECT TOP 1 d.FullName FROM dbo.Doctors d
        JOIN dbo.accounts ac ON ac.id = d.DoctorCode AND ac.role = 'doctor'
        WHERE d.DoctorCode = ?
    """, code)
    row = cursor.fetchone()
    return str(row[0]) if row else None


def completed_doctor(cursor, patient_id, code):
    cursor.execute("""
        SELECT TOP 1 1 FROM dbo.Appointments a
        JOIN dbo.Doctors d ON d.DoctorID = a.DoctorID
        WHERE a.PatientID = ? AND d.DoctorCode = ? AND a.Status = 'Completed'
    """, patient_id, code)
    return bool(cursor.fetchone())


def patient_name(cursor, patient_id):
    cursor.execute("SELECT TOP 1 FullName FROM dbo.Patients WHERE PatientID = ?", patient_id)
    row = cursor.fetchone()
    return str(row[0]) if row else None


def available_doctors(cursor, patient_id):
    cursor.execute("""
        SELECT DISTINCT d.DoctorCode, d.FullName
        FROM dbo.Appointments a JOIN dbo.Doctors d ON d.DoctorID = a.DoctorID
        JOIN dbo.accounts ac ON ac.id = d.DoctorCode AND ac.role = 'doctor'
        WHERE a.PatientID = ? AND a.Status = 'Completed'
        ORDER BY d.FullName
    """, patient_id)
    return [(str(row[0]), str(row[1])) for row in cursor.fetchall()]


def all_doctors(cursor):
    cursor.execute("""
        SELECT d.DoctorCode, d.FullName FROM dbo.Doctors d
        JOIN dbo.accounts ac ON ac.id = d.DoctorCode AND ac.role = 'doctor'
        ORDER BY d.FullName
    """)
    return [(str(row[0]), str(row[1])) for row in cursor.fetchall()]


def relevant_patients(cursor, doctor_code):
    cursor.execute("""
        SELECT DISTINCT p.PatientID, p.FullName FROM dbo.Patients p
        JOIN dbo.Appointments a ON a.PatientID = p.PatientID
        JOIN dbo.Doctors d ON a.DoctorID = d.DoctorID
        WHERE d.DoctorCode = ? AND a.Status = 'Completed'
        ORDER BY p.FullName
    """, doctor_code)
    return [(int(row[0]), str(row[1])) for row in cursor.fetchall()]


def support_patients(cursor):
    cursor.execute("""
        SELECT p.PatientID, p.FullName FROM dbo.Patients p
        WHERE EXISTS (SELECT 1 FROM dbo.TCMChatMessages m
            WHERE m.ThreadKind = 'support' AND m.PatientID = p.PatientID)
        ORDER BY p.FullName
    """)
    return [(int(row[0]), str(row[1])) for row in cursor.fetchall()]


def validate_thread(cursor, role, owner_id, thread_id):
    if role not in ('patient', 'staff', 'doctor'):
        raise HTTPException(403, 'This account cannot use clinic messaging.')
    if role == 'patient':
        if thread_id == 'care-team':
            return ('support', int(owner_id), None, 'Care Team', 'Clinic support staff')
        if thread_id.startswith('doctor-'):
            code = thread_id[7:]
            name = doctor_name(cursor, code)
            if not name or not completed_doctor(cursor, int(owner_id), code):
                raise HTTPException(403, 'Doctor messages are available only after a completed appointment with this doctor.')
            return ('patient_doctor', int(owner_id), code, name, 'Doctor')
    elif role == 'staff':
        if thread_id.startswith('patient-') and thread_id[8:].isdigit():
            pid = int(thread_id[8:])
            name = patient_name(cursor, pid)
            if name:
                return ('support', pid, None, name, 'Patient support')
        if thread_id.startswith('doctor-'):
            code = thread_id[7:]
            name = doctor_name(cursor, code)
            if name:
                return ('staff_doctor', None, code, name, 'Doctor collaboration')
    elif role == 'doctor':
        if thread_id == 'care-team':
            return ('staff_doctor', None, str(owner_id), 'Care Team', 'Clinic staff')
        if thread_id.startswith('patient-') and thread_id[8:].isdigit():
            pid = int(thread_id[8:])
            name = patient_name(cursor, pid)
            if name and completed_doctor(cursor, pid, str(owner_id)):
                return ('patient_doctor', pid, str(owner_id), name, 'Patient')
    raise HTTPException(403, 'This conversation is not available to your account.')


def thread_condition(kind, patient_id, doctor_code):
    if kind == 'support':
        return "ThreadKind = 'support' AND PatientID = ?", (patient_id,)
    if kind == 'patient_doctor':
        return "ThreadKind = 'patient_doctor' AND PatientID = ? AND DoctorCode = ?", (patient_id, doctor_code)
    return "ThreadKind = 'staff_doctor' AND DoctorCode = ?", (doctor_code,)


def recipient_role(kind, role):
    if kind == 'support':
        return 'staff' if role == 'patient' else 'patient'
    if kind == 'patient_doctor':
        return 'doctor' if role == 'patient' else 'patient'
    return 'doctor' if role == 'staff' else 'staff'


def safe_profile_photo(value):
    image = str(value or "")
    if len(image) > 1000000:
        return ""
    if re.fullmatch(r"data:image/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+", image):
        return image
    return ""


def thread_profile_photos(cursor, candidates):
    result = {}
    needs_clinic = any(thread_id == 'care-team' or thread_id.startswith('doctor-') for thread_id, _, _ in candidates)
    if needs_clinic:
        try:
            cursor.execute("SELECT TOP 1 data_json FROM dbo.admin_state WHERE id = 1")
            row = cursor.fetchone()
            data = json.loads(row[0]) if row and row[0] else {}
            for doctor in data.get('doctors', []):
                result['doctor-' + str(doctor.get('id'))] = safe_profile_photo(doctor.get('profilePicture'))
            staff = data.get('staff', [])
            team = next((item for item in staff if item.get('id') == 'staff-frontdesk'), None)
            if not team and staff:
                team = staff[0]
            result['care-team'] = safe_profile_photo((team or {}).get('profilePicture'))
        except (ValueError, TypeError, KeyError):
            pass
    patient_ids = sorted({int(thread_id[8:]) for thread_id, _, _ in candidates
                          if thread_id.startswith('patient-') and thread_id[8:].isdigit()})
    if patient_ids:
        cursor.execute("SELECT OBJECT_ID(N'dbo.TCMPatientProfileDetails', N'U')")
        table = cursor.fetchone()
        if table and table[0] is not None:
            args = ','.join('?' for _ in patient_ids)
            cursor.execute('SELECT PatientID, Photo FROM dbo.TCMPatientProfileDetails WHERE PatientID IN (' + args + ')', *patient_ids)
            for row in cursor.fetchall():
                result['patient-' + str(row[0])] = safe_profile_photo(row[1])
    return result


def list_threads(cursor, role, owner_id):
    if role not in ('patient', 'staff', 'doctor'):
        raise HTTPException(403, 'This account cannot use clinic messaging.')
    if role == 'patient':
        candidates = [('care-team', 'Care Team', 'Clinic support staff')]
        candidates += [('doctor-' + code, name, 'Available after completed appointment')
                       for code, name in available_doctors(cursor, int(owner_id))]
    elif role == 'staff':
        candidates = [('patient-' + str(pid), name, 'Patient support')
                      for pid, name in support_patients(cursor)]
        candidates += [('doctor-' + code, name, 'Doctor collaboration')
                       for code, name in all_doctors(cursor)]
    else:
        candidates = [('care-team', 'Care Team', 'Clinic staff')]
        candidates += [('patient-' + str(pid), name, 'Patient')
                       for pid, name in relevant_patients(cursor, str(owner_id))]
    photos = thread_profile_photos(cursor, candidates)
    threads = []
    for thread_id, name, subtitle in candidates:
        kind, pid, code, _, _ = validate_thread(cursor, role, owner_id, thread_id)
        where, params = thread_condition(kind, pid, code)
        cursor.execute('SELECT TOP 1 Body, CreatedAt FROM dbo.TCMChatMessages WHERE ' + where + ' ORDER BY MessageID DESC', *params)
        last = cursor.fetchone()
        cursor.execute('SELECT COUNT(*) FROM dbo.TCMChatMessages WHERE ' + where +
                       ' AND SenderRole = ? AND ReadAt IS NULL', *(params + (recipient_role(kind, role),)))
        unread = int(cursor.fetchone()[0])
        threads.append({'id': thread_id, 'name': name, 'subtitle': subtitle,
                        'photo': photos.get(thread_id, ''),
                        'lastMessage': str(last[0]) if last else '',
                        'lastAt': last[1].isoformat() + 'Z' if last else '',
                        'unread': unread})
    threads.sort(key=lambda thread: (thread['id'] != 'care-team' if role in ('patient', 'doctor') else False,
                                    not bool(thread['lastAt']), thread['lastAt'] or ''), reverse=False)
    return {'threads': threads}


def read_thread(cursor, role, owner_id, thread_id):
    kind, pid, code, name, subtitle = validate_thread(cursor, role, owner_id, thread_id)
    where, params = thread_condition(kind, pid, code)
    photos = thread_profile_photos(cursor, [(thread_id, name, subtitle)])
    cursor.execute('UPDATE dbo.TCMChatMessages SET ReadAt = SYSUTCDATETIME() WHERE ' + where +
                   ' AND SenderRole = ? AND ReadAt IS NULL', *(params + (recipient_role(kind, role),)))
    cursor.execute('''SELECT MessageID, SenderRole, Body, CreatedAt FROM
                   (SELECT TOP 300 MessageID, SenderRole, Body, CreatedAt
                    FROM dbo.TCMChatMessages WHERE ''' + where +
                   ' ORDER BY MessageID DESC) recent ORDER BY MessageID', *params)
    result = [{'id': int(row[0]), 'from': row[1], 'text': str(row[2]),
               'createdAt': row[3].isoformat() + 'Z'} for row in cursor.fetchall()]
    return {'id': thread_id, 'name': name, 'subtitle': subtitle,
            'photo': photos.get(thread_id, ''), 'messages': result}


def send_message(cursor, role, owner_id, thread_id, content):
    kind, pid, code, _, _ = validate_thread(cursor, role, owner_id, thread_id)
    content = str(content).strip()
    if not content or len(content) > 1000:
        raise HTTPException(422, 'Messages must contain 1 to 1000 characters.')
    cursor.execute('''INSERT INTO dbo.TCMChatMessages (ThreadKind, PatientID, DoctorCode, SenderRole, Body)
                   OUTPUT INSERTED.MessageID VALUES (?, ?, ?, ?, ?)''',
                   kind, pid, code, role, content)
    row = cursor.fetchone()
    return {'id': int(row[0]), 'sent': True}
