const profileStorageKey = "tcmPatientProfile";
const profileForm = document.getElementById("profileForm");
const photoInput = document.getElementById("photoInput");
const profilePreview = document.getElementById("profilePreview");
const headerAvatar = document.getElementById("headerAvatar");
const headerName = document.getElementById("headerName");
const toast = document.getElementById("profileToast");

let toastTimer;
let profilePhotoData = "";

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase()).join("") || "JL";
}

function renderAvatar(imageData, name) {
    if (imageData) {
        profilePreview.src = imageData;
        profilePreview.style.visibility = "visible";
        headerAvatar.innerHTML = "";
        headerAvatar.classList.add("profile-image");
        headerAvatar.style.backgroundImage = `url("${imageData}")`;
        headerAvatar.style.backgroundSize = "cover";
        headerAvatar.style.backgroundPosition = "center";
        headerAvatar.textContent = "";
    } else {
        profilePreview.removeAttribute("src");
        profilePreview.style.visibility = "hidden";
        headerAvatar.classList.remove("profile-image");
        headerAvatar.style.backgroundImage = "";
        headerAvatar.textContent = initials(name);
    }

    headerName.textContent = name || "Jamie Lee";
}

function getSavedProfile() {
    try {
        return JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
    } catch {
        return {};
    }
}

function saveProfile(profile) {
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
}

function loadProfile() {
    const profile = getSavedProfile();
    const sessionName = sessionStorage.getItem("tcmPatientName");
    const name = profile.fullName || (sessionName
        ? sessionName.charAt(0).toUpperCase() + sessionName.slice(1)
        : "Jamie Lee");

    document.getElementById("fullName").value = name;
    document.getElementById("email").value = profile.email || "";
    document.getElementById("phone").value = profile.phone || "";
    document.getElementById("birthDate").value = profile.birthDate || "";
    document.getElementById("contactMethod").value = profile.contactMethod || "phone";
    document.getElementById("address").value = profile.address || "";

    profilePhotoData = profile.photo || "";
    renderAvatar(profilePhotoData, name);
}

profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;

    const existingProfile = getSavedProfile();
    const profile = {
        ...existingProfile,
        fullName: document.getElementById("fullName").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        birthDate: document.getElementById("birthDate").value,
        contactMethod: document.getElementById("contactMethod").value,
        address: document.getElementById("address").value.trim(),
        photo: profilePhotoData
    };

    try {
        saveProfile(profile);
        sessionStorage.setItem("tcmPatientName", profile.fullName);
        renderAvatar(profilePhotoData, profile.fullName);
        showToast("Profile saved in this browser.");
    } catch {
        showToast("Could not save profile. Try choosing a smaller picture.");
    }
});

photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Choose an image file.");
        photoInput.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast("Choose an image smaller than 5 MB.");
        photoInput.value = "";
        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
        const image = new Image();

        image.addEventListener("load", () => {
            const maxSize = 512;
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");

            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);

            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            profilePhotoData = canvas.toDataURL("image/jpeg", 0.8);

            const profile = getSavedProfile();
            profile.photo = profilePhotoData;

            try {
                saveProfile(profile);
                renderAvatar(profilePhotoData, document.getElementById("fullName").value);
                showToast("Profile picture saved.");
            } catch {
                profilePhotoData = "";
                showToast("Could not save the picture. Try a smaller image.");
            }
        });

        image.addEventListener("error", () => {
            showToast("Could not open that image. Try another file.");
        });

        image.src = reader.result;
    });

    reader.addEventListener("error", () => {
        showToast("Could not read that image. Try another file.");
    });

    reader.readAsDataURL(file);
});

document.getElementById("removePhoto").addEventListener("click", () => {
    profilePhotoData = "";
    photoInput.value = "";

    const profile = getSavedProfile();
    delete profile.photo;

    try {
        saveProfile(profile);
        renderAvatar("", document.getElementById("fullName").value);
        showToast("Profile picture removed.");
    } catch {
        showToast("Could not update the saved profile.");
    }
});

document.getElementById("resetProfile").addEventListener("click", () => {
    setTimeout(loadProfile);
});

document.getElementById("passwordForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
        document.getElementById("confirmPassword").setCustomValidity("Passwords do not match.");
        document.getElementById("confirmPassword").reportValidity();
        document.getElementById("confirmPassword").setCustomValidity("");
        return;
    }

    showToast("Connect this form to your secure login system to change the password.");
    event.target.reset();
});

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("tcmPatientName");
    window.location.href = "login.html";
});

document.getElementById("menuButton").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
});

loadProfile();