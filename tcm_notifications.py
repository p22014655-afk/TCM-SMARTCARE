import json
from fastapi import HTTPException

SCHEMA = r"""IF OBJECT_ID(N'dbo.TCMNotifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TCMNotifications (
        NotificationID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Audience NVARCHAR(12) NOT NULL,
        RecipientID NVARCHAR(128) NULL,
        Kind NVARCHAR(32) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Message NVARCHAR(1500) NOT NULL,
        TargetUrl NVARCHAR(512) NOT NULL,
        SourceKey NVARCHAR(150) NULL,
        CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_TCMNotifications_Audience CHECK (Audience IN (N'patient',N'doctor',N'staff'))
    );
END;
IF OBJECT_ID(N'dbo.TCMNotificationReads', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TCMNotificationReads (
        NotificationID BIGINT NOT NULL,
        ReaderID NVARCHAR(128) NOT NULL,
        ReadAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_TCMNotificationReads PRIMARY KEY (NotificationID,ReaderID),
        CONSTRAINT FK_TCMNotificationReads_Notification FOREIGN KEY (NotificationID)
            REFERENCES dbo.TCMNotifications(NotificationID) ON DELETE CASCADE
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TCMNotifications') AND name = N'IX_TCMNotifications_Inbox')
BEGIN
    CREATE INDEX IX_TCMNotifications_Inbox ON dbo.TCMNotifications (Audience, RecipientID, NotificationID DESC);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TCMNotifications') AND name = N'UX_TCMNotifications_Source')
BEGIN
    CREATE UNIQUE INDEX UX_TCMNotifications_Source ON dbo.TCMNotifications (Audience, RecipientID, SourceKey)
    WHERE SourceKey IS NOT NULL;
END;
"""


def ensure_tables(cursor):
    cursor.execute(SCHEMA)


def record(connection, audience, recipient_id, kind, title, message, url, source_key=None):
    cursor = connection.cursor()
    ensure_tables(cursor)
    recipient = str(recipient_id) if recipient_id is not None else None
    if source_key:
        cursor.execute("""SELECT NotificationID FROM dbo.TCMNotifications WITH (UPDLOCK,HOLDLOCK)
            WHERE Audience=? AND ((RecipientID=? ) OR (RecipientID IS NULL AND ? IS NULL))
            AND SourceKey=?""", audience, recipient, recipient, source_key)
        if cursor.fetchone():
            return
    cursor.execute("""INSERT INTO dbo.TCMNotifications
        (Audience,RecipientID,Kind,Title,Message,TargetUrl,SourceKey)
        VALUES (?,?,?,?,?,?,?)""", audience, recipient, kind, str(title)[:200],
        str(message)[:1500], url, source_key)


DEMO_ANNOUNCEMENT = {
    'id': 'ANN-001',
    'title': 'October clinic hours',
    'content': 'The clinic is open daily from 9:00 AM to 6:00 PM.',
    'publishDate': '2026-10-06'
}


def is_demo_announcement(item):
    return isinstance(item, dict) and all(
        str(item.get(key) or '').strip() == value
        for key, value in DEMO_ANNOUNCEMENT.items()
    )


def remove_demo_announcement(items):
    if not isinstance(items, list):
        return []
    return [item for item in items if not is_demo_announcement(item)]


def announcement_state(connection):
    cursor = connection.cursor()
    cursor.execute('SELECT data_json FROM dbo.admin_state WITH (UPDLOCK, HOLDLOCK) WHERE id=1')
    row = cursor.fetchone()
    if row is None:
        return []
    state = json.loads(row[0])
    current = state.get('announcements', [])
    if not isinstance(current, list):
        current = []
    cleaned = remove_demo_announcement(current)
    if len(cleaned) != len(current):
        state['announcements'] = cleaned
        cursor.execute('UPDATE dbo.admin_state SET data_json=?, updated_at=SYSDATETIMEOFFSET() WHERE id=1',
                       json.dumps(state, separators=(',', ':'), ensure_ascii=False))
    return cleaned


def reconcile_announcements(connection):
    current = announcement_state(connection)
    cursor = connection.cursor()
    ensure_tables(cursor)
    published = {}
    for item in current:
        if not isinstance(item, dict) or item.get('status') != 'Published':
            continue
        identifier = str(item.get('id') or '').strip()
        if not identifier:
            continue
        published['announcement:' + identifier] = (
            str(item.get('title') or 'Clinic announcement').strip()[:200],
            str(item.get('content') or 'A new clinic announcement has been published.').strip()[:1500]
        )
    cursor.execute('''SELECT NotificationID,Audience,SourceKey,Title,Message
        FROM dbo.TCMNotifications WITH (UPDLOCK,HOLDLOCK)
        WHERE Kind=N'announcement' AND Audience IN (N'patient',N'doctor')
        ORDER BY NotificationID DESC''')
    existing = cursor.fetchall()
    linked = set()
    for item in existing:
        notification_id, audience, source_key, title, message = item
        audience = str(audience)
        source_key = str(source_key) if source_key is not None else None
        link = '/User/notifications.html' if audience == 'patient' else '/Admin/admin-notifications.html'
        key = None
        if source_key and source_key.startswith('announcement:'):
            key = source_key if source_key in published else None
        elif source_key is None:
            matching = [ident for ident, info in published.items() if
                        info[0] == title and info[1] == message and (audience, ident) not in linked]
            if not matching:
                matching = [ident for ident, info in published.items() if
                            info[0] == title and (audience, ident) not in linked]
            if matching:
                key = matching[0]
        else:
            continue
        if key is None or (audience, key) in linked:
            cursor.execute('DELETE FROM dbo.TCMNotifications WHERE NotificationID=?', notification_id)
            continue
        linked.add((audience, key))
        expected_title, expected_message = published[key]
        if source_key != key or title != expected_title or message != expected_message:
            cursor.execute('''UPDATE dbo.TCMNotifications
                SET SourceKey=?,Title=?,Message=?,TargetUrl=? WHERE NotificationID=?''',
                key, expected_title, expected_message, link, notification_id)
    for key, (title, message) in published.items():
        for audience in ('patient', 'doctor'):
            if (audience, key) not in linked:
                link = '/User/notifications.html' if audience == 'patient' else '/Admin/admin-notifications.html'
                record(connection, audience, None, 'announcement', title, message, link, key)
    return current


def inbox(connection, audience, recipient_id, limit=150):
    reconcile_announcements(connection)
    cursor = connection.cursor()
    ensure_tables(cursor)
    recipient = str(recipient_id)
    cursor.execute("""SELECT TOP (?) n.NotificationID,n.Kind,n.Title,n.Message,n.TargetUrl,n.CreatedAt,
            CAST(CASE WHEN r.NotificationID IS NULL THEN 0 ELSE 1 END AS BIT) AS IsRead
        FROM dbo.TCMNotifications n
        LEFT JOIN dbo.TCMNotificationReads r ON r.NotificationID=n.NotificationID AND r.ReaderID=?
        WHERE n.Audience=? AND (n.RecipientID=? OR n.RecipientID IS NULL)
        ORDER BY n.NotificationID DESC""", limit, recipient, audience, recipient)
    data = [dict(id=int(row.NotificationID), kind=row.Kind, title=row.Title, message=row.Message,
                 url=row.TargetUrl, createdAt=row.CreatedAt.isoformat() if row.CreatedAt else '',
                 read=bool(row.IsRead)) for row in cursor.fetchall()]
    return {'notifications': data, 'unreadCount': sum(not item['read'] for item in data)}


def mark_read(connection, audience, recipient_id, notification_id=None):
    reconcile_announcements(connection)
    cursor = connection.cursor()
    ensure_tables(cursor)
    recipient = str(recipient_id)
    if notification_id is None:
        cursor.execute("""INSERT INTO dbo.TCMNotificationReads (NotificationID,ReaderID)
            SELECT n.NotificationID, ? FROM dbo.TCMNotifications n
            WHERE n.Audience=? AND (n.RecipientID=? OR n.RecipientID IS NULL)
              AND NOT EXISTS (SELECT 1 FROM dbo.TCMNotificationReads r
                WHERE r.NotificationID=n.NotificationID AND r.ReaderID=?)""",
            recipient, audience, recipient, recipient)
    else:
        cursor.execute("""INSERT INTO dbo.TCMNotificationReads (NotificationID,ReaderID)
            SELECT n.NotificationID, ? FROM dbo.TCMNotifications n
            WHERE n.NotificationID=? AND n.Audience=?
              AND (n.RecipientID=? OR n.RecipientID IS NULL)
              AND NOT EXISTS (SELECT 1 FROM dbo.TCMNotificationReads r
                WHERE r.NotificationID=n.NotificationID AND r.ReaderID=?)""",
            recipient, notification_id, audience, recipient, recipient)
        if cursor.rowcount != 1:
            cursor.execute("""SELECT n.NotificationID FROM dbo.TCMNotifications n
                WHERE n.NotificationID=? AND n.Audience=? AND (n.RecipientID=? OR n.RecipientID IS NULL)""",
                notification_id, audience, recipient)
            if not cursor.fetchone():
                raise HTTPException(404, 'Notification not found.')
    return {'ok': True}
