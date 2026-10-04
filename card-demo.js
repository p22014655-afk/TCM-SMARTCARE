(() => {
    const pendingPaymentKey = "tcmPendingPayment";
    const cartKey = "tcmCart";
    const historyKey = "tcmPurchaseHistory";

    const form = document.getElementById("cardDemoForm");
    const button = document.getElementById("cardDemoButton");
    const status = document.getElementById("cardDemoStatus");
    const success = document.getElementById("cardDemoSuccess");

    let pendingPayment;

    try {
        pendingPayment = JSON.parse(
            sessionStorage.getItem(pendingPaymentKey) || "null"
        );
    } catch {
        pendingPayment = null;
    }

    if (!pendingPayment || pendingPayment.method !== "card") {
        document.querySelector(".card-demo-panel").innerHTML =
            '<h2>No card demo is in progress</h2><p><a href="payment.html">Return to payment options</a></p>';
        return;
    }

    document.getElementById("cardDemoTotal").textContent =
        `RM ${Number(pendingPayment.total).toFixed(2)}`;

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        status.textContent = "";
        button.disabled = true;
        button.textContent = "Saving demo order...";

        try {
            const profile = JSON.parse(
                localStorage.getItem("tcmPatientProfile") || "{}"
            );

            const order = {
                orderNumber: `DEMO-${Date.now()}`,
                buyer: {
                    name: profile.fullName ||
                        sessionStorage.getItem("tcmPatientName") ||
                        "Patient",
                    email: profile.email || ""
                },
                items: pendingPayment.items,
                total: Number(pendingPayment.total),
                paymentMethod: "Credit or Debit Card (Demo)",
                status: "Demo purchase — no money charged",
                purchasedAt: new Date().toISOString()
            };

            const history = JSON.parse(
                localStorage.getItem(historyKey) || "[]"
            );

            if (!Array.isArray(history)) {
                throw new Error("Purchase history data is invalid.");
            }

            history.push(order);
            localStorage.setItem(historyKey, JSON.stringify(history));
            localStorage.setItem("tcmLastOrder", JSON.stringify(order));
            localStorage.removeItem(cartKey);
            sessionStorage.removeItem(pendingPaymentKey);

            document.getElementById("cardDemoSuccessMessage").textContent =
                `Demo order ${order.orderNumber} was recorded. No real card was used and no payment was processed.`;

            form.hidden = true;
            success.hidden = false;
        } catch {
            status.textContent =
                "Could not save the demo order. Check browser storage and try again.";
            button.disabled = false;
            button.textContent = "Confirm payment";
        }
    });

    document.getElementById("menuButton")?.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
    });
})();