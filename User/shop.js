(() => {
    const cartKey = "tcmCart";
    const productGrid = document.querySelector(".products");

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function shopCategory(category) {
        const normalized = String(category || "").toLowerCase();
        if (normalized.includes("tea")) return "tea";
        if (normalized.includes("supplement")) return "supplements";
        if (normalized.includes("wellness") || normalized.includes("care")) return "care";
        return "herbs";
    }

    function renderStaffProducts() {
        productGrid.querySelectorAll(".staff-product").forEach((product) => product.remove());
        let staffProducts = [];

        try {
            const savedData = JSON.parse(localStorage.getItem("tcmAdminData") || "null");
            if (Array.isArray(savedData?.products)) {
                staffProducts = savedData.products.filter((product) =>
                    product && product.status === "Active"
                );
            }
        } catch (error) {
            console.error("Could not load staff-managed shop products.", error);
        }

        productGrid.insertAdjacentHTML("afterbegin", staffProducts.map((product) => {
            const name = escapeHtml(product.name);
            const category = escapeHtml(product.category);
            const description = escapeHtml(product.description);
            const ingredients = escapeHtml(product.ingredients);
            const instructions = escapeHtml(product.instructions);
            const precautions = escapeHtml(product.precautions);
            const searchableText = escapeHtml([
                product.name,
                product.category,
                product.description,
                product.ingredients,
                product.instructions,
                product.precautions
            ].filter(Boolean).join(" "));
            const productDetails = [
                ["Description", description],
                ["Ingredients (Gram Measurements)", ingredients],
                ["Instructions", instructions],
                ["Precautions", precautions]
            ].filter(([, value]) => value);
            const detailsMarkup = productDetails.length
                ? `<details><summary>View product details</summary>${productDetails.map(([label, value]) => `<div class="product-detail"><strong>${label}</strong><p>${value}</p></div>`).join("")}</details>`
                : "";
            const price = Number(product.price);
            const formattedPrice = Number.isFinite(price) ? price.toFixed(2) : "0.00";
            const categoryFilter = shopCategory(product.category);
            const photoMarkup = product.image
                ? `<img class="product-icon product-photo" src="${escapeHtml(product.image)}" alt="${name}">`
                : `<div class="product-icon" aria-hidden="true">草本</div>`;

            return `<article class="product staff-product" data-category="${categoryFilter}" data-search="${searchableText}">
                ${photoMarkup}
                <small>${category} · STAFF PRODUCT</small>
                <h3>${name}</h3>
                ${description ? `<p class="staff-product-description" title="${description}">${description}</p>` : ""}
                ${detailsMarkup}
                <div class="product-buy">
                    <strong>RM ${formattedPrice}</strong>
                    <div class="product-actions">
                        <div class="quantity-picker">
                            <button class="quantity-minus" type="button" aria-label="Decrease ${name} quantity">−</button>
                            <span class="quantity-value">1</span>
                            <button class="quantity-plus" type="button" aria-label="Increase ${name} quantity">+</button>
                        </div>
                        <button class="add-button" type="button">Add to cart</button>
                    </div>
                </div>
            </article>`;
        }).join(""));
    }

    const searchInput = document.getElementById("search");
    const filterButtons = [...document.querySelectorAll(".filters button")];
    const cartCount = document.getElementById("cartCount");
    const emptyMessage = document.getElementById("emptyMessage");

    let products = [];
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

    function bindProductActions(product) {
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
    }

    function refreshStaffProducts() {
        renderStaffProducts();
        const staffCards = [...productGrid.querySelectorAll(".staff-product")];
        staffCards.forEach(bindProductActions);
        products = [...document.querySelectorAll(".product")];
        filterProducts();
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

    document.querySelectorAll(".product").forEach(bindProductActions);

    document.getElementById("menuButton")?.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
    });

    document.getElementById("logoutButton")?.addEventListener("click", () => {
        sessionStorage.removeItem("tcmPatientName");
        sessionStorage.removeItem("tcmPatientEmail");
        window.location.href = "login.html";
    });

    window.addEventListener("storage", (event) => {
        if (event.key === cartKey) {
            updateCartCount();
        } else if (event.key === "tcmAdminData") {
            refreshStaffProducts();
        }
    });

    groupHeaderLinks();
    updateCartCount();
    refreshStaffProducts();
    filterProducts();
})();