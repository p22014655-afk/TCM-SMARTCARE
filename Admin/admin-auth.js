(function () {
    const sessionKey = "tcmAdminUser";

    function allUsers() {
        const data = window.TcmAdminData.load();
        return [...data.staff, ...data.doctors];
    }

    function login(identifier, password) {
        const value = identifier.trim().toLowerCase();
        const user = allUsers().find((item) =>
            item.email.toLowerCase() === value || item.staffId.toLowerCase() === value
        );

        if (!value || !password) {
            return { ok: false, message: "Enter your staff ID/email and password." };
        }

        if (!user || user.password !== password) {
            return { ok: false, message: "Invalid ID/email or password." };
        }

        const session = {
            id: user.id,
            name: user.name,
            role: user.role,
            avatar: user.avatar
        };

        sessionStorage.setItem(sessionKey, JSON.stringify(session));
        return { ok: true, user: session };
    }

    function demoLogin(role) {
        const data = window.TcmAdminData.load();
        const user = role === "doctor" ? data.doctors[0] : data.staff[0];
        const session = {
            id: user.id,
            name: user.name,
            role: user.role,
            avatar: user.avatar
        };
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
        return session;
    }

    function logout() {
        sessionStorage.removeItem(sessionKey);
        window.location.href = "admin-login.html";
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
        if (!allowedRoles.includes(user.role)) {
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
        logout,
        getCurrentAdmin,
        checkAdminSession,
        checkRole,
        redirectByRole
    };
})();
