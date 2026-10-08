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
        analytics: renderAnalytics
    };
    let activeMessageId = "";

    function data() {
        return window.TcmAdminData.load();
    }

    function save(nextData) {
        window.TcmAdminData.save(nextData);
    }

    function current() {
        return window.TcmAdminAuth.getCurrentAdmin();
    }

    function byId(id) {
        return document.getElementById(id);
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
        if (["feedback", "announcements", "analytics", "schedule", "products", "orders"].includes(page)) {
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

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            status.textContent = "";
            const button = form.querySelector("button[type='submit']");
            button.disabled = true;
            button.textContent = "Logging in...";
            window.setTimeout(() => {
                const result = window.TcmAdminAuth.login(byId("identifier").value, password.value);
                if (!result.ok) {
                    status.textContent = result.message;
                    button.disabled = false;
                    button.textContent = "Login";
                    return;
                }
                window.TcmAdminAuth.redirectByRole();
            }, 400);
        });

        byId("demoRole").addEventListener("change", (event) => {
            const role = event.target.value;
            if (!role) return;
            const user = role === "doctor" ? data().doctors[0] : data().staff[0];
            byId("identifier").value = user.email;
            password.value = user.password;
        });

        document.querySelectorAll("[data-demo-login]").forEach((button) => {
            button.addEventListener("click", () => {
                window.TcmAdminAuth.demoLogin(button.dataset.demoLogin);
                window.TcmAdminAuth.redirectByRole();
            });
        });
    }

    function renderShell(page, title) {
        const user = current();
        const staffOnly = user.role === "staff";
        const links = [
            ["clinic", "dashboard", "Dashboard", "admin-dashboard.html", true, "grid"],
            ["clinic", "appointments", "Appointments", "admin-appointments.html", true, "calendar"],
            ["clinic", "schedule", "Doctor Schedule", "admin-schedule.html", staffOnly, "clock"],
            ["clinic", "patients", "Patients", "admin-patients.html", true, "users"],
            ["clinic", "carePlan", "Care Plan", "admin-care-plan.html", true, "clipboard"],
            ["store", "products", "Products", "admin-products.html", staffOnly, "box"],
            ["store", "orders", "Orders", "admin-orders.html", staffOnly, "bag"],
            ["communication", "messages", "Messages", "admin-messages.html", true, "message"],
            ["communication", "feedback", "Feedback", "admin-feedback.html", staffOnly, "feedback"],
            ["communication", "announcements", "Announcements", "admin-announcements.html", staffOnly, "megaphone"],
            ["insights", "analytics", "Analytics", "admin-analytics.html", staffOnly, "chart"]
        ].filter((item) => item[3]);
        const groups = [
            ["clinic", "Clinic Operations"],
            ["store", "Store"],
            ["communication", "Communication"],
            ["insights", "Insights"]
        ];

        document.body.innerHTML = `
            <div class="admin-shell">
                <aside class="admin-sidebar">
                    <a class="admin-logo" href="admin-dashboard.html"><span class="brand-mark">TCM</span><span>TCM SmartCare</span><b>+</b></a>
                    <p class="portal-label">CLINIC MANAGEMENT</p>
                    <nav class="admin-nav">
                        ${groups.map(([group, label]) => {
                            const groupLinks = links.filter((item) => item[0] === group);
                            if (!groupLinks.length) return "";
                            return `<div class="nav-group"><p>${label}</p>${groupLinks.map(([, key, linkLabel, href,, icon]) => `<a class="${key === page ? "active" : ""}" href="${href}"><span class="nav-icon icon-${icon}"></span><span>${linkLabel}</span>${key === page ? `<i></i>` : ""}</a>`).join("")}</div>`;
                        }).join("")}
                    </nav>
                    <div class="sidebar-spacer"></div>
                    <div class="workspace-card">
                        <strong>Staff workspace</strong>
                        <span>Care starts with a connected team.</span>
                    </div>
                </aside>
                <main class="admin-main">
                    <header class="admin-header">
                        <div class="admin-title">
                            <p>${formatDate(new Date())}</p>
                            <h1>${title}</h1>
                        </div>
                        <div class="admin-actions">
                            <span class="notification-dot" aria-label="Notifications"></span>
                            <div class="admin-profile">
                                <div class="avatar">${user.avatar}</div>
                                <span><strong>${user.name}</strong><small>${user.role}</small></span>
                            </div>
                            <button class="ghost-btn" id="adminLogout" type="button">Logout</button>
                        </div>
                    </header>
                    <section class="admin-page" id="adminPage"></section>
                </main>
            </div>
        `;
        byId("adminLogout").addEventListener("click", window.TcmAdminAuth.logout);
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

    function pageHero(title, text, action = "") {
        return `<div class="page-hero"><div><h2>${title}</h2><p>${text}</p></div>${action}</div>`;
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
        byId("adminPage").innerHTML = `
            ${pageHero(`Good Morning, ${user.name}`, "Your clinic at a glance. Keep today's care moving smoothly.", `<button class="primary-btn" id="dashboardCreateAppointment" type="button"><span class="btn-icon icon-plus"></span>New Appointment</button>`)}
            <div class="kpi-grid">
                ${kpi(today.length, "Today's Appointments", "+2 compared with yesterday", "admin-appointments.html?date=today", "calendar", true)}
                ${kpi(checkedIn, "Checked In", "Patients who have arrived", "admin-appointments.html?status=Checked%20In", "users")}
                ${kpi(pendingOrders, "Orders To Process", "Pending packing", "admin-orders.html?status=Pending%20Packing", "box")}
                ${kpi(lowStock, "Low Stock Products", "Needs restock review", "admin-products.html?stock=low", "bag")}
            </div>
            <div class="dashboard-layout">
                <section class="panel">
                    <div class="panel-header"><div><h2>Today's Appointments</h2><p>${today.length} appointments · ${checkedIn} checked in</p></div><a class="secondary-btn" href="admin-appointments.html">View all</a></div>
                    ${table(["Time", "Patient / Service", "Doctor / Status", "Action"], today.map((item) => `
                        <tr>
                            <td>${formatTime(item.time)}</td>
                            <td><div class="person-cell">${patientAvatar(item.patient)}<span><strong>${item.patient}</strong><small>${item.service}</small></span></div></td>
                            <td><strong>${item.doctor}</strong><br>${badge(item.status)}</td>
                            <td class="row-actions"><button class="mini-btn" data-view-appointment="${item.id}">View</button>${["Scheduled", "Rescheduled"].includes(item.status) ? `<button class="mini-btn" data-check-in="${item.id}">Check-in</button>` : ""}</td>
                        </tr>
                    `))}
                    <p class="table-note"><span class="nav-icon icon-users"></span> Patient queue - Jamie Lee is waiting for TCM Consultation.</p>
                </section>
                <aside class="dashboard-side">
                    <section class="panel">
                    <h2>Needs your attention</h2>
                    <p>Alerts to keep the clinic on track</p>
                    <div class="alert-list">
                        <a class="alert-card alert-red" href="admin-products.html?stock=low"><span class="nav-icon icon-alert"></span><strong>Ginseng stock is below 5 units.</strong><small>Review inventory</small></a>
                        <a class="alert-card alert-gold" href="admin-appointments.html?date=upcoming"><span class="nav-icon icon-clipboard"></span><strong>Appointments are booked automatically.</strong><small>Check patients in when they arrive</small></a>
                        <a class="alert-card alert-green" href="admin-orders.html?status=Pending%20Packing"><span class="nav-icon icon-box"></span><strong>2 orders are waiting for packing.</strong><small>Process orders</small></a>
                    </div>
                    </section>
                    <section class="quick-panel">
                    <h2>Quick Actions</h2>
                    <div class="quick-grid">
                        <a class="quick-action" href="admin-products.html?action=create"><span class="nav-icon icon-box"></span>Add Product</a>
                        <a class="quick-action" href="admin-orders.html"><span class="nav-icon icon-bag"></span>View Orders</a>
                        <a class="quick-action wide" href="admin-schedule.html"><span class="nav-icon icon-clock"></span>Manage Schedule</a>
                    </div>
                    </section>
                </aside>
            </div>
            <section class="timeline-band">
                <div class="panel-header"><div><h2>Today's care timeline</h2><p>Scheduled appointment times - Tuesday, 6 October</p></div></div>
                <div class="timeline-row">
                    ${today.map((item) => `<div><small>${formatTime(item.time)}</small><strong>${item.patient} - ${item.service}</strong><span>${item.doctor}</span></div>`).join("")}
                </div>
            </section>
        `;
        byId("dashboardCreateAppointment")?.addEventListener("click", openAppointmentCreate);
        bindAppointmentButtons();
    }

    function renderDoctorDashboard(state, user) {
        const mine = todayAppointments(state).filter((item) => item.doctorId === user.id);
        byId("adminPage").innerHTML = `
            <h2>Good Morning, ${user.name}</h2>
            <div class="kpi-grid">
                ${kpi(mine.length, "Today's Patients", "Assigned to you", "admin-appointments.html?date=today")}
                ${kpi(mine.filter((item) => item.status === "Checked In").length, "Checked In", "Ready to start", "admin-appointments.html?status=Checked%20In")}
                ${kpi(mine.filter((item) => item.status === "Completed").length, "Completed Today", "Consultations completed", "admin-appointments.html?status=Completed")}
                ${kpi(state.messages.filter((item) => item.doctorId === user.id).reduce((sum, item) => sum + item.unread, 0), "Unread Messages", "Patient conversations", "admin-messages.html?filter=unread")}
            </div>
            <div class="dashboard-layout">
                <section class="panel">
                    <div class="panel-header"><h2>Today's Schedule</h2><a class="secondary-btn" href="admin-appointments.html">Open schedule</a></div>
                    ${table(["Time", "Patient", "Service", "Status", "Action"], mine.map((item) => `
                        <tr><td>${formatTime(item.time)}</td><td>${item.patient}</td><td>${item.service}</td><td>${badge(item.status)}</td>
                        <td class="row-actions">${item.status === "Checked In" ? `<button class="mini-btn" data-start-consult="${item.id}">Start</button>` : `<button class="mini-btn" data-view-appointment="${item.id}">View</button>`}</td></tr>
                    `))}
                </section>
                <aside class="panel">
                    <h2>Patient Alerts</h2>
                    <div class="alert-list">
                        <a class="alert-card" href="admin-care-plan.html?appointment=APT-001">Pre-consultation submitted<br><strong>Jamie Lee</strong><br>Appointment: 10:00 AM</a>
                    </div>
                    <h2 style="margin-top:22px">Quick Actions</h2>
                    <div class="quick-grid">
                        <a class="quick-action" href="admin-appointments.html">Today's Appointments</a>
                        <a class="quick-action" href="admin-patients.html">My Patients</a>
                        <a class="quick-action" href="admin-care-plan.html">Pre-Consultation</a>
                        <a class="quick-action" href="admin-messages.html">Messages</a>
                    </div>
                </aside>
            </div>
        `;
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
        const doctorOptions = user.role === "doctor"
            ? `<option value="${user.id}">My Appointments</option>`
            : `<option value="">All Doctors</option>${state.doctors.map((doctor) => `<option value="${doctor.id}">${doctor.name}</option>`).join("")}`;

        byId("adminPage").innerHTML = `
            ${pageHero("Keep every visit on track", "Manage bookings, arrival status and appointment details in one place.", user.role === "staff" ? `<button class="primary-btn" id="createAppointment" type="button"><span class="btn-icon icon-plus"></span>Create Appointment</button>` : "")}
            <div class="panel appointment-panel">
                <div class="panel-header">
                    <div><h2>Appointments</h2><p id="appointmentResultSummary">${records} records</p></div>
                    <div class="segmented"><button class="secondary-btn" id="calendarView">Calendar View</button><button class="primary-btn" id="tableView">Table View</button></div>
                </div>
                <div class="appointment-tabs">
                    <button class="active" type="button" data-status-tab="">All appointments <span>${records}</span></button>
                    <button type="button" data-status-tab="Scheduled">Scheduled <span>${state.appointments.filter((item) => item.status === "Scheduled").length}</span></button>
                    <button type="button" data-status-tab="Checked In">Checked In <span>${state.appointments.filter((item) => item.status === "Checked In").length}</span></button>
                    <button type="button" data-status-tab="Completed">Completed <span>${state.appointments.filter((item) => item.status === "Completed").length}</span></button>
                </div>
                <div class="table-toolbar">
                    <label class="toolbar-search"><span>Search patient or appointment ID</span><input id="appointmentSearch" placeholder="e.g. patient name, phone or appointment ID"></label>
                    <label><span>Appointment date</span><select id="filterDate">
                        <option value="upcoming">Upcoming · 30 days</option>
                        <option value="today">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                        <option value="next7">Next 7 days</option>
                        <option value="week">This week</option>
                        <option value="next30">Next 30 days</option>
                        <option value="custom">Choose a date…</option>
                        <option value="past">Past appointments</option>
                        <option value="">All dates</option>
                    </select></label>
                    <label class="custom-date-filter" id="customDateFilter" hidden><span>Choose date</span><input id="filterCustomDate" type="date" aria-label="Choose appointment date"></label>
                    <label><select id="filterDoctor" ${user.role === "doctor" ? "disabled" : ""}>${doctorOptions}</select></label>
                    <label><select id="filterService"><option value="">All Services</option><option>TCM Consultation</option><option>Acupuncture</option><option>Cupping</option><option>Herbal Medicine</option></select></label>
                    <label><select id="filterStatus"><option value="">All</option><option>Scheduled</option><option>Checked In</option><option>In Consultation</option><option>Completed</option><option>Cancelled</option><option>Rescheduled</option></select></label>
                </div>
                <div id="appointmentContent"></div>
            </div>
            <div class="appointment-summary-grid">
                <section class="selected-appointment" id="selectedAppointment"></section>
                <aside class="panel manage-card">
                    <h2>Manage this appointment</h2>
                    <p>Select a record to review its details and available actions.</p>
                </aside>
            </div>
        `;
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
                `<button class="secondary-btn" data-view-appointment="${item.id}">View</button>`
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
        `, action);
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
        byId("adminPage").innerHTML = `
            <section class="schedule-doctor-bar">
                <div class="person-cell">${patientAvatar(selectedDoctor.name)}<span><small>Manage availability for</small><strong id="scheduleDoctorName">${selectedDoctor.name}</strong></span></div>
                <select id="scheduleDoctor">${state.doctors.map((doctor) => `<option value="${doctor.id}">${doctor.name}</option>`).join("")}</select>
                <span class="badge active">Weekly recurring</span>
                <span class="muted-text">Mon - Wed - Fri</span>
            </section>
            <div class="info-strip"><span class="nav-icon icon-alert"></span> Set the doctor's recurring availability and date exceptions. This calendar shows working hours, not booked appointments.</div>
            <div class="schedule-layout">
                <section class="panel schedule-calendar-panel">
                    <div class="panel-header"><div><h2>5-11 October 2026</h2><p>Weekly availability</p></div><div class="row-actions"><button class="mini-btn">Today</button><button class="mini-btn">‹</button><button class="mini-btn">›</button></div></div>
                    <div class="schedule-legend"><span></span> Morning availability <span></span> Afternoon availability <span></span> Not available</div>
                    <div id="scheduleCalendar"></div>
                    <div class="schedule-note"><span class="nav-icon icon-clock"></span><strong>30-minute slots - 1 patient per slot</strong><small>12:00-14:00 is a break. Unselected weekdays remain unavailable.</small></div>
                </section>
                <aside class="panel schedule-form-panel">
                    <h2>Working hours</h2>
                    <p>Recurring weekly schedule</p>
                    <form class="form-grid compact-form" id="scheduleForm"></form>
                </aside>
            </div>
            <section class="save-bar" id="scheduleSaveBar"></section>
        `;
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
        byId("adminPage").innerHTML = `
            ${pageHero("A connected patient directory", "Find contact details, review visit information and prepare for care.", `<button class="primary-btn" id="patientCreateAppointment" type="button"><span class="btn-icon icon-plus"></span>Create Appointment</button>`)}
            <div class="patient-metric-strip"><strong><span class="nav-icon icon-users"></span>${state.patients.length} patients in this directory</strong><span>Pre-consultation <b>${submittedCount} submitted</b> <em>${state.patients.length - submittedCount} not submitted</em></span></div>
            <div class="patient-layout">
                <section class="panel patient-directory">
                    <div class="panel-header"><div><h2>Patient directory</h2></div><span>${state.patients.length} records</span></div>
                    <div class="table-toolbar"><label class="toolbar-search"><input id="patientSearch" placeholder="Search by name, ID, email or phone"></label><label><select><option>All patients</option></select></label><label><select><option>All pre-consultation statuses</option></select></label></div>
                    <div id="patientTable">${table(["Patient / Contact / Visits", "Pre-consultation", ""], rows)}</div>
                </section>
                <aside class="patient-profile" id="patientProfile"></aside>
            </div>
            <section class="followup-card"><div><span class="nav-icon icon-clipboard"></span><strong>Pre-consultation to follow up</strong><small>Alex Wong - PAT-003 - Not submitted</small></div><button class="secondary-btn" data-patient="PAT-003">View patient</button></section>
        `;
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
        const doctorOptions = user.role === "doctor"
            ? `<option value="${user.id}">My Appointments</option>`
            : `<option value="">All Doctors</option>${state.doctors.map((doctor) => `<option value="${doctor.id}">${doctor.name}</option>`).join("")}`;
        const visibleAppointments = state.appointments.filter((item) => user.role !== "doctor" || item.doctorId === user.id);
        const selected = visibleAppointments.find((item) => item.id === params.get("appointment")) || visibleAppointments[0];

        byId("adminPage").innerHTML = `
            <section class="panel care-selector">
                <div class="panel-header">
                    <div><h2>Care Plan</h2><p>${user.role === "doctor" ? "Select a patient appointment to write or update the care plan." : "Select a patient appointment to view the doctor's care plan."}</p></div>
                    <span>${visibleAppointments.length} records</span>
                </div>
                <div class="table-toolbar">
                    <label class="toolbar-search"><input id="careSearch" placeholder="Search patient or appointment ID"></label>
                    <label><select id="careDoctor" ${user.role === "doctor" ? "disabled" : ""}>${doctorOptions}</select></label>
                    <label><select id="careService"><option value="">All Services</option><option>TCM Consultation</option><option>Acupuncture</option><option>Cupping</option><option>Herbal Medicine</option></select></label>
                    <label><select id="careStatus"><option value="">All Statuses</option><option>Draft</option><option>Saved</option><option>Completed</option><option>No care plan</option></select></label>
                </div>
                <div id="carePlanList"></div>
            </section>
            <div id="carePlanDetail" style="margin-top:18px"></div>
        `;

        if (user.role === "doctor") byId("careDoctor").value = user.id;
        ["careSearch", "careDoctor", "careService", "careStatus"].forEach((id) => byId(id).addEventListener("input", () => drawCarePlanList()));
        drawCarePlanList(selected?.id);
    }

    function filteredCareAppointments() {
        const user = current();
        const state = data();
        const query = (byId("careSearch")?.value || "").toLowerCase();
        const doctorFilter = user.role === "doctor" ? user.id : byId("careDoctor")?.value;
        const serviceFilter = byId("careService")?.value;
        const statusFilter = byId("careStatus")?.value;
        return state.appointments.filter((item) => {
            const plan = latestCarePlan(state, item.id);
            const planStatus = plan?.status || "No care plan";
            return (user.role !== "doctor" || item.doctorId === user.id) &&
                (!query || `${item.id} ${item.patient} ${item.contact}`.toLowerCase().includes(query)) &&
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
        byId("adminPage").innerHTML = `<section class="panel"><div class="panel-header"><h2>Herbal Store Management</h2><button class="primary-btn" id="addProduct">+ Add Product</button></div><div class="table-toolbar"><label>Search Product<input id="productSearch"></label><label>Category<select id="productCategory"><option value="">All</option></select></label><label>Status<select id="productStatus"><option value="">All</option><option>Active</option><option>Inactive</option><option>Out of Stock</option><option>Low Stock</option></select></label></div><div id="productTable"></div></section>`;
        ["productSearch", "productCategory", "productStatus"].forEach((id) => byId(id).addEventListener("input", drawProducts));
        byId("addProduct").addEventListener("click", () => openProductForm());
        drawProducts();
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
        byId("adminPage").innerHTML = `<section class="panel order-management"><div class="panel-header"><h2>Order Management</h2></div><div class="table-toolbar"><label>Order ID<input id="orderIdSearch" type="search" placeholder="Search order ID"></label><label>Order Date<input id="orderDateFilter" type="date"></label><label>Status<select id="orderStatus"><option value="">All</option><option>Pending Payment</option><option>Paid</option><option>Pending Packing</option><option>Packed</option><option>Shipped</option><option>Completed</option><option>Cancelled</option></select></label><label>Payment Method<select id="orderPayment"><option value="">All</option><option>FPX</option><option>Card</option><option>eWallet</option></select></label></div><div id="orderTable"></div></section>`;
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

        byId("adminPage").innerHTML = `
            <section class="panel admin-message-page">
                <div class="panel-header"><h2>Communication Centre</h2></div>
                <div class="admin-messenger">
                    <aside class="admin-conversation-panel">
                        <div class="admin-conversation-heading">
                            <h3>Conversations</h3>
                            <input id="messageSearch" type="search" placeholder="Search conversations" aria-label="Search conversations">
                        </div>
                        <div class="admin-conversation-list" id="messageConversationList"></div>
                    </aside>
                    <section class="admin-chat-panel" id="chatWindow" aria-label="Conversation"></section>
                </div>
            </section>`;

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
        byId("adminPage").innerHTML = `<section class="panel"><div class="panel-header"><h2>Feedback Management</h2></div>${table(["Rating", "Patient", "Service", "Doctor", "Comment", "Date", "Actions"], rows)}</section>`;
    }

    function renderAnnouncements() {
        const state = data();
        byId("adminPage").innerHTML = `<section class="panel"><div class="panel-header"><h2>Clinic Announcement</h2><button class="primary-btn" id="newAnnouncement">Create announcement</button></div><div id="announcementTable"></div></section>`;
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

    function renderAnalytics() {
        const state = data();
        const completed = state.appointments.filter((item) => item.status === "Completed").length;
        const cancelled = state.appointments.filter((item) => item.status === "Cancelled").length;
        const scheduled = state.appointments.filter((item) => ["Scheduled", "Rescheduled"].includes(item.status)).length;
        const totalSales = state.orders.reduce((sum, order) => sum + Number(order.total), 0);
        const productCounts = {};
        state.orders.forEach((order) => order.items.forEach((item) => productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity));
        byId("adminPage").innerHTML = `
            <div class="kpi-grid">
                ${kpi(state.appointments.length, "Total Appointments", "All demo records", "#")}
                ${kpi(completed, "Completed", "Finished consultations", "#")}
                ${kpi(cancelled, "Cancelled", "Cancelled appointments", "#")}
                ${kpi(scheduled, "Scheduled", "Upcoming visits", "#")}
            </div>
            <div class="dashboard-layout">
                <section class="panel"><h2>Product Analytics</h2><p>Total Orders: ${state.orders.length}</p><p>Total Sales: ${money(totalSales)}</p>${Object.entries(productCounts).map(([name, count]) => `<div class="chart-bar"><span>${name}</span><span><i style="width:${Math.min(100, count * 20)}%"></i></span><strong>${count}</strong></div>`).join("")}</section>
                <section class="panel"><h2>Doctor Analytics</h2>${table(["Doctor", "Appointments", "Completed", "Cancelled"], state.doctors.map((doctor) => `<tr><td>${doctor.name}</td><td>${state.appointments.filter((item) => item.doctorId === doctor.id).length}</td><td>${state.appointments.filter((item) => item.doctorId === doctor.id && item.status === "Completed").length}</td><td>${state.appointments.filter((item) => item.doctorId === doctor.id && item.status === "Cancelled").length}</td></tr>`))}</section>
            </div>
        `;
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (document.body.dataset.page === "login") {
            initLogin();
            return;
        }
        const page = document.body.dataset.page;
        if (!protect(page)) return;
        renderShell(page, document.body.dataset.title || "Admin Portal");
        pages[page]?.();
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
