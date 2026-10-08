(function () {
    function formatDate(value) {
        const date = parseDate(value);
        if (Number.isNaN(date.getTime())) return "Date unavailable";
        return date.toLocaleDateString("en-MY", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    function shortDate(value) {
        const date = parseDate(value);
        if (Number.isNaN(date.getTime())) return "Date unavailable";
        return date.toLocaleDateString("en-MY", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function parseDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
        if (!match) return new Date(value);
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    function formatTime(value) {
        if (!value) return "";
        const [hour, minute] = value.split(":").map(Number);
        const date = new Date();
        date.setHours(hour, minute || 0, 0, 0);
        return date.toLocaleTimeString("en-MY", {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function generateID(prefix) {
        return `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    function showToast(message) {
        let toast = document.querySelector(".admin-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "admin-toast";
            document.body.append(toast);
        }
        toast.textContent = message;
        toast.classList.add("show");
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
    }

    function openModal(title, body, footer = "", options = {}) {
        closeModal();
        const wrapper = document.createElement("div");
        wrapper.className = "admin-modal";
        wrapper.innerHTML = `
            <div class="admin-modal__panel" role="dialog" aria-modal="true">
                <button class="modal-close" type="button" aria-label="Close">x</button>
                <h2>${title}</h2>
                <div class="modal-body">${body}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ""}
            </div>
        `;
        document.body.append(wrapper);
        wrapper.querySelector(".modal-close").addEventListener("click", closeModal);
        wrapper.addEventListener("click", (event) => {
            if (event.target === wrapper && options.closeOnBackdrop !== false) closeModal();
        });
    }

    function closeModal() {
        document.querySelector(".admin-modal")?.remove();
    }

    function statusClass(status) {
        return String(status || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }

    function money(value) {
        return `RM ${Number(value || 0).toFixed(2)}`;
    }

    window.TcmAdminUtils = {
        formatDate,
        shortDate,
        formatTime,
        generateID,
        showToast,
        openModal,
        closeModal,
        statusClass,
        money
    };
})();
