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

function updatePractitionerList() {
    const searchText = doctorSearch.value.toLowerCase().trim();
    let visibleCards = 0;

    practitionerCards.forEach((card) => {
        const services = card.dataset.services;
        const name = card.dataset.name;
        const days = card.dataset.days;

        const matchesService =
            selectedService === "all" ||
            services.includes(selectedService);

        const matchesDay = days.includes(selectedDay);

        const matchesSearch =
            name.includes(searchText) ||
            services.includes(searchText);

        const shouldShow =
            matchesService &&
            matchesDay &&
            matchesSearch;

        card.classList.toggle("hidden", !shouldShow);

        if (shouldShow) {
            visibleCards++;
        }
    });

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
    });
});

/* Search doctor or service */

doctorSearch.addEventListener("input", updatePractitionerList);

/* Select appointment time */

document.querySelectorAll(".time-button").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".time-button").forEach((item) => {
            item.classList.remove("selected");
        });

        button.classList.add("selected");

        const doctorCard = button.closest(".practitioner-card");
        const doctorName = doctorCard.querySelector("h3").textContent;
        const selectedTime = button.textContent;
        const selectedDayText =
            document.querySelector(".day-button.active").textContent;

        bookingMessage.textContent =
            doctorName + " · " +
            selectedDayText + " at " +
            selectedTime;

        bookingSuccess.classList.add("show");

        bookingSuccess.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    });
});

/* Logout */

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("tcmPatientName");
    window.location.href = "login.html";
});

/* Mobile sidebar */

document.getElementById("menuButton").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
});

/* Show doctors when page first loads */

updatePractitionerList();