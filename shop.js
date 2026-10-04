(() => {
    const cartKey = "tcmCart";
    const products = [...document.querySelectorAll(".product")];
    const searchInput = document.getElementById("search");
    const filterButtons = [...document.querySelectorAll(".filters button")];
    const cartCount = document.getElementById("cartCount");
    const emptyMessage = document.getElementById("emptyMessage");

    let selectedCategory = "all";

    function readCart() {
        try {
            const cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
            return Array.isArray(cart) ? cart : [];
        } catch {
            return [];
        }
    }

    function updateCartCount() {
        const count = readCart().reduce(
            (total, item) => total + (Number(item.quantity) || 0),
            0
        );

        cartCount.textContent = String(count);
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(cartKey, JSON.stringify(cart));
            updateCartCount();
            return true;
        } catch {
            alert("Could not save your cart. Check your browser storage and try again.");
            return false;
        }
    }

    function filterProducts() {
        const query = searchInput.value.trim().toLowerCase();
        let visibleCount = 0;

        products.forEach((product) => {
            const categoryMatches =
                selectedCategory === "all" ||
                product.dataset.category === selectedCategory;

            const textToSearch = [
                product.dataset.search || "",
                product.textContent
            ].join(" ").toLowerCase();

            const searchMatches = textToSearch.includes(query);
            product.hidden = !(categoryMatches && searchMatches);

            if (!product.hidden) {
                visibleCount += 1;
            }
        });

        emptyMessage.hidden = visibleCount > 0;
    }

    function getProductInfo(product) {
        const heading = product.querySelector("h3");
        const name = heading?.childNodes[0]?.textContent.trim();
        const priceText =
            product.querySelector(".product-buy > strong")?.textContent || "";
        const priceMatch = priceText.match(/RM\s*([\d.]+)/i);

        if (!name || !priceMatch) {
            throw new Error("Could not read the product name or price.");
        }

        return {
            name,
            price: Number(priceMatch[1])
        };
    }

    function groupHeaderLinks() {
        const cartLink = document.querySelector(".topbar .cart-link");
        if (!cartLink) return;

        let actions = document.querySelector(".shop-header-actions");

        if (!actions) {
            actions = document.createElement("div");
            actions.className = "shop-header-actions";
            cartLink.parentNode.insertBefore(actions, cartLink);
        }

        if (cartLink.parentNode !== actions) {
            actions.append(cartLink);
        }

        let historyLink = actions.querySelector(".history-link");

        if (!historyLink) {
            historyLink = document.createElement("a");
            historyLink.className = "cart-link history-link";
            historyLink.href = "history.html";
            historyLink.textContent = "Purchase history";
            actions.append(historyLink);
        }
    }

    searchInput.addEventListener("input", filterProducts);

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            filterButtons.forEach((item) => item.classList.remove("active"));
            button.classList.add("active");

            selectedCategory = button.dataset.filter || "all";
            filterProducts();
        });
    });

    products.forEach((product) => {
        const quantityDisplay = product.querySelector(".quantity-value");
        const minusButton = product.querySelector(".quantity-minus");
        const plusButton = product.querySelector(".quantity-plus");
        const addButton = product.querySelector(".add-button");

        if (!quantityDisplay || !minusButton || !plusButton || !addButton) {
            return;
        }

        function getQuantity() {
            const quantity = Number.parseInt(quantityDisplay.textContent, 10);
            return Number.isInteger(quantity) && quantity >= 1 ? quantity : 1;
        }

        minusButton.addEventListener("click", () => {
            quantityDisplay.textContent = String(
                Math.max(1, getQuantity() - 1)
            );
        });

        plusButton.addEventListener("click", () => {
            quantityDisplay.textContent = String(
                Math.min(99, getQuantity() + 1)
            );
        });

        addButton.addEventListener("click", () => {
            let productInfo;

            try {
                productInfo = getProductInfo(product);
            } catch (error) {
                alert(error.message);
                return;
            }

            const cart = readCart();
            const quantityToAdd = getQuantity();
            const existingItem = cart.find(
                (item) => item.name === productInfo.name
            );

            if (existingItem) {
                existingItem.quantity =
                    Number(existingItem.quantity) + quantityToAdd;
            } else {
                cart.push({
                    name: productInfo.name,
                    price: productInfo.price,
                    quantity: quantityToAdd
                });
            }

            if (!saveCart(cart)) return;

            addButton.textContent = "Added ✓";
            addButton.disabled = true;

            window.setTimeout(() => {
                addButton.textContent = "Add to cart";
                addButton.disabled = false;
            }, 900);
        });
    });

    document.getElementById("menuButton")?.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
    });

    document.getElementById("logoutButton")?.addEventListener("click", () => {
        sessionStorage.removeItem("tcmPatientName");
        window.location.href = "login.html";
    });

    window.addEventListener("storage", (event) => {
        if (event.key === cartKey) {
            updateCartCount();
        }
    });

    groupHeaderLinks();
    updateCartCount();
    filterProducts();
})();