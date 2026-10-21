(function () {
    const { formatDate, shortDate, formatTime, generateID, showToast, openModal, closeModal, statusClass, money } = window.TcmAdminUtils;
    const pages = {
        dashboard: renderDashboard,
        appointments: renderAppointments,
        schedule: renderSchedule,
        patients: renderPatients,
        carePlan: renderCarePlan,
        products: renderProducts,
        orders: renderOrders,
        messages: renderMessages,
        feedback: renderFeedback,
        announcements: renderAnnouncements,
        analytics: renderAnalytics,
        accounts: renderAccounts
    };
    let activeMessageId = "";

    function data() {
        return window.TcmAdminData.load();
    }

    function save(nextData) {
        return window.TcmAdminData.save(nextData);
    }

    function current() {
        return window.TcmAdminAuth.getCurrentAdmin();
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function mountView(templateId, target = byId("adminPage")) {
        const template = byId(templateId);
        if (!template || !(template instanceof HTMLTemplateElement)) {
            throw new Error(`Required HTML template "${templateId}" was not found.`);
        }
        target.replaceChildren(template.content.cloneNode(true));
        return target;
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function productCategories(products) {
        const categories = ["Bird's Nest", "Ginseng", "Herbal Tea", "Wellness"];
        const seen = new Set(categories.map((category) => category.toLowerCase()));

        products.forEach((product) => {
            const category = String(product.category || "").trim();
            const normalized = category.toLowerCase();
            if (category && !seen.has(normalized)) {
                categories.push(category);
                seen.add(normalized);
            }
        });

        return categories;
    }

    function doctorName(doctorId, state = data()) {
        return state.doctors.find((doctor) => doctor.id === doctorId)?.name || "Doctor";
    }

    function badge(status) {
        return `<span class="badge ${statusClass(status)}">${escapeHtml(status)}</span>`;
    }

    function protect(page) {
        if (["feedback", "announcements", "analytics", "schedule", "products", "orders", "accounts"].includes(page)) {
            return window.TcmAdminAuth.checkRole(["staff"]);
        }
        return Boolean(window.TcmAdminAuth.checkAdminSession());
    }

    function initLogin() {
        const form = byId("adminLoginForm");
        const status = byId("loginStatus");
        const password = byId("password");
        byId("togglePassword").addEventListener("click", () => {
            password.type = password.type === "password" ? "text" : "password";
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            status.textContent = "";
            const button = form.querySelector("button[type='submit']");
            button.disabled = true;
            button.textContent = "Logging in...";
            try {
                await window.TcmAdminAuth.login(byId("identifier").value, password.value);
                window.TcmAdminAuth.redirectByRole();
            } catch (error) {
                status.textContent = error.message || "Could not sign in. Please try again.";
                button.disabled = false;
                button.textContent = "Login";
            }
        });

        byId("demoRole").addEventListener("change", async (event) => {
            const role = event.target.value;
            if (!role) return;
            try {
                await window.TcmAdminAuth.demoLogin(role);
                window.TcmAdminAuth.redirectByRole();
            } catch (error) {
                status.textContent = error.message || "Demo sign-in is unavailable.";
                event.target.value = "";
            }
        });

        document.querySelectorAll("[data-demo-login]").forEach((button) => {
            button.addEventListener("click", async () => {
                status.textContent = "";
                try {
                    await window.TcmAdminAuth.demoLogin(button.dataset.demoLogin);
                    window.TcmAdminAuth.redirectByRole();
                } catch (error) {
                    status.textContent = error.message || "Demo sign-in is unavailable.";
                }
            });
        });
    }

    function renderShell(page, title) {
        const user = current();
        const nav = document.querySelector(".admin-nav");
        if (nav && !nav.querySelector('[data-nav-page="accounts"]')) {
            const insightsGroup = nav.querySelector('[data-nav-page="analytics"]')?.closest(".nav-group");
            insightsGroup?.insertAdjacentHTML("afterend", `
                <div class="nav-group">
                    <p>Administration</p>
                    <a data-nav-page="accounts" data-staff-only href="admin-accounts.html">
                        <span class="nav-icon icon-users"></span><span>Staff &amp; Accounts</span>
                    </a>
                </div>
            `);
        }
        byId("adminDate").textContent = formatDate(new Date());
        byId("pageTitle").textContent = title;
        byId("adminAvatar").textContent = user.avatar;
        byId("adminName").textContent = user.name;
        byId("adminRole").textContent = user.role;
        const profileButton = document.querySelector(".admin-profile");
        if (profileButton) {
            profileButton.setAttribute("role", "button");
            profileButton.setAttribute("tabindex", "0");
            profileButton.setAttribute("aria-label", "Edit your profile and password");
            profileButton.setAttribute("title", "Edit profile");
            profileButton.addEventListener("click", openAdminProfile);
            profileButton.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openAdminProfile();
                }
            });
        }
        const savedUser = accountDirectory(data()).find((account) => account.id === user.id);
        renderAdminAvatar(savedUser?.profilePicture || "", savedUser?.name || user.name);

        document.querySelectorAll("[data-nav-page]").forEach((link) => {
            const isActive = link.dataset.navPage === page;
            link.classList.toggle("active", isActive);
            if (isActive) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        document.querySelectorAll("[data-staff-only]").forEach((link) => {
            link.hidden = user.role !== "staff";
        });
        if (user.role === "doctor") {
            ["schedule", "feedback", "announcements"].forEach((pageName) => {
                document.querySelector(`[data-nav-page="${pageName}"]`)?.remove();
            });
        }
        document.querySelectorAll(".admin-nav .nav-group").forEach((group) => {
            group.hidden = !group.querySelector("a:not([hidden])");
        });
        byId("adminLogout").addEventListener("click", window.TcmAdminAuth.logout);
    }

    function renderAdminAvatar(photo, name) {
        const avatar = byId("adminAvatar");
        if (!avatar) return;
        if (photo) {
            avatar.textContent = "";
            avatar.style.backgroundImage = `url("${photo}")`;
            avatar.style.backgroundSize = "cover";
            avatar.style.backgroundPosition = "center";
            avatar.style.backgroundRepeat = "no-repeat";
            avatar.setAttribute("aria-label", `${name} profile picture`);
            return;
        }
        avatar.style.backgroundImage = "";
        avatar.textContent = initials(name);
        avatar.setAttribute("aria-label", `${name} initials`);
    }

    function openAdminProfile() {
        const user = current();
        const state = data();
        const account = accountDirectory(state).find((item) => item.id === user.id);
        if (!account) {
            showToast("Could not find your account. Please sign in again.");
            return;
        }

        let pendingPhoto = account.profilePicture || "";
        openModal("Edit profile", `
            <form class="admin-profile-form" id="adminProfileForm" autocomplete="off">
                <div class="admin-profile-photo-editor">
                    <div class="admin-profile-photo-preview" id="adminProfilePhotoPreview">
                        ${pendingPhoto ? `<img src="${pendingPhoto}" alt="Profile picture preview">` : `<span>${escapeHtml(initials(account.name))}</span>`}
                    </div>
                    <div>
                        <strong>Profile picture</strong>
                        <p>Choose an image up to 5 MB. It will be resized before saving.</p>
                        <label class="secondary-btn admin-photo-picker" for="adminProfilePhoto">Choose picture</label>
                        <input id="adminProfilePhoto" type="file" accept="image/png,image/jpeg,image/webp">
                        <button class="mini-btn" id="removeAdminProfilePhoto" type="button">Remove</button>
                    </div>
                </div>
                <div class="form-grid">
                    <label class="full"><span>Full name</span><input id="adminProfileName" name="name" maxlength="100" value="${escapeHtml(account.name)}" autocomplete="name" required></label>
                    <label class="full"><span>Email address</span><input id="adminProfileEmail" name="email" type="email" maxlength="254" value="${escapeHtml(account.email)}" autocomplete="email" required></label>
                </div>
                <details class="admin-password-editor">
                    <summary>Change password</summary>
                    <div class="form-grid">
                        <label class="full"><span>Current password</span><input id="adminCurrentPassword" type="password" autocomplete="current-password"></label>
                        <label><span>New password</span><input id="adminNewPassword" type="password" minlength="8" autocomplete="new-password"></label>
                        <label><span>Confirm new password</span><input id="adminConfirmPassword" type="password" minlength="8" autocomplete="new-password"></label>
                    </div>
                </details>
            </form>
        `, `<button class="primary-btn" id="saveAdminProfile" type="button">Save changes</button>`, { closeOnBackdrop: false });

        const photoInput = byId("adminProfilePhoto");
        photoInput.addEventListener("change", () => {
            const file = photoInput.files?.[0];
            if (!file) return;
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                showToast("Choose a JPG, PNG, or WEBP image.");
                photoInput.value = "";
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast("Choose an image smaller than 5 MB.");
                photoInput.value = "";
                return;
            }
            const reader = new FileReader();
            reader.addEventListener("error", () => showToast("Could not read that image. Try another file."));
            reader.addEventListener("load", () => {
                const image = new Image();
                image.addEventListener("error", () => showToast("Could not open that image. Try another file."));
                image.addEventListener("load", () => {
                    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(image.width * scale));
                    canvas.height = Math.max(1, Math.round(image.height * scale));
                    const context = canvas.getContext("2d");
                    if (!context) {
                        showToast("Could not process the picture in this browser.");
                        return;
                    }
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    pendingPhoto = canvas.toDataURL("image/jpeg", 0.82);
                    byId("adminProfilePhotoPreview").innerHTML = `<img src="${pendingPhoto}" alt="Profile picture preview">`;
                });
                image.src = String(reader.result);
            });
            reader.readAsDataURL(file);
        });
        byId("adminProfileName").addEventListener("input", () => {
            if (!pendingPhoto) {
                byId("adminProfilePhotoPreview").innerHTML = `<span>${escapeHtml(initials(byId("adminProfileName").value))}</span>`;
            }
        });
        byId("removeAdminProfilePhoto").addEventListener("click", () => {
            pendingPhoto = "";
            photoInput.value = "";
            byId("adminProfilePhotoPreview").innerHTML = `<span>${escapeHtml(initials(byId("adminProfileName").value))}</span>`;
        });
        byId("saveAdminProfile").addEventListener("click", async () => {
            const form = byId("adminProfileForm");
            if (!form.reportValidity()) return;
            const name = byId("adminProfileName").value.trim();
            const email = byId("adminProfileEmail").value.trim().toLowerCase();
            const currentPassword = byId("adminCurrentPassword").value;
            const newPassword = byId("adminNewPassword").value;
            const confirmPassword = byId("adminConfirmPassword").value;
            const changesPassword = Boolean(currentPassword || newPassword || confirmPassword);

            if (!name || !email) return;
            if (accountDirectory(state).some((item) => item.id !== account.id && item.email.trim().toLowerCase() === email)) {
                showToast("Another account already uses this email address.");
                return;
            }
            if (changesPassword) {
                if (!currentPassword || !newPassword || !confirmPassword) {
                    showToast("Enter your current password and both new password fields.");
                    return;
                }
                if (newPassword.length < 8) {
                    showToast("Your new password must be at least 8 characters.");
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showToast("The new passwords do not match.");
                    return;
                }
            }

            account.name = name;
            account.email = email;
            account.avatar = initials(name);
            account.profilePicture = pendingPhoto;
            try {
                if (changesPassword) {
                    await window.TcmAdminAuth.changePassword(currentPassword, newPassword);
                }
                if (!await save(state)) return;
                const updatedSession = {
                    id: account.id,
                    name: account.name,
                    role: account.role,
                    avatar: account.avatar
                };
                sessionStorage.setItem("tcmAdminUser", JSON.stringify(updatedSession));
                byId("adminName").textContent = account.name;
                renderAdminAvatar(account.profilePicture, account.name);
                closeModal();
                showToast(changesPassword ? "Profile and password updated." : "Profile updated.");
            } catch (error) {
                showToast(error?.message || "Could not save your profile. Try using a smaller picture.");
            }
        });
    }

    function table(headers, rows) {
        return `
            <table class="admin-table">
                <thead><tr>${headers.map((item) => `<th>${item}</th>`).join("")}</tr></thead>
                <tbody>${rows.join("") || `<tr><td colspan="${headers.length}">No records found.</td></tr>`}</tbody>
            </table>
        `;
    }

    function initials(name) {
        return String(name || "").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    }

    function timeRange(item) {
        return `${formatTime(item.time)} - ${formatTime(item.endTime)}`;
    }

    function patientAvatar(name) {
        return `<span class="avatar mini-avatar">${initials(name)}</span>`;
    }

    function todayAppointments(state = data()) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return state.appointments.filter((appointment) => appointment.date === today);
    }

    function renderDashboard() {
        const user = current();
        const state = data();
        if (user.role === "doctor") {
            renderDoctorDashboard(state, user);
            return;
        }
        renderStaffDashboard(state, user);
    }

    function renderStaffDashboard(state, user) {
        const today = todayAppointments(state);
        const checkedIn = today.filter((item) => item.status === "Checked In").length;
        const pendingOrders = state.orders.filter((item) => item.status === "Pending Packing").length;
        const lowStock = state.products.filter((item) => item.stock <= item.lowStockThreshold).length;
        mountView("admin-staff-dashboard-view");
        byId("staffDashboardGreeting").textContent = `Good Morning, ${user.name}`;
        byId("staffDashboardKpis").innerHTML = [
            kpi(today.length, "Today's Appointments", "+2 compared with yesterday", "admin-appointments.html?date=today", "calendar", true),
            kpi(checkedIn, "Checked In", "Patients who have arrived", "admin-appointments.html?status=Checked%20In", "users"),
            kpi(pendingOrders, "Orders To Process", "Pending packing", "admin-orders.html?status=Pending%20Packing", "box"),
            kpi(lowStock, "Low Stock Products", "Needs restock review", "admin-products.html?stock=low", "bag")
        ].join("");
        byId("staffAppointmentSummary").textContent = `${today.length} appointments · ${checkedIn} checked in`;
        byId("staffAppointmentTable").innerHTML = table(["Time", "Patient / Service", "Doctor / Status", "Action"], today.map((item) => `
            <tr>
                <td>${formatTime(item.time)}</td>
                <td><div class="person-cell">${patientAvatar(item.patient)}<span><strong>${item.patient}</strong><small>${item.service}</small></span></div></td>
                <td><strong>${item.doctor}</strong><br>${badge(item.status)}</td>
                <td class="row-actions"><button class="mini-btn" data-view-appointment="${item.id}">View</button>${["Scheduled", "Rescheduled"].includes(item.status) ? `<button class="mini-btn" data-check-in="${item.id}">Check-in</button>` : ""}${item.status === "Completed" ? `<a class="text-link" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">View Clinical Notes</a>` : ""}</td>
            </tr>
        `));
        byId("staffTimeline").innerHTML = today.map((item) => `<div><small>${formatTime(item.time)}</small><strong>${item.patient} - ${item.service}</strong><span>${item.doctor}</span></div>`).join("");
        byId("dashboardCreateAppointment")?.addEventListener("click", openAppointmentCreate);
        bindAppointmentButtons();
    }

    function renderDoctorDashboard(state, user) {
        const mine = todayAppointments(state).filter((item) => item.doctorId === user.id);
        mountView("admin-doctor-dashboard-view");
        byId("doctorDashboardGreeting").textContent = `Good Morning, ${user.name}`;
        byId("doctorDashboardKpis").innerHTML = [
            kpi(mine.length, "Today's Patients", "Assigned to you", "admin-appointments.html?date=today"),
            kpi(mine.filter((item) => item.status === "Checked In").length, "Checked In", "Ready to start", "admin-appointments.html?status=Checked%20In"),
            kpi(mine.filter((item) => item.status === "Completed").length, "Completed Today", "Consultations completed", "admin-appointments.html?status=Completed"),
            kpi(state.messages.filter((item) => item.doctorId === user.id).reduce((sum, item) => sum + item.unread, 0), "Unread Messages", "Patient conversations", "admin-messages.html?filter=unread")
        ].join("");
        byId("doctorAppointmentTable").innerHTML = table(["Time", "Patient", "Service", "Status", "Action"], mine.map((item) => `
            <tr><td>${formatTime(item.time)}</td><td>${item.patient}</td><td>${item.service}</td><td>${badge(item.status)}</td>
            <td class="row-actions">${item.status === "Checked In" ? `<button class="mini-btn" data-start-consult="${item.id}">Start</button>` : `<button class="mini-btn" data-view-appointment="${item.id}">View</button>`}<a class="text-link" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">Clinical Notes</a></td></tr>
        `));
        bindAppointmentButtons();
    }

    function kpi(value, label, hint, href, icon = "grid", featured = false) {
        return `<a class="kpi-card ${featured ? "featured" : ""}" href="${href}"><span class="kpi-icon nav-icon icon-${icon}"></span><strong>${value}</strong><span>${label}</span><small>${hint}</small></a>`;
    }

    function renderAppointments() {
        const user = current();
        const state = data();
        const params = new URLSearchParams(location.search);
        const records = state.appointments.length;
        mountView("admin-appointment-view");
        byId("createAppointment").hidden = user.role !== "staff";
        byId("filterDoctor").innerHTML = user.role === "doctor"
            ? `<option value="${escapeHtml(user.id)}">My Appointments</option>`
            : `<option value="">All Doctors</option>${state.doctors.map((doctor) => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.name)}</option>`).join("")}`;
        byId("filterDoctor").disabled = user.role === "doctor";
        byId("appointmentResultSummary").textContent = `${records} records`;
        byId("allAppointmentCount").textContent = records;
        byId("scheduledAppointmentCount").textContent = state.appointments.filter((item) => item.status === "Scheduled").length;
        byId("checkedInAppointmentCount").textContent = state.appointments.filter((item) => item.status === "Checked In").length;
        byId("completedAppointmentCount").textContent = state.appointments.filter((item) => item.status === "Completed").length;
        byId("filterDate").value = params.has("date")
            ? params.get("date")
            : params.has("status") ? "" : "upcoming";
        const requestedStatus = params.get("status") || "";
        byId("filterStatus").value = ({
            "Pending Confirmation": "Scheduled",
            Confirmed: "Scheduled",
            Waiting: "Checked In"
        })[requestedStatus] || requestedStatus;
        byId("customDateFilter").hidden = byId("filterDate").value !== "custom";
        if (user.role === "doctor") byId("filterDoctor").value = user.id;
        byId("filterDate").addEventListener("change", () => {
            byId("customDateFilter").hidden = byId("filterDate").value !== "custom";
            renderAppointmentTable();
        });
        ["appointmentSearch", "filterDoctor", "filterService", "filterStatus", "filterCustomDate"].forEach((id) => byId(id).addEventListener("input", renderAppointmentTable));
        document.querySelectorAll("[data-status-tab]").forEach((button) => button.addEventListener("click", () => {
            document.querySelectorAll("[data-status-tab]").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            byId("filterStatus").value = button.dataset.statusTab;
            byId("filterDate").value = "";
            byId("customDateFilter").hidden = true;
            renderAppointmentTable();
        }));
        byId("tableView").addEventListener("click", renderAppointmentTable);
        byId("calendarView").addEventListener("click", renderCalendar);
        byId("createAppointment")?.addEventListener("click", openAppointmentCreate);
        renderAppointmentTable();
        drawSelectedAppointment(filteredAppointments()[0]);
    }

    function filteredAppointments() {
        const user = current();
        const state = data();
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const addDays = (date, days) => {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        };
        const weekday = now.getDay();
        const daysSinceMonday = (weekday + 6) % 7;
        const weekStartDate = new Date(now);
        weekStartDate.setDate(now.getDate() - daysSinceMonday);
        const weekStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, "0")}-${String(weekStartDate.getDate()).padStart(2, "0")}`;
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 7);
        const weekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;
        const dateFilter = byId("filterDate")?.value || "";
        const doctorFilter = user.role === "doctor" ? user.id : byId("filterDoctor")?.value;
        const query = (byId("appointmentSearch")?.value || "").trim().toLowerCase();
        return state.appointments.filter((item) => {
            const matchesDate = dateFilter === "today" ? item.date === today
                : dateFilter === "tomorrow" ? item.date === addDays(today, 1)
                    : dateFilter === "next7" ? item.date >= today && item.date < addDays(today, 7)
                        : dateFilter === "week" ? item.date >= weekStart && item.date < weekEnd
                            : dateFilter === "next30" || dateFilter === "upcoming" ? item.date >= today && item.date < addDays(today, 30)
                                : dateFilter === "past" ? item.date < today
                                    : dateFilter === "custom" ? Boolean(byId("filterCustomDate").value) && item.date === byId("filterCustomDate").value
                                        : true;
            return (!query || `${item.id} ${item.patient} ${item.contact}`.toLowerCase().includes(query)) &&
                matchesDate &&
                (!doctorFilter || item.doctorId === doctorFilter) &&
                (!byId("filterService")?.value || item.service === byId("filterService").value) &&
                (!byId("filterStatus")?.value || item.status === byId("filterStatus").value);
        }).sort((a, b) => {
            const aTime = `${a.date || ""} ${a.time || ""}`;
            const bTime = `${b.date || ""} ${b.time || ""}`;
            if (dateFilter === "past") return bTime.localeCompare(aTime);
            return aTime.localeCompare(bTime);
        });
    }

    function renderAppointmentTable() {
        const records = filteredAppointments();
        const dateFilter = byId("filterDate").value;
        const dateLabel = {
            upcoming: "upcoming 30 days",
            today: "today",
            tomorrow: "tomorrow",
            next7: "next 7 days",
            week: "this week",
            next30: "next 30 days",
            custom: byId("filterCustomDate").value || "selected date",
            past: "past appointments"
        }[dateFilter] || "all dates";
        byId("appointmentResultSummary").textContent =
            `${records.length} ${records.length === 1 ? "appointment" : "appointments"} · ${dateLabel} · sorted by date and time`;
        byId("appointmentContent").innerHTML = table(
            ["Patient / Contact", "Service", "Date / Time", "Doctor / Room", "Status", "Actions"],
            records.map((item, index) => `
                <tr>
                    <td><div class="person-cell">${patientAvatar(item.patient)}<span><strong>${item.patient}</strong><small>${item.id}<br>${item.contact}</small></span></div></td>
                    <td>${item.service}</td>
                    <td><strong>${shortDate(item.date)}</strong><br><small>${formatTime(item.time)}</small></td>
                    <td>${item.doctor}<br><small>${item.room}</small></td>
                    <td>${badge(item.status)}</td>
                    <td class="row-actions">
                        ${["Scheduled", "Rescheduled"].includes(item.status) ? `<button class="mini-btn ${index === 0 ? "primary-mini" : ""}" data-check-in="${item.id}">Check-in</button>` : ""}
                        <button class="text-link" data-view-appointment="${item.id}">View</button>
                        ${item.status === "Completed" ? `<a class="text-link" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">View Clinical Notes</a>` : current().role === "doctor" ? `<a class="text-link" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">Clinical Notes</a>` : ""}
                        <button class="icon-more" data-select-appointment="${item.id}" aria-label="Select appointment"></button>
                    </td>
                </tr>
            `)
        );
        bindAppointmentButtons(byId("appointmentContent"));
        document.querySelectorAll("[data-select-appointment]").forEach((button) => button.addEventListener("click", () => {
            const item = data().appointments.find((appointment) => appointment.id === button.dataset.selectAppointment);
            drawSelectedAppointment(item);
        }));
        drawSelectedAppointment(records[0]);
    }

    function drawSelectedAppointment(item) {
        const panel = byId("selectedAppointment");
        const manageCard = document.querySelector(".manage-card");
        if (!panel) return;
        if (!item) {
            panel.innerHTML = `<h2>Selected appointment</h2><p>No appointment selected.</p>`;
            if (manageCard) {
                manageCard.innerHTML = `<h2>Manage this appointment</h2><p>Select a record to review its details and available actions.</p>`;
            }
            return;
        }
        panel.innerHTML = `
            <div class="selected-head"><h2>Selected appointment</h2>${badge(item.status)}</div>
            <div class="selected-body">
                ${patientAvatar(item.patient)}
                <div><strong>${item.patient} - ${item.id}</strong><span>${item.service}</span></div>
            </div>
            <dl class="detail-grid">
                <div><dt>Date & Time</dt><dd>${shortDate(item.date)} - ${formatTime(item.time)}</dd></div>
                <div><dt>Doctor & Room</dt><dd>${item.doctor} - ${item.room}</dd></div>
            </dl>
        `;
        if (manageCard) {
            const canCheckIn = ["Scheduled", "Rescheduled"].includes(item.status);
            const actions = [
                canCheckIn
                    ? `<button class="primary-btn" data-check-in="${item.id}"><span class="btn-icon icon-users"></span>Check-in</button>`
                    : item.status === "Checked In"
                        ? `<button class="primary-btn" data-start-consult="${item.id}">Start Consultation</button>`
                        : "",
                    `<button class="secondary-btn" data-view-appointment="${item.id}">View</button>`,
                    item.status === "Completed"
                        ? `<a class="secondary-btn" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">View Clinical Notes</a>`
                        : current().role === "doctor" ? `<a class="secondary-btn" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">Clinical Notes</a>` : ""
            ].filter(Boolean).join("");
            manageCard.innerHTML = `
                <h2>Manage this appointment</h2>
                <div class="row-actions">${actions}</div>
                ${canCheckIn ? `<hr><div class="link-row"><button class="text-link" data-reschedule="${item.id}">Reschedule</button><button class="text-link danger-text" data-cancel="${item.id}">Cancel appointment</button></div>` : ""}
                <p>${canCheckIn ? "Check in the patient when they arrive." : item.status === "Checked In" ? "Patient has arrived and is ready for consultation." : "No further actions are available."}</p>
            `;
            bindAppointmentButtons(manageCard);
        }
    }

    function renderCalendar() {
        const hours = ["09:00", "10:00", "11:00", "14:00", "15:00"];
        const days = ["MON", "TUE", "WED", "THU", "FRI"];
        const rows = [`<div class="calendar-head">Time</div>${days.map((day) => `<div class="calendar-head">${day}</div>`).join("")}`];
        hours.forEach((hour) => {
            rows.push(`<div>${formatTime(hour)}</div>`);
            days.forEach((day, index) => {
                const appt = filteredAppointments().find((item) => item.time === hour && new Date(item.date).getDay() === index + 1);
                rows.push(`<div>${appt ? `<button class="calendar-appt" data-view-appointment="${appt.id}">${appt.patient}<br>${appt.service}</button>` : ""}</div>`);
            });
        });
        byId("appointmentContent").innerHTML = `<div class="calendar-grid">${rows.join("")}</div>`;
        bindAppointmentButtons(byId("appointmentContent"));
    }

    function bindAppointmentButtons(root = document) {
        root.querySelectorAll("[data-view-appointment]").forEach((button) => button.addEventListener("click", () => openAppointmentDetails(button.dataset.viewAppointment)));
        root.querySelectorAll("[data-check-in]").forEach((button) => button.addEventListener("click", () => checkInAppointment(button.dataset.checkIn)));
        root.querySelectorAll("[data-start-consult]").forEach((button) => button.addEventListener("click", () => startConsultation(button.dataset.startConsult)));
        root.querySelectorAll("[data-reschedule]").forEach((button) => button.addEventListener("click", () => openReschedule(button.dataset.reschedule)));
        root.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", () => openCancel(button.dataset.cancel)));
    }

    function openAppointmentDetails(id) {
        const state = data();
        const item = state.appointments.find((appointment) => appointment.id === id);
        if (!item) return;
        const action = ["Scheduled", "Rescheduled"].includes(item.status)
            ? `<button class="primary-btn" data-check-in="${item.id}">Check-in</button>`
            : item.status === "Checked In"
                ? `<button class="primary-btn" data-start-consult="${item.id}">Start Consultation</button>`
                : "";
        const notesAction = item.status === "Completed"
            ? `<a class="secondary-btn" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">View Clinical Notes</a>`
            : current().role === "doctor"
                ? `<a class="secondary-btn" href="admin-care-plan.html?appointment=${encodeURIComponent(item.id)}">Clinical Notes</a>`
                : "";
        openModal("Appointment Details", `
            <dl>
                <dt>Appointment ID</dt><dd>${item.id}</dd>
                <dt>Patient</dt><dd>${item.patient}</dd>
                <dt>Phone</dt><dd>${item.contact}</dd>
                <dt>Service</dt><dd>${item.service}</dd>
                <dt>Date</dt><dd>${formatDate(item.date)}</dd>
                <dt>Time</dt><dd>${formatTime(item.time)} - ${formatTime(item.endTime)}</dd>
                <dt>Doctor</dt><dd>${item.doctor}</dd>
                <dt>Room</dt><dd>${item.room}</dd>
                <dt>Status</dt><dd>${badge(item.status)}</dd>
            </dl>
        `, `${action}${notesAction}`);
        bindAppointmentButtons(document.querySelector(".admin-modal"));
    }

    function checkInAppointment(id) {
        const item = data().appointments.find((appointment) => appointment.id === id);
        if (!item || !["Scheduled", "Rescheduled"].includes(item.status)) return;
        updateAppointment(id, "Checked In", "Patient checked in.");
    }

    function startConsultation(id) {
        const item = data().appointments.find((appointment) => appointment.id === id);
        if (!item || item.status !== "Checked In") return;
        updateAppointment(id, "In Consultation", "Consultation started.", false);
        window.location.href = `admin-care-plan.html?appointment=${encodeURIComponent(id)}`;
    }

    function updateAppointment(id, status, message, refresh = true) {
        const state = data();
        const item = state.appointments.find((appointment) => appointment.id === id);
        if (!item) return;
        item.status = status;
        save(state);
        showToast(message);
        closeModal();
        if (refresh && byId("appointmentContent")) renderAppointmentTable();
    }

    function openReschedule(id) {
        const state = data();
        const item = state.appointments.find((appointment) => appointment.id === id);
        openModal("Reschedule Appointment", `
            <form class="form-grid" id="rescheduleForm">
                <label><span>New Date</span><input type="date" name="date" value="${item.date}" required></label>
                <label><span>New Time</span><input type="time" name="time" value="${item.time}" required></label>
                <label><span>New Doctor</span><select name="doctorId">${state.doctors.map((doctor) => `<option value="${doctor.id}" ${doctor.id === item.doctorId ? "selected" : ""}>${doctor.name}</option>`).join("")}</select></label>
                <label><span>Reason</span><input name="reason" required></label>
            </form>
        `, `<button class="primary-btn" id="saveReschedule">Save Changes</button>`);
        byId("saveReschedule").addEventListener("click", () => {
            const form = byId("rescheduleForm");
            if (!form.reportValidity()) return;
            const formData = new FormData(form);
            const nextDoctor = state.doctors.find((doctor) => doctor.id === formData.get("doctorId"));
            const slotTaken = state.appointments.some((appointment) => appointment.id !== id && appointment.date === formData.get("date") && appointment.time === formData.get("time") && appointment.doctorId === formData.get("doctorId") && appointment.status !== "Cancelled");
            if (slotTaken) {
                showToast("That slot is already booked.");
                return;
            }
            item.date = formData.get("date");
            item.time = formData.get("time");
            item.doctorId = nextDoctor.id;
            item.doctor = nextDoctor.name;
            item.status = "Rescheduled";
            save(state);
            showToast("Appointment rescheduled.");
            closeModal();
            renderAppointmentTable();
        });
    }

    function openCancel(id) {
        openModal("Cancel Appointment", `
            <form class="form-grid" id="cancelForm">
                <label class="full"><span>Cancellation reason</span><textarea name="reason" rows="4" required></textarea></label>
            </form>
        `, `<button class="danger-btn" id="saveCancel">Confirm Cancellation</button>`);
        byId("saveCancel").addEventListener("click", () => {
            if (!byId("cancelForm").reportValidity()) return;
            updateAppointment(id, "Cancelled", "Appointment cancelled.");
        });
    }

    function openAppointmentCreate() {
        const state = data();
        openModal("Create Appointment", `
            <form class="form-grid" id="appointmentCreateForm">
                <label><span>Patient</span><select name="patientId">${state.patients.map((patient) => `<option value="${patient.id}">${patient.name}</option>`).join("")}</select></label>
                <label><span>Service</span><select name="service"><option>TCM Consultation</option><option>Acupuncture</option><option>Cupping</option><option>Herbal Medicine</option></select></label>
                <label><span>Date</span><input type="date" name="date" value="2026-10-06" required></label>
                <label><span>Time</span><input type="time" name="time" value="09:00" required></label>
                <label><span>Doctor</span><select name="doctorId">${state.doctors.map((doctor) => `<option value="${doctor.id}">${doctor.name}</option>`).join("")}</select></label>
                <label><span>Room</span><select name="room"><option>Room 01</option><option>Room 02</option><option>Room 03</option></select></label>
            </form>
        `, `<button class="primary-btn" id="saveAppointment">Create Appointment</button>`);
        byId("saveAppointment").addEventListener("click", () => {
            const form = byId("appointmentCreateForm");
            if (!form.reportValidity()) return;
            const formData = new FormData(form);
            const patient = state.patients.find((item) => item.id === formData.get("patientId"));
            const doctor = state.doctors.find((item) => item.id === formData.get("doctorId"));
            state.appointments.push({
                id: generateID("APT"),
                patientId: patient.id,
                patient: patient.name,
                contact: patient.phone,
                service: formData.get("service"),
                date: formData.get("date"),
                time: formData.get("time"),
                endTime: formData.get("time"),
                doctorId: doctor.id,
                doctor: doctor.name,
                room: formData.get("room"),
                status: "Scheduled"
            });
            save(state);
            showToast("Appointment created.");
            closeModal();
            renderAppointmentTable();
        });
    }

    function renderSchedule() {
        const state = data();
        const selectedDoctor = state.doctors[0];
        mountView("admin-schedule-view");
        byId("scheduleDoctor").innerHTML = state.doctors.map((doctor) => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.name)}</option>`).join("");
        byId("scheduleDoctorName").textContent = selectedDoctor.name;
        byId("scheduleDoctorAvatar").textContent = initials(selectedDoctor.name);
        byId("scheduleDoctor").addEventListener("change", () => {
            const doctor = data().doctors.find((item) => item.id === byId("scheduleDoctor").value);
            byId("scheduleDoctorName").textContent = doctor.name;
            fillScheduleForm();
        });
        fillScheduleForm();
    }

    function fillScheduleForm() {
        const state = data();
        const doctorId = byId("scheduleDoctor").value;
        const doctor = state.doctors.find((item) => item.id === doctorId);
        const schedule = state.schedules.find((item) => item.doctorId === doctorId);
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        drawScheduleCalendar(schedule);
        byId("scheduleForm").innerHTML = `
            <label class="full"><span>Weekly schedule</span><div class="weekday-grid">${days.map((day) => `<label><strong>${day.slice(0, 3)}</strong><input type="checkbox" name="days" value="${day}" ${schedule.workingDays.includes(day) ? "checked" : ""}></label>`).join("")}</div></label>
            <label><span>Morning Start</span><input type="time" name="morningStart" value="${schedule.morningStart}"></label>
            <label><span>Morning End</span><input type="time" name="morningEnd" value="${schedule.morningEnd}"></label>
            <label><span>Afternoon Start</span><input type="time" name="afternoonStart" value="${schedule.afternoonStart}"></label>
            <label><span>Afternoon End</span><input type="time" name="afternoonEnd" value="${schedule.afternoonEnd}"></label>
            <label><span>Appointment Duration</span><select name="slotDuration"><option>30</option><option>45</option><option>60</option></select></label>
            <label><span>Maximum Patients Per Slot</span><input type="number" name="capacity" min="1" value="${schedule.capacity}"></label>
            <hr class="full form-rule">
            <div class="full form-section-title"><h3>Date exceptions</h3><p>Block a date outside the weekly pattern</p></div>
            <label><span>Unavailable Date</span><input type="date" name="leaveDate"></label>
            <label><span>Reason</span><input name="leaveReason" placeholder="Doctor Leave"></label>
        `;
        byId("scheduleSaveBar").innerHTML = `<div><span class="nav-icon icon-calendar"></span><strong>${doctor.name} - ${schedule.workingDays.join(", ")}</strong><small>${schedule.morningStart}-${schedule.morningEnd} and ${schedule.afternoonStart}-${schedule.afternoonEnd} - ${schedule.slotDuration}-minute duration - ${schedule.capacity} patient per slot</small></div><button class="primary-btn" form="scheduleForm" type="submit">Save schedule</button>`;
        byId("scheduleForm").slotDuration.value = String(schedule.slotDuration);
        byId("scheduleForm").addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(event.target);
            schedule.workingDays = formData.getAll("days");
            schedule.morningStart = formData.get("morningStart");
            schedule.morningEnd = formData.get("morningEnd");
            schedule.afternoonStart = formData.get("afternoonStart");
            schedule.afternoonEnd = formData.get("afternoonEnd");
            schedule.slotDuration = Number(formData.get("slotDuration"));
            schedule.capacity = Number(formData.get("capacity"));
            if (formData.get("leaveDate")) {
                schedule.unavailable.push({ date: formData.get("leaveDate"), reason: formData.get("leaveReason") || "Doctor Leave" });
            }
            save(state);
            drawScheduleCalendar(schedule);
            showToast("Schedule saved.");
        });
    }

    function drawScheduleCalendar(schedule) {
        const days = [
            ["MON", "Monday", 5],
            ["TUE", "Tuesday", 6],
            ["WED", "Wednesday", 7],
            ["THU", "Thursday", 8],
            ["FRI", "Friday", 9],
            ["SAT", "Saturday", 10],
            ["SUN", "Sunday", 11]
        ];
        const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
        byId("scheduleCalendar").innerHTML = `<div class="weekly-grid"><div></div>${days.map(([abbr,, date]) => `<div class="schedule-day ${date === 6 ? "today" : ""}"><small>${abbr}</small><strong>${date}</strong></div>`).join("")}${hours.map((hour) => `<div class="hour-label">${formatTime(hour)}</div>${days.map(([, day]) => {
            const working = schedule.workingDays.includes(day);
            const morning = working && hour === schedule.morningStart;
            const afternoon = working && hour === schedule.afternoonStart;
            const off = !working && hour === "13:00";
            return `<div class="schedule-slot ${morning ? "slot-morning" : ""} ${afternoon ? "slot-afternoon" : ""}">${morning ? `${schedule.morningStart}-${schedule.morningEnd}<small>Morning<br>Available</small>` : afternoon ? `${schedule.afternoonStart}-${schedule.afternoonEnd}<small>Afternoon<br>Available</small>` : off ? "<span>Off</span>" : ""}</div>`;
        }).join("")}`).join("")}</div>`;
    }

    function renderPatients() {
        const user = current();
        const state = data();
        const submittedCount = state.patients.filter((patient) => patient.preConsultation.submitted).length;
        const rows = state.patients.map((patient, index) => {
            const appointments = state.appointments.filter((appointment) => appointment.patientId === patient.id && (user.role === "staff" || appointment.doctorId === user.id));
            return `<tr class="${index === 0 ? "selected-row" : ""}">
                <td>
                    <div class="directory-row">
                        ${patientAvatar(patient.name)}
                        <span><strong>${patient.name}</strong><small>${patient.id}</small><small>${patient.email}</small><small>${appointments.length} appointment${appointments.length === 1 ? "" : "s"}</small></span>
                        <span><small>${patient.phone}</small><small>${appointments.length ? `Last visit - ${shortDate(patient.lastVisit)}` : "No visits"}</small></span>
                    </div>
                </td>
                <td>${badge(patient.preConsultation.submitted ? "Submitted" : "Not submitted")}</td>
                <td><button class="text-link" data-patient="${patient.id}">${index === 0 ? "Selected" : "View"}</button></td>
            </tr>`;
        });
        mountView("admin-patient-view");
        byId("patientDirectoryCount").textContent = state.patients.length;
        byId("patientRecordCount").textContent = `${state.patients.length} records`;
        byId("submittedPreconsultCount").textContent = `${submittedCount} submitted`;
        byId("pendingPreconsultCount").textContent = `${state.patients.length - submittedCount} not submitted`;
        byId("patientTable").innerHTML = table(["Patient / Contact / Visits", "Pre-consultation", ""], rows);
        byId("patientSearch").addEventListener("input", (event) => {
            const query = event.target.value.toLowerCase();
            document.querySelectorAll("#patientTable tbody tr").forEach((row) => row.hidden = !row.textContent.toLowerCase().includes(query));
        });
        byId("patientCreateAppointment")?.addEventListener("click", openAppointmentCreate);
        document.querySelectorAll("[data-patient]").forEach((button) => button.addEventListener("click", () => drawPatientProfile(button.dataset.patient)));
        drawPatientProfile(state.patients[0].id);
    }

    function drawPatientProfile(id) {
        const state = data();
        const patient = state.patients.find((item) => item.id === id);
        const appointments = state.appointments.filter((item) => item.patientId === id);
        const panel = byId("patientProfile");
        if (!patient || !panel) return;
        panel.innerHTML = `
            <div class="patient-profile-head">${patientAvatar(patient.name)}<div><h2>${patient.name}</h2><span>${patient.id}</span></div></div>
            <section>
                <h3>Contact details</h3>
                <p><span class="nav-icon icon-message"></span><small>Email</small>${patient.email}</p>
                <p><span class="nav-icon icon-phone"></span><small>Phone</small>${patient.phone}</p>
            </section>
            <section>
                <h3>Visit information</h3>
                <dl class="detail-grid"><div><dt>Appointments</dt><dd>${appointments.length}</dd></div><div><dt>Last visit</dt><dd>${shortDate(patient.lastVisit)}</dd></div></dl>
            </section>
            <section>
                <div class="selected-head"><h3>Pre-consultation</h3>${badge(patient.preConsultation.submitted ? "Submitted" : "Not submitted")}</div>
                <p>Review the submitted pre-consultation before the patient's appointment.</p>
                <button class="secondary-btn" data-open-patient-modal="${patient.id}">View pre-consultation</button>
            </section>
            <div class="row-actions"><button class="primary-btn" data-open-patient-modal="${patient.id}">View patient</button><a class="secondary-btn" href="admin-appointments.html">Appointments</a></div>
        `;
        document.querySelectorAll("[data-open-patient-modal]").forEach((button) => button.addEventListener("click", () => openPatient(button.dataset.openPatientModal)));
    }

    function openPatient(id) {
        const state = data();
        const user = current();
        const patient = state.patients.find((item) => item.id === id);
        const pre = patient.preConsultation;
        openModal("Patient Profile", `
            <dl>
                <dt>Name</dt><dd>${patient.name}</dd><dt>Email</dt><dd>${patient.email}</dd><dt>Phone</dt><dd>${patient.phone}</dd><dt>Date Joined</dt><dd>${shortDate(patient.joined)}</dd>
                <dt>Appointment History</dt><dd>${state.appointments.filter((item) => item.patientId === id).map((item) => `${item.id} ${item.service} ${badge(item.status)}`).join("<br>") || "No appointments"}</dd>
                <dt>Pre-Consultation</dt><dd>${pre.submitted ? "Submitted" : "Not submitted"}</dd>
                ${user.role === "doctor" && pre.submitted ? `<dt>Wellness Details</dt><dd>Energy: ${pre.energy}<br>Sleep: ${pre.sleep}<br>Digestion: ${pre.digestion}<br>Temperature: ${pre.temperature}<br>Mood: ${pre.mood}<br>Concerns: ${pre.concerns}<br>Notes: ${pre.notes}</dd>` : ""}
                ${user.role === "doctor" ? `<dt>Care Plans</dt><dd>${state.carePlans.filter((plan) => plan.patientId === id).length} saved care plan(s)</dd>` : ""}
            </dl>
        `);
    }

    function latestCarePlan(state, appointmentId) {
        return state.carePlans
            .filter((plan) => plan.appointmentId === appointmentId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }

    function careCommandFormula(state, notes) {
        if (notes.formula) return notes.formula;
        if (notes.productId) {
            return state.products.find((product) => product.id === notes.productId)?.name || "";
        }
        return "";
    }

    function careFollowUpDays(notes) {
        const options = ["3 days", "7 days", "14 days"];
        if (options.includes(notes.followUpRecommendation)) {
            return notes.followUpRecommendation;
        }
        return options.includes(notes.followUp) ? notes.followUp : "";
    }

    function renderCarePlan() {
        const user = current();
        const state = data();
        const params = new URLSearchParams(location.search);
        const visibleAppointments = state.appointments.filter((item) => user.role !== "doctor" || item.doctorId === user.id);
        const selected = visibleAppointments.find((item) => item.id === params.get("appointment")) || visibleAppointments[0];

        mountView("admin-care-plan-view");
        byId("carePlanDescription").textContent = user.role === "doctor"
            ? "Select a patient appointment to write or update clinical notes."
            : "Select a patient appointment to view the doctor's clinical notes.";
        byId("carePlanRecordCount").textContent = `${visibleAppointments.length} records`;
        byId("careDoctor").innerHTML = user.role === "doctor"
            ? `<option value="${escapeHtml(user.id)}">My Appointments</option>`
            : `<option value="">All Doctors</option>${state.doctors.map((doctor) => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.name)}</option>`).join("")}`;
        byId("careDoctor").disabled = user.role === "doctor";

        if (user.role === "doctor") byId("careDoctor").value = user.id;
        ["careSearch", "careDate", "careDoctor", "careService", "careStatus"].forEach((id) => {
            byId(id).addEventListener(id === "careSearch" ? "input" : "change", () => drawCarePlanList());
        });
        drawCarePlanList(selected?.id);
    }

    function filteredCareAppointments() {
        const user = current();
        const state = data();
        const query = (byId("careSearch")?.value || "").toLowerCase();
        const dateFilter = byId("careDate")?.value || "";
        const doctorFilter = user.role === "doctor" ? user.id : byId("careDoctor")?.value;
        const serviceFilter = byId("careService")?.value;
        const statusFilter = byId("careStatus")?.value;
        return state.appointments.filter((item) => {
            const plan = latestCarePlan(state, item.id);
            const planStatus = plan?.status || "No care plan";
            return (user.role !== "doctor" || item.doctorId === user.id) &&
                (!query || `${item.id} ${item.patient} ${item.contact}`.toLowerCase().includes(query)) &&
                (!dateFilter || String(item.date).slice(0, 10) === dateFilter) &&
                (!doctorFilter || item.doctorId === doctorFilter) &&
                (!serviceFilter || item.service === serviceFilter) &&
                (!statusFilter || planStatus === statusFilter);
        });
    }

    function drawCarePlanList(selectedId) {
        const state = data();
        const records = filteredCareAppointments();
        const selected = records.find((item) => item.id === selectedId) || records[0];
        byId("carePlanList").innerHTML = table(
            ["Patient / Contact", "Service", "Date / Time", "Doctor / Room", "Care Plan", "Actions"],
            records.map((item) => {
                const plan = latestCarePlan(state, item.id);
                return `
                    <tr class="${selected?.id === item.id ? "selected-row" : ""}">
                        <td><div class="person-cell">${patientAvatar(item.patient)}<span><strong>${item.patient}</strong><small>${item.id}<br>${item.contact}</small></span></div></td>
                        <td>${item.service}</td>
                        <td><strong>${shortDate(item.date)}</strong><br><small>${formatTime(item.time)}</small></td>
                        <td>${item.doctor}<br><small>${item.room}</small></td>
                        <td>${badge(plan?.status || "No care plan")}</td>
                        <td><button class="text-link" data-select-care="${item.id}">${selected?.id === item.id ? "Selected" : "View"}</button></td>
                    </tr>
                `;
            })
        );
        document.querySelectorAll("[data-select-care]").forEach((button) => button.addEventListener("click", () => {
            drawCarePlanList(button.dataset.selectCare);
        }));
        drawCarePlanDetail(selected);
    }

    function drawCarePlanDetail(appointment) {
        const state = data();
        const user = current();
        const panel = byId("carePlanDetail");
        if (!panel) return;
        if (!appointment) {
            panel.innerHTML = `<section class="panel"><h2>No appointment selected</h2><p>No matching appointment found for the current filters.</p></section>`;
            return;
        }
        const patient = state.patients.find((item) => item.id === appointment.patientId);
        const pre = patient?.preConsultation || {};
        const plan = latestCarePlan(state, appointment.id);
        const notes = plan?.notes || {};
        panel.innerHTML = `
            <div class="care-header">
                <div><strong>Patient</strong><br>${patient.name}</div><div><strong>Appointment</strong><br>${appointment.id}</div><div><strong>Service</strong><br>${appointment.service}</div><div><strong>Status</strong><br>${badge(appointment.status)}</div>
            </div>
            <section class="panel">
                <h2>Pre-consultation Summary</h2>
                <div class="kpi-grid" style="margin-top:14px">
                    ${["energy", "sleep", "digestion", "temperature", "mood", "concerns", "notes"].map((key) => `<div class="pre-card"><strong>${key}</strong>${pre[key] || "Not submitted"}</div>`).join("")}
                </div>
            </section>
            ${user.role === "doctor" ? carePlanForm(state, appointment, notes) : carePlanReadOnly(state, plan)}
        `;
        if (user.role === "doctor") bindCarePlanForm(appointment, patient);
    }

    function carePlanForm(state, appointment, notes) {
        const followUpDays = careFollowUpDays(notes);
        return `
            <section class="panel" style="margin-top:18px">
                <h2>Doctor Consultation</h2>
                <form class="form-grid" id="carePlanForm">
                    <label class="full"><span>Doctor Notes — Patient Problem</span><textarea name="notes" rows="5" placeholder="Record the patient's main problem and relevant consultation notes.">${escapeHtml(notes.notes || "")}</textarea></label>
                    <div class="care-command-heading full"><h3>Care Command</h3><p>Instructions for staff to prepare and coordinate the patient's care.</p></div>
                    <label class="full"><span>Traditional Chinese Medicine / Medicine to Prepare</span><textarea name="formula" rows="3" placeholder="Enter the formula or medicine staff should prepare. This is separate from products sold in the shop.">${escapeHtml(careCommandFormula(state, notes))}</textarea></label>
                    <label><span>Medicine Supply (Days)</span><input name="daysSupply" placeholder="e.g. 7 days" value="${escapeHtml(notes.daysSupply || "")}"></label>
                    <label class="full"><span>Follow-up Recommendation</span><select name="followUpRecommendation"><option value="">Select follow-up timing</option>${["3 days", "7 days", "14 days"].map((days) => `<option value="${days}" ${followUpDays === days ? "selected" : ""}>${days}</option>`).join("")}</select></label>
                    <label class="full"><button class="secondary-btn" type="button" id="saveDraft">Save Draft</button> <button class="primary-btn" type="submit">Save Care Plan</button> <button class="secondary-btn" type="button" id="printCarePlan">Print Care Plan</button> <button class="danger-btn" type="button" id="completeConsultation">Complete Consultation</button></label>
                </form>
            </section>
        `;
    }

    function carePlanReadOnly(state, plan) {
        const notes = plan?.notes || {};
        if (!plan) {
            return `<section class="panel staff-care-command" style="margin-top:18px"><h2>Care Command for Staff</h2><p>The doctor has not saved care instructions for this appointment yet.</p></section>`;
        }
        const followUpRecommendation =
            careFollowUpDays(notes) || "No follow-up recommendation recorded";
        return `
            <section class="panel staff-care-command" style="margin-top:18px">
                <div class="selected-head"><div><h2>Care Command for Staff</h2><p>Preparation and follow-up instructions from the doctor.</p></div>${badge(plan.status)}</div>
                <dl class="detail-grid care-command-details">
                    <div><dt>Medicine / Formula to Prepare</dt><dd>${escapeHtml(careCommandFormula(state, notes) || "Not specified")}</dd></div>
                    <div><dt>Medicine Supply</dt><dd>${escapeHtml(notes.daysSupply || "Not specified")}</dd></div>
                    <div class="care-command-follow-up"><dt>Follow-up Recommendation</dt><dd>${escapeHtml(followUpRecommendation)}</dd></div>
                </dl>
            </section>
        `;
    }

    function bindCarePlanForm(appointment, patient) {
        function savePlan(status) {
            const state = data();
            const formData = new FormData(byId("carePlanForm"));
            const existing = latestCarePlan(state, appointment.id);
            const previousNotes = { ...(existing?.notes || {}) };
            delete previousNotes.productId;
            const nextPlan = {
                id: existing?.id || generateID("CARE"),
                appointmentId: appointment.id,
                patientId: patient.id,
                doctorId: appointment.doctorId,
                status,
                createdAt: new Date().toISOString(),
                notes: {
                    ...previousNotes,
                    ...Object.fromEntries(formData.entries())
                }
            };
            if (existing) {
                state.carePlans = state.carePlans.map((plan) => plan.id === existing.id ? nextPlan : plan);
            } else {
                state.carePlans.push(nextPlan);
            }
            save(state);
            showToast(status === "Draft" ? "Draft saved." : "Care plan saved.");
            drawCarePlanList(appointment.id);
        }
        byId("saveDraft").addEventListener("click", () => savePlan("Draft"));
        byId("carePlanForm").addEventListener("submit", (event) => {
            event.preventDefault();
            savePlan("Saved");
        });
        byId("printCarePlan").addEventListener("click", () => window.print());
        byId("completeConsultation").addEventListener("click", () => {
            const state = data();
            const item = state.appointments.find((record) => record.id === appointment.id);
            if (item) item.status = "Completed";
            save(state);
            savePlan("Completed");
            showToast("Consultation completed.");
        });
    }

    function renderProducts() {
        mountView("admin-product-view");
        ["productSearch", "productCategory", "productStatus"].forEach((id) => byId(id).addEventListener("input", drawProducts));
        byId("addProduct").addEventListener("click", () => openProductForm());
        drawProducts();
    }

    function accountDirectory(state) {
        return [
            ...(Array.isArray(state.staff) ? state.staff : []),
            ...(Array.isArray(state.doctors) ? state.doctors : [])
        ].sort((a, b) => a.name.localeCompare(b.name));
    }

    function renderAccounts() {
        const state = data();
        const staffCount = Array.isArray(state.staff) ? state.staff.length : 0;
        const doctorCount = Array.isArray(state.doctors) ? state.doctors.length : 0;
        mountView("admin-account-view");
        byId("staffAccountCount").textContent = staffCount;
        byId("doctorAccountCount").textContent = doctorCount;
        byId("totalAccountCount").textContent = staffCount + doctorCount;
        byId("generateAccount").addEventListener("click", openAccountForm);
        byId("accountSearch").addEventListener("input", drawAccounts);
        byId("accountTypeFilter").addEventListener("change", drawAccounts);
        drawAccounts();
    }

    function drawAccounts() {
        const state = data();
        const query = byId("accountSearch").value.trim().toLowerCase();
        const type = byId("accountTypeFilter").value;
        const rows = accountDirectory(state)
            .filter((account) => (!type || account.role === type) &&
                (!query || `${account.name} ${account.email} ${account.staffId}`.toLowerCase().includes(query)))
            .map((account) => `
                <tr>
                    <td><span class="account-person"><span class="avatar mini-avatar">${escapeHtml(account.avatar || initials(account.name))}</span><strong>${escapeHtml(account.name)}</strong></span></td>
                    <td>${escapeHtml(account.staffId)}</td>
                    <td>${escapeHtml(account.email)}</td>
                    <td><span class="badge ${account.role === "doctor" ? "scheduled" : "active"}">${account.role === "doctor" ? "Doctor" : "Staff"}</span></td>
                </tr>
            `);
        byId("accountTable").innerHTML = table(["Name", "Sign-in ID", "Email", "Account type"], rows);
    }

    function secureRandomBelow(limit) {
        if (!window.crypto?.getRandomValues) {
            throw new Error("Secure password generation is unavailable in this browser.");
        }
        const range = 0x100000000;
        const ceiling = range - range % limit;
        const value = new Uint32Array(1);
        do {
            window.crypto.getRandomValues(value);
        } while (value[0] >= ceiling);
        return value[0] % limit;
    }

    function temporaryPassword() {
        const lower = "abcdefghijkmnopqrstuvwxyz";
        const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const digits = "23456789";
        const symbols = "!@#$%*-_";
        const all = lower + upper + digits + symbols;
        const characters = [
            lower[secureRandomBelow(lower.length)],
            upper[secureRandomBelow(upper.length)],
            digits[secureRandomBelow(digits.length)],
            symbols[secureRandomBelow(symbols.length)]
        ];
        while (characters.length < 16) characters.push(all[secureRandomBelow(all.length)]);
        for (let index = characters.length - 1; index > 0; index -= 1) {
            const swapIndex = secureRandomBelow(index + 1);
            [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
        }
        return characters.join("");
    }

    function uniqueAccountIdentifiers(role, state) {
        const users = accountDirectory(state);
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const suffix = String(100000 + secureRandomBelow(900000));
            const staffId = role === "doctor" ? `doctor${suffix}` : `staff${suffix}`;
            if (users.some((user) => user.staffId.toLowerCase() === staffId)) continue;
            return {
                id: `${role === "doctor" ? "dr" : "staff"}-${suffix}`,
                staffId
            };
        }
        throw new Error("Could not generate a unique sign-in ID. Please try again.");
    }

    function openAccountForm() {
        openModal("Generate clinic account", `
            <p class="account-form-intro">A secure temporary password will be generated for the new account. Save it and share it with the account holder.</p>
            <form class="form-grid" id="accountForm" autocomplete="off">
                <label class="full"><span>Full name</span><input name="name" maxlength="100" required autocomplete="name" placeholder="e.g. Alex Tan"></label>
                <label class="full"><span>Email address</span><input name="email" type="email" maxlength="254" required autocomplete="email" placeholder="name@example.com"></label>
                <label class="full"><span>Account type</span><select name="role" required><option value="staff">Clinic staff</option><option value="doctor">Doctor</option></select></label>
            </form>
        `, `<button class="primary-btn" id="saveGeneratedAccount" type="button">Generate account</button>`, { closeOnBackdrop: false });
        byId("saveGeneratedAccount").addEventListener("click", async () => {
            const form = byId("accountForm");
            if (!form.reportValidity()) return;
            const formData = new FormData(form);
            const name = String(formData.get("name") || "").trim();
            const email = String(formData.get("email") || "").trim().toLowerCase();
            const role = String(formData.get("role"));
            const state = data();
            const previousState = structuredClone(state);
            if (!name || !email || !["staff", "doctor"].includes(role)) return;
            if (accountDirectory(state).some((account) => account.email.trim().toLowerCase() === email)) {
                showToast("An account already uses this email address.");
                return;
            }

            try {
                const identifiers = uniqueAccountIdentifiers(role, state);
                const password = temporaryPassword();
                const account = {
                    ...identifiers,
                    name,
                    email,
                    password,
                    role,
                    avatar: initials(name)
                };
                if (role === "doctor") {
                    account.services = [];
                    state.doctors.push(account);
                } else {
                    state.staff.push(account);
                }
                if (!await save(state)) {
                    window.TcmAdminData.restore(previousState);
                    closeModal();
                    renderAccounts();
                    return;
                }
                closeModal();
                renderAccounts();
                openGeneratedAccount(account);
            } catch (error) {
                showToast(error.message || "Could not generate the account. Please try again.");
            }
        });
    }

    function openGeneratedAccount(account) {
        openModal("Account generated", `
            <div class="account-created-notice">Copy and share these sign-in details now. The temporary password will not appear again.</div>
            <div class="account-credentials">
                <label><span>Account type</span><input value="${account.role === "doctor" ? "Doctor" : "Clinic staff"}" readonly></label>
                <label><span>Sign-in ID</span><input id="generatedAccountId" value="${escapeHtml(account.staffId)}" readonly></label>
                <label><span>Email</span><input id="generatedAccountEmail" value="${escapeHtml(account.email)}" readonly></label>
                <label><span>Temporary password</span><input id="generatedAccountPassword" value="${escapeHtml(account.password)}" readonly></label>
            </div>
        `, `<button class="secondary-btn" id="copyAccountCredentials" type="button">Copy sign-in details</button><button class="primary-btn" id="closeAccountCredentials" type="button">Done</button>`, { closeOnBackdrop: false });
        byId("copyAccountCredentials").addEventListener("click", async () => {
            const details = `Sign-in ID: ${account.staffId}\nEmail: ${account.email}\nTemporary password: ${account.password}`;
            try {
                await navigator.clipboard.writeText(details);
                showToast("Sign-in details copied.");
            } catch {
                showToast("Copy is unavailable here. Select and copy the sign-in details.");
            }
        });
        byId("closeAccountCredentials").addEventListener("click", closeModal);
    }

    function drawProducts() {
        const state = data();
        const query = byId("productSearch").value.toLowerCase();
        const categorySelect = byId("productCategory");
        const selectedCategory = categorySelect.value;
        categorySelect.innerHTML = `<option value="">All</option>${productCategories(state.products).map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
        categorySelect.value = selectedCategory;
        const category = categorySelect.value;
        const status = byId("productStatus").value;
        const rows = state.products.filter((item) => {
            const computedStatus = item.stock <= 0 ? "Out of Stock" : item.stock <= item.lowStockThreshold ? "Low Stock" : item.status;
            return (!query || item.name.toLowerCase().includes(query)) && (!category || item.category === category) && (!status || computedStatus === status || item.status === status);
        }).map((item) => {
            const computedStatus = item.stock <= 0 ? "Out of Stock" : item.stock <= item.lowStockThreshold ? "Low Stock" : item.status;
            return `<tr><td><div class="avatar">${item.name.slice(0, 2).toUpperCase()}</div></td><td>${item.name}</td><td>${item.category}</td><td>${money(item.price)}</td><td>${item.stock}</td><td>${badge(computedStatus)}</td><td>${shortDate(item.updatedAt)}</td><td class="row-actions"><button class="mini-btn" data-edit-product="${item.id}">Edit</button><button class="mini-btn" data-stock-product="${item.id}">Stock</button><button class="mini-btn" data-toggle-product="${item.id}">${item.status === "Active" ? "Deactivate" : "Activate"}</button><button class="mini-btn" data-delete-product="${item.id}">Delete</button></td></tr>`;
        });
        byId("productTable").innerHTML = table(["Image", "Product Name", "Category", "Price", "Stock", "Status", "Last Updated", "Actions"], rows);
        bindProductButtons();
    }

    function bindProductButtons() {
        document.querySelectorAll("[data-edit-product]").forEach((button) => button.addEventListener("click", () => openProductForm(button.dataset.editProduct)));
        document.querySelectorAll("[data-stock-product]").forEach((button) => button.addEventListener("click", () => openStockAdjust(button.dataset.stockProduct)));
        document.querySelectorAll("[data-toggle-product]").forEach((button) => button.addEventListener("click", () => {
            const state = data();
            const item = state.products.find((product) => product.id === button.dataset.toggleProduct);
            item.status = item.status === "Active" ? "Inactive" : "Active";
            item.updatedAt = "2026-10-06";
            save(state);
            drawProducts();
        }));
        document.querySelectorAll("[data-delete-product]").forEach((button) => button.addEventListener("click", () => {
            if (!confirm("Delete this product?")) return;
            const state = data();
            state.products = state.products.filter((product) => product.id !== button.dataset.deleteProduct);
            save(state);
            drawProducts();
        }));
    }

    function openProductForm(id) {
        const state = data();
        const item = state.products.find((product) => product.id === id) || { id: "", name: "", category: "Bird's Nest", description: "", ingredients: "", instructions: "", precautions: "", price: "", stock: "", lowStockThreshold: 5, image: "", status: "Active" };
        const categorySuggestions = productCategories(state.products)
            .map((category) => `<option value="${escapeHtml(category)}"></option>`)
            .join("");
        const imagePreview = item.image
            ? `<img class="product-photo-preview" id="productPhotoPreview" src="${escapeHtml(item.image)}" alt="Current product photo">`
            : `<p class="product-photo-empty" id="productPhotoEmpty">No photo selected.</p>`;
        openModal(id ? "Edit Product" : "Add Product", `
            <form class="form-grid" id="productForm">
                <label><span>Product Name</span><input name="name" value="${escapeHtml(item.name)}" required></label>
                <label><span>Category</span><input name="category" value="${escapeHtml(item.category)}" list="productCategorySuggestions" required><datalist id="productCategorySuggestions">${categorySuggestions}</datalist></label>
                <label class="full"><span>Description</span><textarea name="description" rows="3">${escapeHtml(item.description)}</textarea></label>
                <label class="full"><span>Ingredients (Gram Measurements)</span><textarea name="ingredients" rows="3" placeholder="List each ingredient and its amount in grams">${escapeHtml(item.ingredients)}</textarea></label>
                <label class="full"><span>Instructions</span><textarea name="instructions" rows="3" placeholder="How to prepare or use this product">${escapeHtml(item.instructions)}</textarea></label>
                <label class="full"><span>Precautions</span><textarea name="precautions" rows="3" placeholder="Warnings, allergies, or who should avoid this product">${escapeHtml(item.precautions)}</textarea></label>
                <label><span>Price</span><input type="number" name="price" min="0" step="0.01" value="${item.price}" required></label>
                <label><span>Stock Quantity</span><input type="number" name="stock" min="0" value="${item.stock}" required></label>
                <label><span>Low Stock Threshold</span><input type="number" name="lowStockThreshold" min="0" value="${item.lowStockThreshold}" required></label>
                <label class="full"><span>Product Photo</span><input id="productPhoto" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small>Choose PNG, JPEG, WebP or GIF, up to 1 MB.</small>${imagePreview}</label>
                ${item.image ? `<label class="full product-photo-remove"><input name="removeImage" type="checkbox"><span>Remove current photo when saving</span></label>` : ""}
                <label><span>Status</span><select name="status"><option>Active</option><option>Inactive</option></select></label>
            </form>
        `, `<button class="primary-btn" id="saveProduct">Save Product</button>`, { closeOnBackdrop: false });
        byId("productForm").status.value = item.status;
        let selectedImage = item.image || "";
        const photoInput = byId("productPhoto");
        const saveButton = byId("saveProduct");

        photoInput.addEventListener("change", () => {
            const file = photoInput.files[0];
            if (!file) return;

            const supportedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
            if (!supportedTypes.includes(file.type)) {
                photoInput.value = "";
                showToast("Choose a PNG, JPEG, WebP or GIF image.");
                return;
            }

            if (file.size > 1024 * 1024) {
                photoInput.value = "";
                showToast("Choose an image smaller than 1 MB.");
                return;
            }

            saveButton.disabled = true;
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                if (typeof reader.result !== "string") {
                    showToast("Could not read this image. Please choose another file.");
                    saveButton.disabled = false;
                    return;
                }

                selectedImage = reader.result;
                let preview = byId("productPhotoPreview");
                if (!preview) {
                    preview = document.createElement("img");
                    preview.className = "product-photo-preview";
                    preview.id = "productPhotoPreview";
                    preview.alt = "Selected product photo";
                    byId("productPhotoEmpty")?.replaceWith(preview);
                }
                preview.src = selectedImage;
                byId("productForm").elements.removeImage && (byId("productForm").elements.removeImage.checked = false);
                saveButton.disabled = false;
            });
            reader.addEventListener("error", () => {
                console.error("Could not read selected product photo.", reader.error);
                photoInput.value = "";
                saveButton.disabled = false;
                showToast("Could not read this image. Please choose another file.");
            });
            reader.readAsDataURL(file);
        });

        saveButton.addEventListener("click", () => {
            const form = byId("productForm");
            if (!form.reportValidity()) return;
            const formData = Object.fromEntries(new FormData(form).entries());
            delete formData.removeImage;
            const payload = {
                ...item,
                ...formData,
                image: form.elements.removeImage?.checked ? "" : selectedImage,
                price: Number(formData.price),
                stock: Number(formData.stock),
                lowStockThreshold: Number(formData.lowStockThreshold),
                updatedAt: "2026-10-06"
            };
            if (id) {
                Object.assign(state.products.find((product) => product.id === id), payload);
            } else {
                payload.id = generateID("PROD");
                state.products.push(payload);
            }
            try {
                save(state);
            } catch (error) {
                console.error("Could not save product to browser storage.", error);
                showToast("Could not save product. Try a smaller photo or free browser storage.");
                return;
            }
            closeModal();
            drawProducts();
            showToast("Product saved.");
        });
    }

    function openStockAdjust(id) {
        const state = data();
        const item = state.products.find((product) => product.id === id);
        openModal("Stock Adjustment", `
            <form class="form-grid" id="stockForm">
                <label><span>Current Stock</span><input value="${item.stock}" disabled></label>
                <label><span>Adjustment</span><select name="direction"><option value="+">+</option><option value="-">-</option></select></label>
                <label><span>Quantity</span><input type="number" name="quantity" min="1" value="1"></label>
                <label><span>Reason</span><input name="reason" value="Stock received"></label>
            </form>
        `, `<button class="primary-btn" id="saveStock">Save Adjustment</button>`);
        byId("saveStock").addEventListener("click", () => {
            const formData = new FormData(byId("stockForm"));
            const amount = Number(formData.get("quantity"));
            item.stock += formData.get("direction") === "+" ? amount : -amount;
            item.stock = Math.max(0, item.stock);
            item.updatedAt = "2026-10-06";
            save(state);
            closeModal();
            drawProducts();
            showToast("Stock updated.");
        });
    }

    function renderOrders() {
        const state = data();
        mountView("admin-order-view");
        byId("orderStatus").value = new URLSearchParams(location.search).get("status") || "";
        ["orderIdSearch", "orderDateFilter"].forEach((id) => {
            byId(id).addEventListener(id === "orderIdSearch" ? "input" : "change", drawOrders);
        });
        ["orderStatus", "orderPayment"].forEach((id) => byId(id).addEventListener("change", drawOrders));
        drawOrders();
    }

    function drawOrders() {
        const state = data();
        const orderIdQuery = byId("orderIdSearch").value.trim().toLowerCase();
        const orderDate = byId("orderDateFilter").value;
        const rows = state.orders.filter((order) =>
            (!orderIdQuery || String(order.id).toLowerCase().includes(orderIdQuery)) &&
            (!orderDate || String(order.date).slice(0, 10) === orderDate) &&
            (!byId("orderStatus").value || order.status === byId("orderStatus").value) &&
            (!byId("orderPayment").value || order.paymentMethod === byId("orderPayment").value)
        ).map((order) => `
            <tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.customer)}</td><td>${shortDate(order.date)}</td><td>${order.items.length}</td><td>${money(order.total)}</td><td>${escapeHtml(order.paymentMethod)}</td><td>${badge(order.status)}</td><td><button class="mini-btn" data-order="${escapeHtml(order.id)}">View</button></td></tr>
        `);
        byId("orderTable").innerHTML = table(["Order ID", "Customer", "Order Date", "Items", "Total", "Payment Method", "Status", "Actions"], rows);
        document.querySelectorAll("[data-order]").forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.order)));
    }

    function openOrder(id) {
        const state = data();
        const order = state.orders.find((item) => item.id === id);
        openModal("Order Information", `
            <dl><dt>Order ID</dt><dd>${escapeHtml(order.id)}</dd><dt>Customer</dt><dd>${escapeHtml(order.customer)}</dd><dt>Phone</dt><dd>${escapeHtml(order.phone || "Not provided")}</dd><dt>Date</dt><dd>${shortDate(order.date)}</dd><dt>Payment</dt><dd>${escapeHtml(order.paymentMethod)}</dd><dt>Products</dt><dd>${order.items.map((item) => `${escapeHtml(item.name)} x ${Number(item.quantity) || 0} ${money(item.price * item.quantity)}`).join("<br>")}<br><strong>Total ${money(order.total)}</strong></dd></dl>
            <form class="form-grid" id="shippingForm"><label><span>Courier</span><input name="courier" value="${escapeHtml(order.courier || "")}" placeholder="J&T Express"></label><label><span>Tracking Number</span><input name="tracking" value="${escapeHtml(order.tracking || "")}" placeholder="JNT123456789"></label></form>
        `, `<button class="secondary-btn" data-order-status="Packed">Mark Packed</button><button class="secondary-btn" data-order-status="Shipped">Mark Shipped</button><button class="primary-btn" data-order-status="Completed">Complete</button>`);
        document.querySelectorAll("[data-order-status]").forEach((button) => button.addEventListener("click", () => {
            const formData = new FormData(byId("shippingForm"));
            order.courier = formData.get("courier");
            order.tracking = formData.get("tracking");
            order.status = button.dataset.orderStatus;
            save(state);
            closeModal();
            drawOrders();
            showToast("Order updated.");
        }));
    }

    function renderMessages() {
        const state = data();
        const user = current();
        const messages = state.messages.filter((item) => user.role === "staff" || item.doctorId === user.id);
        if (!messages.some((item) => item.id === activeMessageId)) {
            activeMessageId = messages[0]?.id || "";
        }

        mountView("admin-message-view");

        byId("messageSearch").addEventListener("input", drawMessageList);
        drawMessageList();
        if (activeMessageId) openMessage(activeMessageId);
        else renderEmptyMessage();
    }

    function drawMessageList() {
        const state = data();
        const user = current();
        const query = byId("messageSearch").value.trim().toLowerCase();
        const messages = state.messages
            .filter((item) => user.role === "staff" || item.doctorId === user.id)
            .filter((item) =>
                `${item.patient} ${item.patientEmail || ""} ${item.messages.at(-1)?.text || ""}`
                    .toLowerCase()
                    .includes(query)
            );
        const list = byId("messageConversationList");

        if (messages.length === 0) {
            list.innerHTML = `<p class="admin-message-empty-list">${query ? "No conversations found." : "No conversations yet."}</p>`;
            return;
        }

        list.innerHTML = messages.map((thread) => {
            const initials = String(thread.patient || "P")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();
            const preview = thread.messages.at(-1)?.text || "No messages yet";

            return `
                <button type="button" class="admin-conversation-item${thread.id === activeMessageId ? " active" : ""}" data-message="${escapeHtml(thread.id)}">
                    <span class="admin-conversation-avatar">${escapeHtml(initials)}</span>
                    <span class="admin-conversation-summary">
                        <strong>${escapeHtml(thread.patient)}</strong>
                        <span>${escapeHtml(preview)}</span>
                    </span>
                    <span class="admin-conversation-meta">
                        <span>${escapeHtml(thread.lastTime || "")}</span>
                        ${thread.unread ? `<span class="admin-unread-count">${thread.unread}</span>` : ""}
                    </span>
                </button>`;
        }).join("");

        list.querySelectorAll("[data-message]").forEach((button) => {
            button.addEventListener("click", () => openMessage(button.dataset.message));
        });
    }

    function renderEmptyMessage() {
        byId("chatWindow").innerHTML = `
            <div class="admin-chat-empty">
                <span class="admin-chat-empty-icon">✉</span>
                <h3>Select a conversation</h3>
                <p>Patient messages will appear here.</p>
            </div>`;
    }

    function openMessage(id) {
        const state = data();
        const thread = state.messages.find((item) => item.id === id);
        if (!thread) return;
        activeMessageId = id;
        const replies = current().role === "staff"
            ? ["Your appointment has been confirmed.", "Please arrive 10 minutes early.", "Your appointment has been rescheduled.", "Your order has been shipped."]
            : ["Thank you for your message.", "Please follow the care instructions provided.", "We recommend discussing this during your next consultation."];
        thread.unread = 0;
        save(state);
        drawMessageList();
        const initials = String(thread.patient || "P")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase();
        byId("chatWindow").innerHTML = `
            <header class="admin-chat-heading">
                <span class="admin-conversation-avatar">${escapeHtml(initials)}</span>
                <div>
                    <h3>${escapeHtml(thread.patient)}</h3>
                    <p>${escapeHtml(thread.patientEmail || "Patient conversation")}</p>
                </div>
            </header>
            <div class="admin-chat-messages" id="adminChatMessages" aria-live="polite">
                <div class="admin-message-date">Recent messages</div>
                ${thread.messages.map((message) => `
                    <article class="admin-chat-bubble ${message.from === "patient" ? "incoming" : "outgoing"}">
                        <div>${escapeHtml(message.text)}</div>
                        <time>${escapeHtml(message.time)}</time>
                    </article>`).join("")}
            </div>
            <form class="admin-message-form" id="messageReply">
                <div class="admin-message-composer">
                    <textarea name="text" rows="1" maxlength="1000" placeholder="Write a message..." aria-label="Write a message"></textarea>
                    <button class="primary-btn" type="submit">Send</button>
                </div>
                <label class="admin-quick-reply"><span>Quick reply</span><select id="quickReply"><option value="">Choose a reply (optional)</option>${replies.map((reply) => `<option>${escapeHtml(reply)}</option>`).join("")}</select></label>
            </form>`;
        const chatMessages = byId("adminChatMessages");
        chatMessages.scrollTop = chatMessages.scrollHeight;
        byId("quickReply").addEventListener("change", (event) => {
            byId("messageReply").elements.text.value = event.target.value;
        });
        byId("messageReply").addEventListener("submit", (event) => {
            event.preventDefault();
            const text = event.target.elements.text.value.trim();
            if (!text) return;
            thread.messages.push({ from: current().role, text, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
            thread.lastTime = thread.messages.at(-1).time;
            save(state);
            openMessage(id);
        });
    }

    function renderFeedback() {
        const state = data();
        const rows = state.feedback.map((item) => `<tr><td>${"★".repeat(item.rating)}</td><td>${item.patient}</td><td>${item.service}</td><td>${item.doctor}</td><td>${item.comment}</td><td>${shortDate(item.date)}</td><td class="row-actions"><button class="mini-btn">View</button><button class="mini-btn">Reply</button><button class="mini-btn">Mark as Featured</button><button class="mini-btn">Hide</button></td></tr>`);
        mountView("admin-feedback-view");
        byId("feedbackTable").innerHTML = table(["Rating", "Patient", "Service", "Doctor", "Comment", "Date", "Actions"], rows);
    }

    function renderAnnouncements() {
        const state = data();
        mountView("admin-announcement-view");
        byId("newAnnouncement").addEventListener("click", () => openAnnouncementForm());
        drawAnnouncements();
    }

    function drawAnnouncements() {
        const state = data();
        const rows = state.announcements.map((item) => `<tr><td>${item.title}</td><td>${item.type}</td><td>${shortDate(item.publishDate)}</td><td>${badge(item.status)}</td><td class="row-actions"><button class="mini-btn" data-announcement="${item.id}">Edit</button><button class="mini-btn" data-publish="${item.id}">${item.status === "Published" ? "Unpublish" : "Publish"}</button><button class="mini-btn" data-delete-ann="${item.id}">Delete</button></td></tr>`);
        byId("announcementTable").innerHTML = table(["Title", "Type", "Published Date", "Status", "Actions"], rows);
        document.querySelectorAll("[data-announcement]").forEach((button) => button.addEventListener("click", () => openAnnouncementForm(button.dataset.announcement)));
        document.querySelectorAll("[data-publish]").forEach((button) => button.addEventListener("click", () => {
            const state = data();
            const item = state.announcements.find((ann) => ann.id === button.dataset.publish);
            item.status = item.status === "Published" ? "Draft" : "Published";
            save(state);
            drawAnnouncements();
        }));
        document.querySelectorAll("[data-delete-ann]").forEach((button) => button.addEventListener("click", () => {
            const state = data();
            state.announcements = state.announcements.filter((ann) => ann.id !== button.dataset.deleteAnn);
            save(state);
            drawAnnouncements();
        }));
    }

    function openAnnouncementForm(id) {
        const state = data();
        const item = state.announcements.find((ann) => ann.id === id) || { title: "", type: "Clinic Notice", content: "", publishDate: "2026-10-06", status: "Draft" };
        openModal(id ? "Edit Announcement" : "Create Announcement", `<form class="form-grid" id="announcementForm"><label><span>Title</span><input name="title" value="${item.title}" required></label><label><span>Type</span><select name="type"><option>Clinic Notice</option><option>Health Education</option><option>New Product</option><option>Promotion</option></select></label><label class="full"><span>Content</span><textarea name="content" rows="4">${item.content}</textarea></label><label><span>Publish Date</span><input type="date" name="publishDate" value="${item.publishDate}"></label><label><span>Status</span><select name="status"><option>Draft</option><option>Published</option></select></label></form>`, `<button class="primary-btn" id="saveAnnouncement">Save</button>`);
        byId("announcementForm").type.value = item.type;
        byId("announcementForm").status.value = item.status;
        byId("saveAnnouncement").addEventListener("click", () => {
            const form = byId("announcementForm");
            if (!form.reportValidity()) return;
            const payload = Object.fromEntries(new FormData(form).entries());
            if (id) Object.assign(state.announcements.find((ann) => ann.id === id), payload);
            else state.announcements.push({ id: generateID("ANN"), ...payload });
            save(state);
            closeModal();
            drawAnnouncements();
        });
    }

    function analyticsDateMatches(value, dateRange) {
        if (dateRange.period === "all") return true;
        const dateText = String(value || "").slice(0, 10);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
        if (!match) return false;
        return (!dateRange.start || dateText >= dateRange.start) &&
            (!dateRange.end || dateText <= dateRange.end);
    }

    function analyticsDateRange(period, selectedMonth, selectedYear, startDate, endDate) {
        const today = new Date();
        const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        if (period === "all") return { period, label: "All records" };
        if (period === "month") {
            const [year, month] = selectedMonth.split("-").map(Number);
            if (!year || !month) return { period, label: "Choose a month", invalid: true };
            const date = new Date(year, month - 1, 1);
            return {
                period,
                start: `${selectedMonth}-01`,
                end: `${selectedMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`,
                label: date.toLocaleDateString("en-MY", { month: "long", year: "numeric" })
            };
        }
        if (period === "6months") {
            const firstMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1);
            return {
                period,
                start: `${firstMonth.getFullYear()}-${String(firstMonth.getMonth() + 1).padStart(2, "0")}-01`,
                end: todayText,
                label: `Last 6 months (to ${today.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })})`
            };
        }
        if (period === "year") {
            const year = Number(selectedYear);
            if (!year) return { period, label: "Choose a year", invalid: true };
            return { period, start: `${year}-01-01`, end: `${year}-12-31`, label: `Year ${year}` };
        }
        if (period === "custom") {
            if (!startDate || !endDate || startDate > endDate) {
                return { period, start: startDate, end: endDate, label: "Choose a valid date range", invalid: true };
            }
            return { period, start: startDate, end: endDate, label: `${startDate} to ${endDate}` };
        }
        return { period: "all", label: "All records" };
    }

    function analyticsSummary(state, dateRange, doctorId) {
        if (dateRange.invalid) {
            return {
                appointments: [],
                completed: 0,
                cancelled: 0,
                scheduled: 0,
                orders: [],
                salesOrders: [],
                sales: 0,
                units: 0,
                productRows: [],
                doctorRows: state.doctors.map((doctor) => ({
                    name: doctor.name,
                    appointments: 0,
                    completed: 0,
                    cancelled: 0
                }))
            };
        }
        const appointments = state.appointments.filter((item) =>
            analyticsDateMatches(item.date, dateRange) && (!doctorId || item.doctorId === doctorId)
        );
        const orders = state.orders.filter((order) => analyticsDateMatches(order.date, dateRange));
        const salesOrders = orders.filter((order) =>
            order.status !== "Cancelled" && order.status !== "Pending Payment"
        );
        const products = new Map();
        salesOrders.forEach((order) => {
            (Array.isArray(order.items) ? order.items : []).forEach((item) => {
                const quantity = Number(item.quantity);
                const price = Number(item.price);
                const name = String(item.name || "Product");
                if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) return;
                const product = products.get(name) || { name, units: 0, sales: 0 };
                product.units += quantity;
                product.sales += quantity * price;
                products.set(name, product);
            });
        });
        const productRows = [...products.values()].sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));
        const doctorRows = state.doctors.map((doctor) => {
            const doctorAppointments = appointments.filter((item) => item.doctorId === doctor.id);
            return {
                name: doctor.name,
                appointments: doctorAppointments.length,
                completed: doctorAppointments.filter((item) => item.status === "Completed").length,
                cancelled: doctorAppointments.filter((item) => item.status === "Cancelled").length
            };
        });
        return {
            appointments,
            completed: appointments.filter((item) => item.status === "Completed").length,
            cancelled: appointments.filter((item) => item.status === "Cancelled").length,
            scheduled: appointments.filter((item) => ["Scheduled", "Rescheduled"].includes(item.status)).length,
            orders,
            salesOrders,
            sales: productRows.reduce((sum, product) => sum + product.sales, 0),
            units: productRows.reduce((sum, product) => sum + product.units, 0),
            productRows,
            doctorRows
        };
    }

    function analyticsXml(value) {
        return String(value ?? "").replace(/[<>&'"]/g, (character) => ({
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;",
            "'": "&apos;",
            "\"": "&quot;"
        })[character]);
    }

    function analyticsCell(value, style = "Text", type = "String", mergeAcross = 0) {
        return { value, style, type, mergeAcross };
    }

    function analyticsRow(cells, height = 22) {
        return { cells, height };
    }

    function analyticsSectionRow(title, columns = 2) {
        return analyticsRow([analyticsCell(title, "Section", "String", columns - 1)], 25);
    }

    function analyticsColumnName(number) {
        let name = "";
        while (number > 0) {
            const remainder = (number - 1) % 26;
            name = String.fromCharCode(65 + remainder) + name;
            number = Math.floor((number - 1) / 26);
        }
        return name;
    }

    function analyticsWorksheet(columns, rows, frozenRows) {
        const mergeRanges = [];
        const worksheetRows = rows.map((row, rowIndex) => {
            const cells = row.cells.map((cell, columnIndex) => {
                const reference = `${analyticsColumnName(columnIndex + 1)}${rowIndex + 1}`;
                const styleId = analyticsStyleIds[cell.style] ?? 6;
                const contents = cell.type === "Number"
                    ? `<v>${Number.isFinite(Number(cell.value)) ? Number(cell.value) : 0}</v>`
                    : `<is><t xml:space="preserve">${analyticsXml(cell.value)}</t></is>`;
                const cellType = cell.type === "Number" ? "" : ` t="inlineStr"`;
                if (cell.mergeAcross) {
                    mergeRanges.push(`${reference}:${analyticsColumnName(columnIndex + 1 + cell.mergeAcross)}${rowIndex + 1}`);
                }
                return `<c r="${reference}" s="${styleId}"${cellType}>${contents}</c>`;
            }).join("");
            return `<row r="${rowIndex + 1}" ht="${row.height}" customHeight="1">${cells}</row>`;
        }).join("");
        const pane = frozenRows
            ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${frozenRows}" topLeftCell="A${frozenRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
            : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
        const merges = mergeRanges.length
            ? `<mergeCells count="${mergeRanges.length}">${mergeRanges.map((range) => `<mergeCell ref="${range}"/>`).join("")}</mergeCells>`
            : "";
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${pane}<sheetFormatPr defaultRowHeight="18"/><cols>${columns.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${worksheetRows}</sheetData>${merges}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    }

    const analyticsStyleIds = {
        Title: 1,
        Subtitle: 2,
        Meta: 3,
        Section: 4,
        TableHeader: 5,
        Text: 6,
        Label: 7,
        Number: 8,
        Currency: 9,
        Percent: 10,
        Total: 11,
        TotalNumber: 12,
        TotalCurrency: 13,
        TotalPercent: 14,
        Empty: 15
    };

    function analyticsStyles() {
        const fonts = [
            '<font><sz val="10"/><name val="Aptos"/><color rgb="FF18392E"/></font>',
            '<font><b/><sz val="18"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font>',
            '<font><b/><sz val="12"/><name val="Aptos"/><color rgb="FF184936"/></font>',
            '<font><sz val="10"/><name val="Aptos"/><color rgb="FF526A5D"/></font>',
            '<font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font>',
            '<font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font>',
            '<font><sz val="10"/><name val="Aptos"/><color rgb="FF18392E"/></font>',
            '<font><b/><sz val="10"/><name val="Aptos"/><color rgb="FF526A5D"/></font>',
            '<font><b/><sz val="10"/><name val="Aptos"/><color rgb="FF184936"/></font>',
            '<font><i/><sz val="10"/><name val="Aptos"/><color rgb="FF75857B"/></font>'
        ];
        const fills = [
            '<fill><patternFill patternType="none"/></fill>',
            '<fill><patternFill patternType="gray125"/></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="FF184936"/></patternFill></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F3E9"/></patternFill></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F6F0"/></patternFill></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="FF2F7859"/></patternFill></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>'
        ];
        const borders = [
            '<border><left/><right/><top/><bottom/><diagonal/></border>',
            '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE4EBE3"/></bottom><diagonal/></border>',
            '<border><left/><right/><top style="thin"><color rgb="FF2F7859"/></top><bottom/><diagonal/></border>'
        ];
        const alignments = {
            center: '<alignment vertical="center"/>',
            wrap: '<alignment vertical="center" wrapText="1"/>',
            right: '<alignment horizontal="right" vertical="center"/>'
        };
        const style = (font, fill, border = 1, alignment = "center", numFmt = "") =>
            `<xf numFmtId="${numFmt || 0}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyAlignment="1"${numFmt ? ' applyNumberFormat="1"' : ""}>${alignments[alignment]}</xf>`;
        const cellFormats = [
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
            style(1, 2, 0, "center"),
            style(2, 3, 0, "center"),
            style(3, 4, 0, "center"),
            style(4, 5, 0, "center"),
            style(5, 5, 0, "wrap"),
            style(6, 6, 1, "wrap"),
            style(7, 4, 1, "wrap"),
            style(6, 6, 1, "right", 3),
            style(8, 6, 1, "right", 164),
            style(6, 6, 1, "right", 165),
            style(8, 3, 2, "wrap"),
            style(8, 3, 2, "right", 3),
            style(8, 3, 2, "right", 164),
            style(8, 3, 2, "right", 165),
            style(9, 6, 0, "wrap")
        ];
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;RM&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${cellFormats.length}">${cellFormats.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    }

    function analyticsZip(files) {
        const encoder = new TextEncoder();
        const crcTable = new Uint32Array(256);
        for (let index = 0; index < 256; index += 1) {
            let value = index;
            for (let bit = 0; bit < 8; bit += 1) {
                value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
            }
            crcTable[index] = value >>> 0;
        }
        const crc32 = (bytes) => {
            let crc = 0xFFFFFFFF;
            bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8); });
            return (crc ^ 0xFFFFFFFF) >>> 0;
        };
        const write16 = (view, offset, value) => view.setUint16(offset, value, true);
        const write32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
        const now = new Date();
        const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
        const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        const localParts = [];
        const directoryParts = [];
        let offset = 0;
        files.forEach(([name, contents]) => {
            const filename = encoder.encode(name);
            const bytes = encoder.encode(contents);
            const checksum = crc32(bytes);
            const localHeader = new Uint8Array(30 + filename.length);
            const localView = new DataView(localHeader.buffer);
            write32(localView, 0, 0x04034B50);
            write16(localView, 4, 20);
            write16(localView, 6, 0x0800);
            write16(localView, 8, 0);
            write16(localView, 10, dosTime);
            write16(localView, 12, dosDate);
            write32(localView, 14, checksum);
            write32(localView, 18, bytes.length);
            write32(localView, 22, bytes.length);
            write16(localView, 26, filename.length);
            write16(localView, 28, 0);
            localHeader.set(filename, 30);
            localParts.push(localHeader, bytes);

            const centralHeader = new Uint8Array(46 + filename.length);
            const centralView = new DataView(centralHeader.buffer);
            write32(centralView, 0, 0x02014B50);
            write16(centralView, 4, 20);
            write16(centralView, 6, 20);
            write16(centralView, 8, 0x0800);
            write16(centralView, 10, 0);
            write16(centralView, 12, dosTime);
            write16(centralView, 14, dosDate);
            write32(centralView, 16, checksum);
            write32(centralView, 20, bytes.length);
            write32(centralView, 24, bytes.length);
            write16(centralView, 28, filename.length);
            write16(centralView, 30, 0);
            write16(centralView, 32, 0);
            write16(centralView, 34, 0);
            write16(centralView, 36, 0);
            write32(centralView, 38, 0);
            write32(centralView, 42, offset);
            centralHeader.set(filename, 46);
            directoryParts.push(centralHeader);
            offset += localHeader.length + bytes.length;
        });

        const directorySize = directoryParts.reduce((sum, part) => sum + part.length, 0);
        const endRecord = new Uint8Array(22);
        const endView = new DataView(endRecord.buffer);
        write32(endView, 0, 0x06054B50);
        write16(endView, 4, 0);
        write16(endView, 6, 0);
        write16(endView, 8, files.length);
        write16(endView, 10, files.length);
        write32(endView, 12, directorySize);
        write32(endView, 16, offset);
        write16(endView, 20, 0);
        return new Blob([...localParts, ...directoryParts, endRecord], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
    }

    function exportAnalytics(summary, periodLabel, doctorFilter) {
        const generatedAt = new Date();
        const dateLabel = generatedAt.toLocaleDateString("en-MY", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        const timeLabel = generatedAt.toLocaleTimeString("en-MY", {
            hour: "numeric",
            minute: "2-digit"
        });
        const summaryRows = [
            analyticsRow([analyticsCell("TCM SMARTCARE+  |  CLINIC INSIGHTS", "Title", "String", 1)], 38),
            analyticsRow([analyticsCell("Clinic analytics report", "Subtitle", "String", 1)], 26),
            analyticsRow([analyticsCell(`Reporting period: ${periodLabel}     |     Generated: ${dateLabel} at ${timeLabel}`, "Meta", "String", 1)], 24),
            analyticsRow([analyticsCell("Report details", "Section", "String", 1)], 25),
            analyticsRow([analyticsCell("Appointment filter", "Label"), analyticsCell(doctorFilter || "All doctors", "Text")]),
            analyticsRow([analyticsCell("Product sales", "Label"), analyticsCell("Cancelled and pending-payment orders excluded", "Text")]),
            analyticsRow([analyticsCell("Scope", "Label"), analyticsCell("Doctor filter applies to appointments only; product sales use the selected period.", "Text")], 30),
            analyticsRow([]),
            analyticsSectionRow("Performance summary"),
            analyticsRow([analyticsCell("Metric", "TableHeader"), analyticsCell("Value", "TableHeader")], 24),
            analyticsRow([analyticsCell("Total appointments", "Text"), analyticsCell(summary.appointments.length, "Number", "Number")]),
            analyticsRow([analyticsCell("Completed appointments", "Text"), analyticsCell(summary.completed, "Number", "Number")]),
            analyticsRow([analyticsCell("Cancelled appointments", "Text"), analyticsCell(summary.cancelled, "Number", "Number")]),
            analyticsRow([analyticsCell("Scheduled appointments", "Text"), analyticsCell(summary.scheduled, "Number", "Number")]),
            analyticsRow([analyticsCell("Product sales", "Text"), analyticsCell(summary.sales, "Currency", "Number")]),
            analyticsRow([analyticsCell("Included orders", "Text"), analyticsCell(summary.salesOrders.length, "Number", "Number")]),
            analyticsRow([analyticsCell("Units sold", "Text"), analyticsCell(summary.units, "Number", "Number")]),
            analyticsRow([analyticsCell("Products sold", "Text"), analyticsCell(summary.productRows.length, "Number", "Number")])
        ];

        const productRows = [
            analyticsRow([analyticsCell("PRODUCT SALES", "Title", "String", 3)], 38),
            analyticsRow([analyticsCell(`Revenue by product  |  ${periodLabel}`, "Subtitle", "String", 3)], 26),
            analyticsRow([analyticsCell("Product", "TableHeader"), analyticsCell("Units sold", "TableHeader"), analyticsCell("Sales revenue", "TableHeader"), analyticsCell("Revenue share", "TableHeader")], 25),
            ...summary.productRows.map((product) => analyticsRow([
                analyticsCell(product.name, "Text"),
                analyticsCell(product.units, "Number", "Number"),
                analyticsCell(product.sales, "Currency", "Number"),
                analyticsCell(summary.sales ? product.sales / summary.sales : 0, "Percent", "Number")
            ])),
            analyticsRow([
                analyticsCell("Total product sales", "Total"),
                analyticsCell(summary.units, "TotalNumber", "Number"),
                analyticsCell(summary.sales, "TotalCurrency", "Number"),
                analyticsCell(summary.sales ? 1 : 0, "TotalPercent", "Number")
            ], 25)
        ];
        if (!summary.productRows.length) {
            productRows.splice(3, 0, analyticsRow([analyticsCell("No product sales for the selected period.", "Empty", "String", 3)], 28));
        }

        const doctorRows = [
            analyticsRow([analyticsCell("DOCTOR PERFORMANCE", "Title", "String", 4)], 38),
            analyticsRow([analyticsCell(`Appointment breakdown  |  ${periodLabel}`, "Subtitle", "String", 4)], 26),
            analyticsRow([analyticsCell("Doctor", "TableHeader"), analyticsCell("Appointments", "TableHeader"), analyticsCell("Completed", "TableHeader"), analyticsCell("Cancelled", "TableHeader"), analyticsCell("Completion rate", "TableHeader")], 25),
            ...summary.doctorRows.map((doctor) => analyticsRow([
                analyticsCell(doctor.name, "Text"),
                analyticsCell(doctor.appointments, "Number", "Number"),
                analyticsCell(doctor.completed, "Number", "Number"),
                analyticsCell(doctor.cancelled, "Number", "Number"),
                analyticsCell(doctor.appointments ? doctor.completed / doctor.appointments : 0, "Percent", "Number")
            ])),
            analyticsRow([
                analyticsCell("All doctors", "Total"),
                analyticsCell(summary.appointments.length, "TotalNumber", "Number"),
                analyticsCell(summary.completed, "TotalNumber", "Number"),
                analyticsCell(summary.cancelled, "TotalNumber", "Number"),
                analyticsCell(summary.appointments.length ? summary.completed / summary.appointments.length : 0, "TotalPercent", "Number")
            ], 25)
        ];

        const workbook = analyticsZip([
            ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
            ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
            ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Product Sales" sheetId="2" r:id="rId2"/><sheet name="Doctor Performance" sheetId="3" r:id="rId4"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
            ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>`],
            ["xl/styles.xml", analyticsStyles()],
            ["xl/worksheets/sheet1.xml", analyticsWorksheet([36, 58], summaryRows, 10)],
            ["xl/worksheets/sheet2.xml", analyticsWorksheet([46, 14, 20, 17], productRows, 3)],
            ["xl/worksheets/sheet3.xml", analyticsWorksheet([30, 16, 14, 14, 19], doctorRows, 3)]
        ]);
        const url = URL.createObjectURL(workbook);
        const link = document.createElement("a");
        link.href = url;
        link.download = `tcm-clinic-analytics-${generatedAt.toISOString().slice(0, 10)}.xlsx`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function renderAnalytics() {
        const state = data();
        const previousPeriod = byId("analyticsPeriod")?.value || "all";
        const previousDoctor = byId("analyticsDoctor")?.value || "";
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        const previousMonth = byId("analyticsMonth")?.value || currentMonth;
        const previousYear = byId("analyticsYear")?.value || String(today.getFullYear());
        const previousStartDate = byId("analyticsStartDate")?.value || "";
        const previousEndDate = byId("analyticsEndDate")?.value || "";
        const dateRange = analyticsDateRange(previousPeriod, previousMonth, previousYear, previousStartDate, previousEndDate);
        const summary = analyticsSummary(state, dateRange, previousDoctor);
        const productColors = ["#2f7859", "#8da98d", "#bf9b4b", "#527c9a", "#b57052", "#7e6f98", "#4f9291"];
        const totalProductSales = summary.sales;
        let chartCursor = 0;
        const gradientStops = summary.productRows.map((product, index) => {
            const start = chartCursor;
            chartCursor += totalProductSales ? product.sales / totalProductSales * 100 : 0;
            return `${productColors[index % productColors.length]} ${start}% ${chartCursor}%`;
        }).join(", ");
        const maxUnits = Math.max(1, ...summary.productRows.map((product) => product.units));
        const periodLabel = dateRange.label;
        const years = new Set([today.getFullYear()]);
        [...state.appointments, ...state.orders].forEach((item) => {
            const year = Number(String(item.date || "").slice(0, 4));
            if (Number.isInteger(year) && year >= 1900 && year <= 2100) years.add(year);
        });
        years.add(Number(previousYear));
        const yearOptions = [...years].sort((a, b) => b - a);
        const appointmentRows = summary.doctorRows.map((doctor, index) => `
            <tr>
                <td><span class="analytics-doctor-name"><i style="--doctor-color:${productColors[index % productColors.length]}"></i>${escapeHtml(doctor.name)}</span></td>
                <td>${doctor.appointments}</td><td>${doctor.completed}</td><td>${doctor.cancelled}</td>
            </tr>`);

        mountView("admin-analytics-view");
        byId("analyticsYear").innerHTML = yearOptions.map((year) => `<option value="${year}">${year}</option>`).join("");
        byId("analyticsDoctor").innerHTML = `<option value="">All doctors</option>${state.doctors.map((doctor) => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.name)}</option>`).join("")}`;
        byId("analyticsPeriod").value = previousPeriod;
        byId("analyticsDoctor").value = previousDoctor;
        byId("analyticsMonth").value = previousMonth;
        byId("analyticsYear").value = previousYear;
        byId("analyticsStartDate").value = previousStartDate;
        byId("analyticsEndDate").value = previousEndDate;
        byId("analyticsMonthFilter").hidden = previousPeriod !== "month";
        byId("analyticsYearFilter").hidden = previousPeriod !== "year";
        byId("analyticsStartFilter").hidden = previousPeriod !== "custom";
        byId("analyticsEndFilter").hidden = previousPeriod !== "custom";
        byId("analyticsFilterHint").hidden = !dateRange.invalid;
        byId("analyticsFilterHint").textContent = previousPeriod === "custom"
            ? "Select a valid start and end date. The start date must be on or before the end date."
            : "Choose a valid reporting period.";
        byId("analyticsKpis").innerHTML = `
            <article class="analytics-kpi featured"><span class="analytics-kpi-icon">▦</span><strong>${summary.appointments.length}</strong><b>Total appointments</b><small>${escapeHtml(periodLabel)}${previousDoctor ? ` · ${escapeHtml(doctorName(previousDoctor, state))}` : ""}</small></article>
            <article class="analytics-kpi"><span class="analytics-kpi-icon">✓</span><strong>${summary.completed}</strong><b>Completed appointments</b><small>${summary.appointments.length ? `${(summary.completed / summary.appointments.length * 100).toFixed(1)}% of appointments` : "No appointments in this period"}</small></article>
            <article class="analytics-kpi"><span class="analytics-kpi-icon">▤</span><strong>${money(summary.sales)}</strong><b>Product sales</b><small>${summary.salesOrders.length} included orders · ${escapeHtml(periodLabel)}</small></article>
            <article class="analytics-kpi"><span class="analytics-kpi-icon">▱</span><strong>${summary.orders.length}</strong><b>Total orders</b><small>${summary.units} units sold across ${summary.productRows.length} products</small></article>`;
        byId("analyticsSalesSubtitle").textContent = `Revenue share · ${periodLabel}`;
        byId("analyticsSalesDonut").innerHTML = summary.sales > 0
            ? `<div class="analytics-donut" role="img" aria-label="Product sales distribution by product" style="--sales-chart:conic-gradient(${gradientStops})"><div><strong>${money(summary.sales)}</strong><span>product sales</span></div></div>`
            : `<div class="analytics-donut analytics-donut-empty"><div><strong>${money(0)}</strong><span>product sales</span></div></div>`;
        byId("analyticsSalesLegend").innerHTML = summary.productRows.length
            ? summary.productRows.map((product, index) => `
                <div class="analytics-legend-row"><i style="--product-color:${productColors[index % productColors.length]}"></i><span><strong>${escapeHtml(product.name)}</strong><small>${product.units} ${product.units === 1 ? "unit" : "units"} sold</small></span><b>${summary.sales ? (product.sales / summary.sales * 100).toFixed(1) : "0.0"}%</b></div>
            `).join("")
            : `<p class="analytics-empty">No product sales in this period.</p>`;
        byId("analyticsUnitsSubtitle").textContent = `${summary.units} units sold · ${periodLabel}`;
        byId("analyticsProductRanking").innerHTML = summary.productRows.length
            ? [...summary.productRows].sort((a, b) => b.units - a.units || a.name.localeCompare(b.name)).map((product) => `
                <div class="analytics-product-row"><span>${escapeHtml(product.name)}</span><span class="analytics-unit-track"><i style="width:${product.units / maxUnits * 100}%"></i></span><strong>${product.units}</strong></div>
            `).join("")
            : `<p class="analytics-empty">No product sales in this period.</p>`;
        byId("analyticsDoctorSubtitle").textContent = `Appointment counts by doctor · ${periodLabel}`;
        byId("analyticsDoctorCount").textContent = `${summary.doctorRows.length} doctors`;
        byId("analyticsDoctorTable").innerHTML = table(["Doctor", "Total appointments", "Completed", "Cancelled"], appointmentRows);
        byId("analyticsFooterNote").textContent = `${periodLabel} · Store sales exclude cancelled and pending-payment orders.`;
        byId("analyticsPeriod").addEventListener("change", renderAnalytics);
        byId("analyticsDoctor").addEventListener("change", renderAnalytics);
        ["analyticsMonth", "analyticsYear", "analyticsStartDate", "analyticsEndDate"].forEach((id) => {
            byId(id).addEventListener("change", renderAnalytics);
        });
        byId("exportAnalytics").addEventListener("click", () => {
            const selectedDoctor = state.doctors.find((doctor) => doctor.id === previousDoctor);
            exportAnalytics(summary, periodLabel, selectedDoctor ? selectedDoctor.name : "All doctors");
        });
    }

    function showServerError(error) {
        document.body.replaceChildren();
        const main = document.createElement("main");
        main.className = "access-denied";
        const heading = document.createElement("h1");
        heading.textContent = "Admin server unavailable";
        const message = document.createElement("p");
        message.textContent = error?.message || "Could not connect to the Python admin server.";
        const help = document.createElement("p");
        help.textContent = "Start the backend with the setup instructions in README.md, then reload this page.";
        main.append(heading, message, help);
        document.body.append(main);
    }

    document.addEventListener("DOMContentLoaded", async () => {
        try {
            const page = document.body.dataset.page;
            if (page === "login") {
                await window.TcmAdminData.initialize(false);
                initLogin();
                return;
            }
            if (!await window.TcmAdminAuth.initialize()) {
                window.location.href = "admin-login.html";
                return;
            }
            await window.TcmAdminData.initialize();
            if (!protect(page)) return;
            renderShell(page, document.body.dataset.title || "Admin Portal");
            pages[page]?.();
        } catch (error) {
            showServerError(error);
        }
    });

    window.addEventListener("tcm-admin-api-error", (event) => {
        showToast(event.detail || "Could not save admin data to the database.");
    });

    window.addEventListener("storage", (event) => {
        if (event.key === "tcmAdminData" && document.body.dataset.page === "appointments") {
            renderAppointments();
        }

        if (event.key === "tcmPurchaseHistory" && document.body.dataset.page === "orders") {
            renderOrders();
        }

        if (event.key === "tcmMessages" && document.body.dataset.page === "messages") {
            renderMessages();
        }
    });
})();
