const doctorModal = document.getElementById("doctorModal");
const doctorCards = document.querySelectorAll(".practitioner-card");

const doctorData = {
    "dr lim wei ming": {
        id: "dr-lim",
        initials: "LW",
        description:
            "Dr. Lim provides general TCM consultations and acupuncture. Select an available appointment time on the main page to request a visit."
    },
    "dr tan mei ling": {
        id: "dr-tan",
        initials: "TM",
        description:
            "Dr. Tan focuses on herbal medicine, general TCM consultations, and women's wellness. Select an available appointment time on the main page to request a visit."
    },
    "dr wong jun hao": {
        id: "dr-wong",
        initials: "WJ",
        description:
            "Dr. Wong provides acupuncture and cupping therapy. Select an available appointment time on the main page to request a visit."
    }
};

function openDoctorDetails(card) {
    const name = card.querySelector("h3")?.textContent.trim() || "Practitioner";
    const role =
        card.querySelector(".practitioner-details > p")?.textContent.trim() || "";

    const doctor = doctorData[name.toLowerCase()] || {
        id: "care-team",
        initials: name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2),
        description: "Contact the care team for more information about this practitioner."
    };

    const services = [...card.querySelectorAll(".treatment-tag")]
        .map((tag) => tag.textContent.replace(/^✓\s*/, "").trim())
        .filter(Boolean);

    document.getElementById("doctorModalName").textContent = name;
    document.getElementById("doctorModalRole").textContent = role;
    document.getElementById("doctorModalAvatar").textContent = doctor.initials;
    document.getElementById("doctorModalDescription").textContent =
        doctor.description;

    const serviceContainer = document.getElementById("doctorModalServices");
    serviceContainer.replaceChildren();

    services.forEach((service) => {
        const tag = document.createElement("span");
        tag.textContent = service;
        serviceContainer.append(tag);
    });

    document.getElementById("doctorMessageLink").href =
        `messages.html?doctor=${encodeURIComponent(doctor.id)}`;

    doctorModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.querySelector(".doctor-modal-close").focus();
}

function closeDoctorDetails() {
    doctorModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

doctorCards.forEach((card) => {
    const doctorInfo = card.querySelector(".practitioner-main");
    if (!doctorInfo) return;

    doctorInfo.setAttribute("tabindex", "0");
    doctorInfo.setAttribute("role", "button");
    doctorInfo.setAttribute("aria-label", "View practitioner details");

    doctorInfo.addEventListener("click", () => {
        openDoctorDetails(card);
    });

    doctorInfo.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDoctorDetails(card);
        }
    });
});

doctorModal.querySelectorAll("[data-close-doctor-modal]").forEach((button) => {
    button.addEventListener("click", closeDoctorDetails);
});

document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        doctorModal.getAttribute("aria-hidden") === "false"
    ) {
        closeDoctorDetails();
    }
});