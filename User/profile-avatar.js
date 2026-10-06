(() => {
    const profileStorageKey = "tcmPatientProfile";

    function loadHeaderProfile() {
        const profileLink = document.querySelector(".topbar .profile-top-link");
        if (!profileLink) return;

        const avatar = profileLink.querySelector(".patient-avatar");
        const nameElement = profileLink.querySelector("strong");
        if (!avatar) return;

        let profile = {};
        try {
            profile = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
        } catch (error) {
            console.error("Could not load the saved profile.", error);
        }

        const savedName = profile.fullName || sessionStorage.getItem("tcmPatientName");
        if (savedName && nameElement) {
            nameElement.textContent = savedName;
        }

        if (profile.photo) {
            avatar.textContent = "";
            avatar.classList.add("profile-image");
            avatar.style.backgroundImage = `url("${profile.photo}")`;
            avatar.style.backgroundSize = "cover";
            avatar.style.backgroundPosition = "center";
            avatar.style.backgroundRepeat = "no-repeat";
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadHeaderProfile);
    } else {
        loadHeaderProfile();
    }
})();
