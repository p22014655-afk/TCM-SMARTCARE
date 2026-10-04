(() => {
    const pendingPaymentKey = "tcmPendingPayment";
    const cartKey = "tcmCart";
    const historyKey = "tcmPurchaseHistory";

    const approvalCard = document.getElementById("approvalCard");
    const successCard = document.getElementById("successCard");
    const approveButton = document.getElementById("approveButton");

    const methodNames = {
        fpx: "Online Banking (FPX)",
        card: "Credit or Debit Card",
        "tng-ewallet": "Touch ’n Go eWallet"
    };

    let pendingPayment;

    try {
        pendingPayment = JSON.parse(
            sessionStorage.getItem(pendingPaymentKey) || "null"
        );
    } catch {
        pendingPayment = null;
    }

    if (!pendingPayment || !Array.isArray(pendingPayment.items)) {
        document.getElementById("paymentTitle").textContent =
            "No pending payment";
        document.getElementById("paymentDescription").textContent =
            "Return to your cart and start checkout again.";
        document.getElementById("demoWarning").textContent = "";
        approveButton.hidden = true;
        return;
    }

    const methodName = methodNames[pendingPayment.method] || "Demo payment";
    const selectedBank = pendingPayment.bank
        ? ` — ${pendingPayment.bank.replaceAll("_", " ")}`
        : "";

    document.getElementById("pageTitle").textContent = methodName;
    document.getElementById("paymentTitle").textContent =
        `Review ${methodName}${selectedBank}`;
    document.getElementById("paymentDescription").textContent =
        "This page simulates the approval step for a checkout demonstration.";
    document.getElementById("demoTotal").textContent =
        `RM ${Number(pendingPayment.total).toFixed(2)}`;
    document.getElementById("demoWarning").textContent =
        "Demo only. No bank or eWallet credentials are requested or processed.";

    approveButton.addEventListener("click", () => {
        approveButton.disabled = true;
        approveButton.textContent = "Saving demo order...";

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
                paymentMethod: methodName,
                bank: pendingPayment.bank || null,
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

            document.getElementById("successText").textContent =
                `Demo order ${order.orderNumber} was recorded. No real payment was made.`;

            approvalCard.hidden = true;
            successCard.hidden = false;
        } catch {
            approveButton.disabled = false;
            approveButton.textContent = "Approve demo payment";
            document.getElementById("demoWarning").textContent =
                "Could not save the demo order. Check browser storage and try again.";
        }
    });

    document.getElementById("menuButton")?.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
    });
})();