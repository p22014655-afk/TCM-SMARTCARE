from datetime import date, datetime, time


def iso(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    return value


def fetch_dicts(cursor):
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def load_orders(connection, patient_id=None, order_id=None):
    cursor = connection.cursor()
    conditions = []
    params = []
    if patient_id is not None:
        conditions.append("o.PatientID = ?")
        params.append(patient_id)
    if order_id is not None:
        conditions.append("o.OrderID = ?")
        params.append(order_id)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    cursor.execute("""
        SELECT o.*, p.FullName AS CustomerName, p.Email AS CustomerEmail,
               p.Phone AS CustomerPhone
        FROM dbo.TCMCheckoutOrders o
        JOIN dbo.Patients p ON p.PatientID = o.PatientID
    """ + where + " ORDER BY o.OrderID DESC", *params)
    records = fetch_dicts(cursor)
    if not records:
        return []
    ids = [record["OrderID"] for record in records]
    marks = ",".join("?" for _ in ids)
    cursor.execute(f"""
        SELECT OrderID, ProductName, Quantity, UnitPrice
        FROM dbo.TCMCheckoutItems
        WHERE OrderID IN ({marks}) ORDER BY ItemID
    """, *ids)
    items = {id_: [] for id_ in ids}
    for row in fetch_dicts(cursor):
        items[row["OrderID"]].append({
            "name": row["ProductName"],
            "quantity": int(row["Quantity"]),
            "price": float(row["UnitPrice"])
        })
    cursor.execute(f"""
        SELECT EventID, OrderID, Status, Message, CreatedAt
        FROM dbo.TCMCheckoutEvents
        WHERE OrderID IN ({marks}) ORDER BY EventID
    """, *ids)
    events = {id_: [] for id_ in ids}
    for row in fetch_dicts(cursor):
        events[row["OrderID"]].append({
            "eventId": row["EventID"],
            "status": row["Status"],
            "message": row["Message"],
            "createdAt": iso(row["CreatedAt"])
        })
    result = []
    for row in records:
        pickup = None
        delivery = None
        if row["FulfillmentMethod"] == "pickup":
            pickup = {
                "date": iso(row["PickupDate"]),
                "time": iso(row["PickupTime"])
            }
        else:
            delivery = {
                "recipientName": row["RecipientName"],
                "phoneNumber": row["PhoneNumber"],
                "address": row["AddressLine"],
                "city": row["City"],
                "state": row["StateName"],
                "postcode": row["Postcode"],
                "notes": row["DeliveryNotes"]
            }
        id_ = int(row["OrderID"])
        result.append({
            "orderId": id_,
            "orderNumber": f"ORD-{id_:06d}",
            "trackingId": row["TrackingID"],
            "buyer": {
                "name": row["CustomerName"],
                "email": row["CustomerEmail"],
                "phone": row["CustomerPhone"]
            },
            "purchasedAt": iso(row["CreatedAt"]),
            "subtotal": float(row["Subtotal"]),
            "deliveryFee": float(row["DeliveryFee"]),
            "total": float(row["TotalAmount"]),
            "status": row["Status"],
            "paymentMethod": row["PaymentMethod"],
            "paymentStatus": row["PaymentStatus"],
            "bank": row["BankName"],
            "fulfillmentMethod": row["FulfillmentMethod"],
            "pickupInfo": pickup,
            "deliveryInfo": delivery,
            "completedAt": iso(row["CompletedAt"]),
            "courier": row["Courier"] or "",
            "items": items[id_],
            "events": events[id_]
        })
    return result
