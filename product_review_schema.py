from fastapi import HTTPException


def ensure_product_review_schema(connection):
    cursor = connection.cursor()
    cursor.execute("SELECT OBJECT_ID(N'dbo.Patients', N'U')")
    if cursor.fetchone()[0] is None:
        raise HTTPException(503, "The dbo.Patients table is missing from TCM_SmartCare. Set up the patient database first.")

    cursor.execute("SELECT OBJECT_ID(N'dbo.TCMProductReviews', N'U')")
    changed = False
    if cursor.fetchone()[0] is None:
        cursor.execute("""
            CREATE TABLE dbo.TCMProductReviews (
                ReviewID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                OrderID INT NOT NULL,
                PatientID INT NOT NULL,
                ProductName NVARCHAR(150) NOT NULL,
                InventoryProductID NVARCHAR(128) NULL,
                Rating INT NOT NULL,
                Comment NVARCHAR(MAX) NOT NULL,
                CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
                IsHidden BIT NOT NULL DEFAULT 0,
                EditedByStaffAt DATETIME2(0) NULL,
                ModeratedAt DATETIME2(0) NULL,
                ModeratedBy NVARCHAR(128) NULL,
                IsFeatured BIT NOT NULL DEFAULT 0,
                StaffReply NVARCHAR(2000) NULL,
                StaffRepliedAt DATETIME2(0) NULL
            )
        """)
        changed = True

    fields = {
        "InventoryProductID": "NVARCHAR(128) NULL",
        "CreatedAt": "DATETIME2(0) NOT NULL DEFAULT SYSDATETIME() WITH VALUES",
        "IsHidden": "BIT NOT NULL DEFAULT 0 WITH VALUES",
        "EditedByStaffAt": "DATETIME2(0) NULL",
        "ModeratedAt": "DATETIME2(0) NULL",
        "ModeratedBy": "NVARCHAR(128) NULL",
        "IsFeatured": "BIT NOT NULL DEFAULT 0 WITH VALUES",
        "StaffReply": "NVARCHAR(2000) NULL",
        "StaffRepliedAt": "DATETIME2(0) NULL"
    }
    for name, definition in fields.items():
        cursor.execute("SELECT COL_LENGTH(N'dbo.TCMProductReviews', ?)", name)
        if cursor.fetchone()[0] is None:
            cursor.execute(f"ALTER TABLE dbo.TCMProductReviews ADD [{name}] {definition}")
            changed = True

    cursor.execute("SELECT OBJECT_ID(N'dbo.TCMReviewModerationLog', N'U')")
    if cursor.fetchone()[0] is None:
        cursor.execute("""
            CREATE TABLE dbo.TCMReviewModerationLog (
                LogID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                ReviewID INT NOT NULL,
                ActionName NVARCHAR(32) NOT NULL,
                StaffAccountID NVARCHAR(128) NOT NULL,
                OldRating INT NULL,
                NewRating INT NULL,
                OldComment NVARCHAR(MAX) NULL,
                NewComment NVARCHAR(MAX) NULL,
                CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
            )
        """)
        changed = True

    audit_fields = {
        "ReviewID": "INT NULL",
        "ActionName": "NVARCHAR(32) NULL",
        "StaffAccountID": "NVARCHAR(128) NULL",
        "OldRating": "INT NULL",
        "NewRating": "INT NULL",
        "OldComment": "NVARCHAR(MAX) NULL",
        "NewComment": "NVARCHAR(MAX) NULL",
        "CreatedAt": "DATETIME2(0) NOT NULL DEFAULT SYSDATETIME() WITH VALUES"
    }
    for name, definition in audit_fields.items():
        cursor.execute("SELECT COL_LENGTH(N'dbo.TCMReviewModerationLog', ?)", name)
        if cursor.fetchone()[0] is None:
            cursor.execute(f"ALTER TABLE dbo.TCMReviewModerationLog ADD [{name}] {definition}")
            changed = True

    if changed:
        connection.commit()
