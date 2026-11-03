from decimal import Decimal

from fastapi import HTTPException


def available(connection):
    cursor = connection.cursor()
    cursor.execute("SELECT OBJECT_ID(N'dbo.TCMInventoryProducts', N'U')")
    return cursor.fetchone()[0] is not None


def require_inventory(connection):
    if not available(connection):
        raise HTTPException(503, "Run setup_inventory.sql in TCM_SmartCare first.")


def all_products(connection, active_only=False):
    require_inventory(connection)
    cursor = connection.cursor()
    sql = """
        SELECT ProductID, ProductName, Category, Description, Ingredients,
               Instructions, Precautions, Price, Stock, LowStockThreshold,
               ImageData, Status, UpdatedAt
        FROM dbo.TCMInventoryProducts
    """
    if active_only:
        sql += " WHERE Status = N'Active'"
    sql += " ORDER BY ProductName"
    cursor.execute(sql)
    products = []
    for row in cursor.fetchall():
        products.append({
            "id": row.ProductID,
            "name": row.ProductName,
            "category": row.Category,
            "description": row.Description,
            "ingredients": row.Ingredients,
            "instructions": row.Instructions,
            "precautions": row.Precautions,
            "price": float(row.Price),
            "stock": int(row.Stock),
            "lowStockThreshold": int(row.LowStockThreshold),
            "image": row.ImageData,
            "status": row.Status,
            "updatedAt": row.UpdatedAt.date().isoformat() if row.UpdatedAt else ""
        })
    return products


def shop_products(connection):
    products = all_products(connection, active_only=True)
    return [{
        "id": p["id"],
        "name": p["name"],
        "category": p["category"],
        "description": p["description"],
        "ingredients": p["ingredients"],
        "instructions": p["instructions"],
        "precautions": p["precautions"],
        "image": p["image"],
        "price": p["price"],
        "stock": p["stock"],
        "available": p["stock"] > 0
    } for p in products]


def reserve_products(cursor, items):
    selected = []
    subtotal = Decimal("0.00")
    for item in sorted(items, key=lambda value: value.name.strip().casefold()):
        name = item.name.strip()
        cursor.execute("""
            SELECT ProductID, ProductName, Price, Stock, Status
            FROM dbo.TCMInventoryProducts WITH (UPDLOCK, HOLDLOCK)
            WHERE ProductName = ?
        """, name)
        row = cursor.fetchone()
        if row is None or row.Status != "Active":
            raise HTTPException(409, f"Product unavailable: {name}")
        if int(row.Stock) < int(item.quantity):
            raise HTTPException(409, f"Insufficient stock for {name}. Available: {row.Stock}.")
        selected.append({
            "id": row.ProductID,
            "name": row.ProductName,
            "quantity": int(item.quantity),
            "price": Decimal(str(row.Price))
        })
        subtotal += Decimal(str(row.Price)) * int(item.quantity)
    return selected, subtotal


def deduct_products(cursor, selected):
    for item in selected:
        cursor.execute("""
            UPDATE dbo.TCMInventoryProducts
            SET Stock = Stock - ?, UpdatedAt = SYSDATETIME()
            WHERE ProductID = ? AND Status = N'Active' AND Stock >= ?
        """, item["quantity"], item["id"], item["quantity"])
        if cursor.rowcount != 1:
            raise HTTPException(409, f"Insufficient stock for {item['name']}.")
