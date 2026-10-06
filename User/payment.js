(() => {
    const cartKey = "tcmCart";
    const pendingPaymentKey = "tcmPendingPayment";

    const paymentForm = document.getElementById("paymentForm");
    const bankField = document.getElementById("bankField");
    const bankSelect = document.getElementById("bankSelect");
    const paymentStatus = document.getElementById("paymentStatus");
    const payButton = document.getElementById("payButton");
    const orderItems = document.getElementById("orderItems");
    const orderTotal = document.getElementById("orderTotal");

    function readCart() {
        try {
            const cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
            return Array.isArray(cart) ? cart : [];
        } catch {
            return [];
        }
    }

    const cart = readCart();

    function renderOrder() {
        orderItems.replaceChildren();

        cart.forEach((item) => {
            const row = document.createElement("div");
            row.className = "order-line";

            const description = document.createElement("span");
            description.textContent = `${item.name} × ${item.quantity}`;

            const price = document.createElement("span");
            price.textContent =
                `RM ${(Number(item.price) * Number(item.quantity)).toFixed(2)}`;

            row.append(description, price);
            orderItems.append(row);
        });

        return cart.reduce(
            (sum, item) =>
                sum + Number(item.price) * Number(item.quantity),
            0
        );
    }

    function updateBankField() {
        const method = paymentForm.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value;

        const isFpx = method === "fpx";
        bankField.hidden = !isFpx;
        bankSelect.required = isFpx;
    }

    const total = renderOrder();
    orderTotal.textContent = `RM ${total.toFixed(2)}`;

    if (cart.length === 0) {
        paymentForm.hidden = true;
        paymentStatus.textContent =
            "Your cart is empty. Add products before continuing.";
    }

    paymentForm.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
        input.addEventListener("change", updateBankField);
    });

    paymentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        paymentStatus.textContent = "";

        if (cart.length === 0) {
            paymentStatus.textContent = "Your cart is empty.";
            return;
        }

        const selectedMethod = paymentForm.querySelector(
            'input[name="paymentMethod"]:checked'
        );

        if (!selectedMethod) {
            paymentStatus.textContent = "Select a payment method.";
            return;
        }

        if (selectedMethod.value === "fpx" && !bankSelect.value) {
            paymentStatus.textContent = "Select a bank to continue.";
            bankSelect.focus();
            return;
        }

        const pendingPayment = {
            method: selectedMethod.value,
            bank: selectedMethod.value === "fpx" ? bankSelect.value : "",
            total,
            items: cart,
            createdAt: new Date().toISOString()
        };

        try {
            sessionStorage.setItem(
                pendingPaymentKey,
                JSON.stringify(pendingPayment)
            );

            if (selectedMethod.value === "card") {
                window.location.href = "card-demo.html";
            } else {
                window.location.href = "demo-payment.html";
            }
        } catch {
            paymentStatus.textContent =
                "Could not start the demo payment. Check your browser storage.";
            payButton.disabled = false;
        }
    });

    document.getElementById("menuButton")?.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
    });
})();