(function () {
    const sessionKey = "tcmAdminUser";

    async function apiRequest(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.detail || "The admin server could not complete the request.");
        }
        return result;
    }

    async function login(identifier, password) {
        const result = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ identifier, password })
        });
        sessionStorage.setItem(sessionKey, JSON.stringify(result.user));
        return result.user;
    }

    async function demoLogin(role) {
        const result = await apiRequest("/api/auth/demo", {
            method: "POST",
            body: JSON.stringify({ role })
        });
        sessionStorage.setItem(sessionKey, JSON.stringify(result.user));
        return result.user;
    }

    async function initialize() {
        try {
            const result = await apiRequest("/api/auth/me");
            sessionStorage.setItem(sessionKey, JSON.stringify(result.user));
            return result.user;
        } catch (error) {
            sessionStorage.removeItem(sessionKey);
            if (error.message === "Please sign in to continue.") return null;
            throw error;
        }
    }

    async function changePassword(currentPassword, newPassword) {
        await apiRequest("/api/auth/password", {
            method: "PUT",
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
    }

    async function logout() {
        try {
            await apiRequest("/api/auth/logout", { method: "POST" });
        } finally {
            sessionStorage.removeItem(sessionKey);
            window.location.href = "admin-login.html";
        }
    }

    function getCurrentAdmin() {
        try {
            return JSON.parse(sessionStorage.getItem(sessionKey) || "null");
        } catch {
            return null;
        }
    }

    function checkAdminSession() {
        const user = getCurrentAdmin();
        if (!user) {
            window.location.href = "admin-login.html";
            return null;
        }
        return user;
    }

    function checkRole(allowedRoles) {
        const user = checkAdminSession();
        if (!user) return false;
        if (!allowedRoles.includes(user.role) && !(user.role === "superadmin" && allowedRoles.includes("staff"))) {
            document.body.innerHTML = `
                <main class="access-denied">
                    <h1>Access restricted</h1>
                    <p>This module is available for ${allowedRoles.join(", ")} accounts only.</p>
                    <a href="admin-dashboard.html">Return to dashboard</a>
                </main>
            `;
            return false;
        }
        return true;
    }

    function redirectByRole() {
        window.location.href = "admin-dashboard.html";
    }

    window.TcmAdminAuth = {
        login,
        demoLogin,
        initialize,
        changePassword,
        logout,
        getCurrentAdmin,
        checkAdminSession,
        checkRole,
        redirectByRole
    };
})();
