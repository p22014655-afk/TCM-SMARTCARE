(() => {
    const historyKey = "tcmPurchaseHistory";
    const historyList = document.getElementById("historyList");
    const historyEmpty = document.getElementById("historyEmpty");

    function readHistory() {
        try {
            const savedHistory = JSON.parse(localStorage.getItem(historyKey) || "[]");
            return Array.isArray(savedHistory) ? savedHistory : [];
        } catch {
            return [];
        }
    }

    function formatDate(dateValue) {
        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString([], {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function renderHistory() {
        const orders = readHistory().sort(
            (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)
        );

        historyList.replaceChildren();
        historyEmpty.hidden = orders.length > 0;

        orders.forEach((order) => {
            const card = document.createElement("article");
            card.className = "history-order";

            const header = document.createElement("div");
            header.className = "history-order-header";

            const orderInfo = document.createElement("div");

            const orderNumber = document.createElement("h3");
            orderNumber.textContent = `Order ${order.orderNumber || ""}`;

            const buyer = document.createElement("p");
            const buyerName = order.buyer?.name || "Patient";
            const buyerEmail = order.buyer?.email || "";
            buyer.textContent = buyerEmail
                ? `Buyer: ${buyerName} · ${buyerEmail}`
                : `Buyer: ${buyerName}`;

            const date = document.createElement("p");
            date.textContent = `Date: ${formatDate(order.purchasedAt)}`;

            orderInfo.append(orderNumber, buyer, date);

            const status = document.createElement("span");
            status.className = "history-order-status";
            status.textContent = order.status || "Demo purchase";

            header.append(orderInfo, status);

            const items = document.createElement("div");
            items.className = "history-items";

            (Array.isArray(order.items) ? order.items : []).forEach((item) => {
                const row = document.createElement("div");
                row.className = "history-item";

                const nameAndQuantity = document.createElement("span");

                const name = document.createElement("span");
                name.className = "history-item-name";
                name.textContent = item.name || "Product";

                const quantity = document.createElement("span");
                quantity.className = "history-item-quantity";
                quantity.textContent = `Quantity: ${Number(item.quantity) || 0}`;

                nameAndQuantity.append(name, quantity);

                const price = document.createElement("span");
                price.className = "history-item-price";
                price.textContent =
                    `RM ${(Number(item.price) * Number(item.quantity)).toFixed(2)}`;

                row.append(nameAndQuantity, price);
                items.append(row);
            });

            const footer = document.createElement("div");
            footer.className = "history-order-footer";

            const totalLabel = document.createElement("span");
            totalLabel.textContent = "Order total";

            const total = document.createElement("strong");
            total.textContent = `RM ${Number(order.total || 0).toFixed(2)}`;

            footer.append(totalLabel, total);

            const method = document.createElement("p");
            method.className = "history-payment-method";
            method.textContent = `Payment method: ${order.paymentMethod || "Not recorded"}`;

            card.append(header, items, footer, method);
            historyList.append(card);
        });
    }

    document.getElementById("menuButton")?.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
    });

    renderHistory();

    window.addEventListener("storage", (event) => {
        if (event.key === historyKey) {
            renderHistory();
        }
    });
})();