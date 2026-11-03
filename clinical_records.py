"""SQL Server records shared by patient 8001 and clinic 8000 APIs."""
import json


def ensure_schema(cursor):
    cursor.execute("""
        IF OBJECT_ID(N'dbo.TCMWellnessAssessments', N'U') IS NULL
        CREATE TABLE dbo.TCMWellnessAssessments (
            PatientID INT NOT NULL PRIMARY KEY REFERENCES dbo.Patients(PatientID),
            AssessmentJSON NVARCHAR(MAX) NOT NULL,
            SubmittedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
        IF OBJECT_ID(N'dbo.TCMClinicalCarePlans', N'U') IS NULL
        CREATE TABLE dbo.TCMClinicalCarePlans (
            AppointmentID INT NOT NULL PRIMARY KEY REFERENCES dbo.Appointments(AppointmentID),
            DoctorCode NVARCHAR(128) NOT NULL,
            PlanStatus NVARCHAR(32) NOT NULL,
            NotesJSON NVARCHAR(MAX) NOT NULL,
            UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            PreparationStatus NVARCHAR(32) NOT NULL DEFAULT 'Pending',
            PreparationNotes NVARCHAR(2000) NOT NULL DEFAULT '',
            PreparedBy NVARCHAR(128) NULL,
            PreparedAt DATETIME2 NULL,
            DispensedAt DATETIME2 NULL
        );
    """)


def wellness_by_patient(cursor, patient_ids):
    if not patient_ids:
        return {}
    placeholders = ','.join('?' for _ in patient_ids)
    cursor.execute(f'''SELECT PatientID, AssessmentJSON, SubmittedAt FROM dbo.TCMWellnessAssessments
                     WHERE PatientID IN ({placeholders})''', tuple(patient_ids))
    return {int(row[0]): {**json.loads(row[1]), 'submitted': True,
                          'submittedAt': row[2].isoformat() if row[2] else ''}
            for row in cursor.fetchall()}


def plans_by_appointment(cursor, appointment_ids):
    if not appointment_ids:
        return []
    placeholders = ','.join('?' for _ in appointment_ids)
    cursor.execute(f'''SELECT AppointmentID, DoctorCode, PlanStatus, NotesJSON,
                     UpdatedAt, PreparationStatus, PreparationNotes, PreparedBy,
                     PreparedAt, DispensedAt FROM dbo.TCMClinicalCarePlans
                     WHERE AppointmentID IN ({placeholders})''', tuple(appointment_ids))
    return [{
        'id': f'CARE-SQL-{row[0]}', 'appointmentId': f'APT-SQL-{row[0]}',
        'doctorId': row[1], 'status': row[2], 'notes': json.loads(row[3]),
        'createdAt': row[4].isoformat() if row[4] else '',
        'preparationStatus': row[5], 'preparationNotes': row[6] or '',
        'preparedBy': row[7] or '',
        'preparedAt': row[8].isoformat() if row[8] else '',
        'dispensedAt': row[9].isoformat() if row[9] else ''
    } for row in cursor.fetchall()]
