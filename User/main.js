const savedName = sessionStorage.getItem("tcmPatientName");

if (savedName) {
    const firstName =
        savedName.charAt(0).toUpperCase() + savedName.slice(1);

    document.getElementById("patientName").textContent = firstName;
    document.getElementById("welcomeName").textContent = firstName;
}

/* Wellness mood selection */

document.querySelectorAll(".mood-row button").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".mood-row button").forEach((item) => {
            item.classList.remove("selected");
        });

        button.classList.add("selected");
    });
});

/* Save wellness check-in */

document.querySelector(".save-button").addEventListener("click", () => {
    const toast = document.getElementById("toast");

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
});

/* Appointment filters */

const filterButtons = document.querySelectorAll(".filter-button");
const dayButtons = document.querySelectorAll(".day-button");
const practitionerCards = document.querySelectorAll(".practitioner-card");
const doctorSearch = document.getElementById("doctorSearch");
const noResults = document.getElementById("noResults");
const bookingSuccess = document.getElementById("bookingSuccess");
const bookingMessage = document.getElementById("bookingMessage");

let selectedService = "all";
let selectedDay = "today";
let noResultsDueToBooking = false;
let blockedAppointmentDates = [];

const fallbackSchedules = [
    { doctorId: "dr-lim", workingDays: ["Monday", "Wednesday", "Friday"], morningStart: "09:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00", slotDuration: 30, capacity: 1, unavailable: [] },
    { doctorId: "dr-tan", workingDays: ["Tuesday", "Thursday", "Saturday"], morningStart: "09:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00", slotDuration: 30, capacity: 1, unavailable: [] },
    { doctorId: "dr-wong", workingDays: ["Monday", "Tuesday", "Friday"], morningStart: "10:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "17:00", slotDuration: 30, capacity: 1, unavailable: [] }
];

const services = {
    consultation: "TCM Consultation",
    acupuncture: "Acupuncture",
    herbal: "Herbal Medicine",
    cupping: "Cupping Therapy"
};

function readAppointmentData() {
    const data = window.TcmAdminData.load();
    return {
        appointments: Array.isArray(data.appointments) ? data.appointments : [],
        patients: Array.isArray(data.patients) ? data.patients : [],
        schedules: Array.isArray(data.schedules) ? data.schedules : [],
        raw: data
    };
}

function localDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function toMinutes(time) {
    const [hours, minutes] = String(time || "").split(":").map(Number);
    return hours * 60 + minutes;
}

function toTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function displayTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const suffix = hours >= 12 ? "PM" : "AM";
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function displayDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function dateRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (selectedDay === "tomorrow") start.setDate(start.getDate() + 1);
    return Array.from({ length: selectedDay === "week" ? 7 : 1 }, (_, index) => {
        const date = new Date(start);
        if (selectedDay === "week") date.setDate(date.getDate() + index);
        return date;
    });
}

function getSchedule(data, doctorId) {
    return data.schedules.find((item) => item.doctorId === doctorId) ||
        fallbackSchedules.find((item) => item.doctorId === doctorId);
}

function hasAppointmentOnDate(data, dateString) {
    const email = (sessionStorage.getItem("tcmPatientEmail") || "").trim().toLowerCase();
    if (!email) return false;
    const patient = data.patients.find((item) =>
        String(item.email || "").trim().toLowerCase() === email
    );
    return data.appointments.some((appointment) =>
        appointment.date === dateString &&
        appointment.status !== "Cancelled" &&
        (appointment.patientId === patient?.id ||
            String(appointment.patientEmail || "").trim().toLowerCase() === email)
    );
}

function patientAppointmentDates(data) {
    const email = (sessionStorage.getItem("tcmPatientEmail") || "").trim().toLowerCase();
    if (!email) return [];
    const patient = data.patients.find((item) =>
        String(item.email || "").trim().toLowerCase() === email
    );
    return [...new Set(data.appointments
        .filter((appointment) =>
            appointment.status !== "Cancelled" &&
            (appointment.patientId === patient?.id ||
                String(appointment.patientEmail || "").trim().toLowerCase() === email)
        )
        .map((appointment) => appointment.date)
        .filter(Boolean))].sort();
}

function availableSlots(data, card) {
    const doctorId = card.dataset.doctorId;
    const schedule = getSchedule(data, doctorId);
    if (!schedule || !Array.isArray(schedule.workingDays)) return [];

    const duration = Math.max(1, Number(schedule.slotDuration) || 30);
    const capacity = Math.max(1, Number(schedule.capacity) || 1);
    const unavailable = Array.isArray(schedule.unavailable) ? schedule.unavailable : [];
    const intervals = [
        [schedule.morningStart, schedule.morningEnd],
        [schedule.afternoonStart, schedule.afternoonEnd]
    ];
    const now = new Date();
    const today = localDate(now);

    const slots = dateRange().flatMap((date) => {
        const dateString = localDate(date);
        const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
        if (!schedule.workingDays.includes(weekday) ||
            unavailable.some((item) => item.date === dateString)) return [];

        return intervals.flatMap(([start, end]) => {
            if (!start || !end) return [];
            const slots = [];
            for (let time = toMinutes(start); time + duration <= toMinutes(end); time += duration) {
                const slotTime = toTime(time);
                const occupied = data.appointments.filter((appointment) => {
                    if (appointment.doctorId !== doctorId ||
                        appointment.date !== dateString ||
                        appointment.status === "Cancelled") return false;

                    const appointmentStart = toMinutes(appointment.time);
                    const appointmentEnd = appointment.endTime
                        ? toMinutes(appointment.endTime)
                        : appointmentStart + duration;
                    return Number.isFinite(appointmentStart) &&
                        Number.isFinite(appointmentEnd) &&
                        appointmentStart < time + duration &&
                        appointmentEnd > time;
                }).length;
                if (occupied >= capacity) continue;

                const slotDateTime = new Date(`${dateString}T${slotTime}:00`);
                if (dateString === today && slotDateTime <= now) continue;
                slots.push({ date: dateString, time: slotTime, endTime: toTime(time + duration) });
            }
            return slots;
        });
    });
    return slots.sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    ).filter((slot) => !hasAppointmentOnDate(data, slot.date));
}

function updatePractitionerList() {
    const searchText = doctorSearch.value.toLowerCase().trim();
    let visibleCards = 0;
    let data;

    try {
        data = readAppointmentData();
    } catch (error) {
        console.error("Could not load appointment availability.", error);
        practitionerCards.forEach((card) => {
            card.classList.add("hidden");
            card.querySelector(".time-slots").innerHTML = "<strong>Availability could not be loaded. Please refresh.</strong>";
        });
        noResults.classList.add("show");
        noResults.classList.remove("appointment-booked");
        noResultsDueToBooking = false;
        blockedAppointmentDates = [];
        noResults.textContent = "Appointment availability is unavailable. Please refresh and try again.";
        return;
    }

    practitionerCards.forEach((card) => {
        const servicesForCard = card.dataset.services.split(",");
        const name = card.dataset.name;
        const matchesService = selectedService === "all" || servicesForCard.includes(selectedService);
        const matchesSearch =
            `${name} ${servicesForCard.map((service) => services[service]).join(" ")}`.toLowerCase().includes(searchText);
        const slots = availableSlots(data, card);
        const timeSlots = card.querySelector(".time-slots");

        if (slots.length) {
            const grouped = new Map();
            slots.forEach((slot) => {
                if (!grouped.has(slot.date)) grouped.set(slot.date, []);
                grouped.get(slot.date).push(slot);
            });
            timeSlots.innerHTML = `<div class="slot-list">${[...grouped.entries()].map(([date, dateSlots]) =>
                `<div class="slot-group"><strong class="availability-date">${displayDate(date)}</strong><div class="slot-times">${dateSlots.map((slot) =>
                    `<button class="time-button" type="button" data-date="${slot.date}" data-time="${slot.time}" data-end-time="${slot.endTime}">${displayTime(slot.time)}</button>`
                ).join("")}</div></div>`
            ).join("")}</div>`;
        } else {
            timeSlots.innerHTML = "<strong>No available times in this date range.</strong>";
        }

        const shouldShow = matchesService && matchesSearch && slots.length > 0;
        card.classList.toggle("hidden", !shouldShow);
        if (shouldShow) visibleCards++;
    });

    blockedAppointmentDates = dateRange()
        .map(localDate)
        .filter((date) => hasAppointmentOnDate(data, date));
    noResultsDueToBooking = visibleCards === 0 && blockedAppointmentDates.length > 0;
    noResults.classList.toggle("appointment-booked", noResultsDueToBooking);
    noResults.textContent = noResultsDueToBooking
        ? `You already have an appointment on ${blockedAppointmentDates.map(displayDate).join(", ")}. You can book only one appointment per day. Choose another date to see more available times.`
        : "No practitioners are available for these dates and filters.";
    noResults.classList.toggle("show", visibleCards === 0);
}

/* Medical service filter */

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");
        selectedService = button.dataset.service;

        updatePractitionerList();
    });
});

/* Date filter */

dayButtons.forEach((button) => {
    button.addEventListener("click", () => {
        dayButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");
        selectedDay = button.dataset.day;

        updatePractitionerList();
        if (noResultsDueToBooking) {
            showAppointmentNotice(blockedAppointmentDates);
        }
    });
});

/* Search doctor or service */

doctorSearch.addEventListener("input", updatePractitionerList);

window.addEventListener("storage", (event) => {
    if (event.key === "tcmAdminData") updatePractitionerList();
});

/* Confirm the appointment before saving it */

const bookingConfirmation = document.getElementById("bookingConfirmation");
const confirmationDetails = document.getElementById("confirmationDetails");
const confirmBookingButton = document.getElementById("confirmBooking");
const appointmentNotice = document.getElementById("appointmentNotice");
const appointmentNoticeMessage = document.getElementById("appointmentNoticeMessage");
let pendingBooking = null;

function closeBookingConfirmation() {
    pendingBooking = null;
    bookingConfirmation.classList.remove("show");
    bookingConfirmation.setAttribute("aria-hidden", "true");
}

document.querySelectorAll("[data-close-booking-confirmation]").forEach((element) => {
    element.addEventListener("click", closeBookingConfirmation);
});

function closeAppointmentNotice() {
    appointmentNotice.classList.remove("show");
    appointmentNotice.setAttribute("aria-hidden", "true");
}

function showAppointmentNotice(dates) {
    const dateText = dates.map(displayDate);
    const appointmentList = dateText.length === 1
        ? dateText[0]
        : `${dateText.slice(0, -1).join(", ")} and ${dateText.at(-1)}`;
    appointmentNoticeMessage.textContent =
        `You already have an appointment on ${appointmentList}. You can book only one appointment per day. Choose a different date to see other available times.`;
    appointmentNotice.classList.add("show");
    appointmentNotice.setAttribute("aria-hidden", "false");
    appointmentNotice.querySelector("[data-close-appointment-notice]").focus();
}

document.querySelectorAll("[data-close-appointment-notice]").forEach((element) => {
    element.addEventListener("click", closeAppointmentNotice);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bookingConfirmation.classList.contains("show")) {
        closeBookingConfirmation();
    }
    if (event.key === "Escape" && appointmentNotice.classList.contains("show")) {
        closeAppointmentNotice();
    }
});

document.querySelector(".practitioner-list").addEventListener("click", (event) => {
    const button = event.target.closest(".time-button");
    if (!button) return;

    const card = button.closest(".practitioner-card");
    try {
        const data = readAppointmentData();
        const currentSlot = availableSlots(data, card).find((slot) =>
            slot.date === button.dataset.date && slot.time === button.dataset.time
        );
        if (!currentSlot) {
            updatePractitionerList();
            bookingSuccess.querySelector("strong").textContent = "Time no longer available";
            bookingMessage.textContent = "Please choose another available time.";
            bookingSuccess.classList.add("show");
            return;
        }
        const doctorName = card.querySelector("h3").textContent;
        const service = selectedService === "all"
            ? services[card.dataset.services.split(",")[0]]
            : services[selectedService];
        pendingBooking = {
            doctorId: card.dataset.doctorId,
            doctor: doctorName,
            service,
            date: currentSlot.date,
            time: currentSlot.time,
            endTime: currentSlot.endTime
        };
        confirmationDetails.textContent =
            `${service} · ${displayDate(currentSlot.date)} at ${displayTime(currentSlot.time)} · ${doctorName}`;
        bookingConfirmation.classList.add("show");
        bookingConfirmation.setAttribute("aria-hidden", "false");
        confirmBookingButton.focus();
    } catch (error) {
        console.error("Could not prepare appointment confirmation.", error);
        bookingSuccess.querySelector("strong").textContent = "Time no longer available";
        bookingMessage.textContent = "Please refresh availability and choose another time.";
        bookingSuccess.classList.add("show");
    }
});

confirmBookingButton.addEventListener("click", () => {
    if (!pendingBooking) return;
    const booking = pendingBooking;
    const email = (sessionStorage.getItem("tcmPatientEmail") || "").trim().toLowerCase();
    if (!email) {
        closeBookingConfirmation();
        bookingSuccess.querySelector("strong").textContent = "Please sign in to book";
        bookingMessage.textContent = "Sign in to your patient account, then select an appointment time.";
        bookingSuccess.classList.add("show");
        return;
    }

    try {
        const data = readAppointmentData();
        const card = [...practitionerCards].find((item) => item.dataset.doctorId === booking.doctorId);
        const currentSlot = card && availableSlots(data, card).find((slot) =>
            slot.date === booking.date && slot.time === booking.time
        );
        if (!currentSlot) {
            const alreadyBookedThatDay = hasAppointmentOnDate(data, booking.date);
            closeBookingConfirmation();
            updatePractitionerList();
            bookingSuccess.querySelector("strong").textContent = alreadyBookedThatDay
                ? "You already have an appointment that day"
                : "Time no longer available";
            bookingMessage.textContent = alreadyBookedThatDay
                ? "You can book only one appointment per day. Choose a different date."
                : "Please choose another available time.";
            bookingSuccess.classList.add("show");
            return;
        }

        const savedData = data.raw;
        let patient = savedData.patients.find((item) =>
            String(item.email || "").trim().toLowerCase() === email
        );
        if (!patient) {
            const patientName = sessionStorage.getItem("tcmPatientName") || email.split("@")[0];
            patient = {
                id: `PAT-${Date.now()}`,
                name: patientName,
                email,
                phone: "",
                joined: localDate(new Date()),
                preConsultation: { submitted: false }
            };
            savedData.patients.push(patient);
        }

        const appointment = {
            id: `APT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            patientId: patient.id,
            patient: patient.name,
            contact: patient.phone || "",
            service: booking.service,
            date: currentSlot.date,
            time: currentSlot.time,
            endTime: currentSlot.endTime,
            doctorId: booking.doctorId,
            doctor: booking.doctor,
            room: "To be assigned",
            status: "Scheduled"
        };
        savedData.appointments.push(appointment);
        window.TcmAdminData.save(savedData);

        closeBookingConfirmation();
        bookingSuccess.querySelector("strong").textContent = "Appointment booked";
        bookingMessage.textContent =
            `${appointment.service} with ${appointment.doctor} · ${displayDate(appointment.date)} at ${displayTime(appointment.time)}.`;
        bookingSuccess.classList.add("show");
        updatePractitionerList();
        bookingSuccess.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
        console.error("Could not save appointment booking.", error);
        bookingSuccess.querySelector("strong").textContent = "Booking could not be saved";
        bookingMessage.textContent = "Please refresh the page and try again.";
        bookingSuccess.classList.add("show");
    }
});

/* Logout */

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("tcmPatientName");
    sessionStorage.removeItem("tcmPatientEmail");
    window.location.href = "login.html";
});

/* Mobile sidebar */

document.getElementById("menuButton").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
});

/* Show doctors when page first loads */

updatePractitionerList();