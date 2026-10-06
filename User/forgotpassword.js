const resetForm = document.getElementById("resetForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const newPasswordError = document.getElementById("newPasswordError");
const confirmPasswordError =
    document.getElementById("confirmPasswordError");

const resetPasswordRequirements = [
    {
        label: "At least 5 characters",
        test: (value) => value.length >= 5
    },
    {
        label: "At least 4 numbers",
        test: (value) => (value.match(/[0-9]/g) || []).length >= 4
    },
    {
        label: "At least 1 uppercase letter",
        test: (value) => /[A-Z]/.test(value)
    },
    {
        label: "At least 1 symbol, such as ! or @",
        test: (value) => /[^A-Za-z0-9]/.test(value)
    }
];

function createResetChecklist() {
    const list = document.createElement("ul");
    list.id = "resetPasswordChecklist";
    list.setAttribute("aria-live", "polite");

    Object.assign(list.style, {
        display: "grid",
        gap: "5px",
        margin: "3px 0",
        padding: "10px 12px",
        borderRadius: "8px",
        background: "#f4f8f7",
        listStyle: "none"
    });

    newPasswordError.before(list);

    function update() {
        list.replaceChildren();

        resetPasswordRequirements.forEach((requirement) => {
            const passed = requirement.test(newPasswordInput.value);
            const item = document.createElement("li");

            item.textContent = `${passed ? "✓" : "○"} ${requirement.label}`;

            Object.assign(item.style, {
                color: passed ? "#287052" : "#9a5550",
                fontSize: "11px"
            });

            list.append(item);
        });
    }

    newPasswordInput.addEventListener("input", update);
    update();

    return update;
}

const updateResetChecklist = createResetChecklist();

confirmPasswordInput.addEventListener("input", () => {
    if (!confirmPasswordInput.value) {
        confirmPasswordError.textContent = "";
    } else if (newPasswordInput.value !== confirmPasswordInput.value) {
        confirmPasswordError.textContent = "The passwords do not match.";
    } else {
        confirmPasswordError.textContent = "";
    }
});

resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    document.querySelectorAll(".field-error").forEach((element) => {
        element.textContent = "";
    });

    updateResetChecklist();

    const email = document.getElementById("resetEmail").value.trim().toLowerCase();
    const currentPassword =
        document.getElementById("currentPassword").value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const status = document.getElementById("resetStatus");
    const resetButton = document.getElementById("resetButton");

    status.textContent = "";

    let isValid = true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById("resetEmailError").textContent =
            "Enter a valid account email.";
        isValid = false;
    }

    if (!currentPassword) {
        document.getElementById("currentPasswordError").textContent =
            "Enter your current password.";
        isValid = false;
    }

    const missingRequirements = resetPasswordRequirements.filter(
        (requirement) => !requirement.test(newPassword)
    );

    if (missingRequirements.length > 0) {
        newPasswordError.textContent =
            "Password is missing: " +
            missingRequirements.map((requirement) => requirement.label).join(", ") +
            ".";
        isValid = false;
    }

    if (newPassword && newPassword === currentPassword) {
        newPasswordError.textContent =
            "Choose a new password different from your current password.";
        isValid = false;
    }

    if (newPassword !== confirmPassword) {
        confirmPasswordError.textContent = "The passwords do not match.";
        isValid = false;
    }

    if (!isValid) return;

    let profile;

    try {
        profile = JSON.parse(
            localStorage.getItem("tcmPatientProfile") || "null"
        );
    } catch {
        profile = null;
    }

    const savedEmail = (profile?.email || "").trim().toLowerCase();

    if (!savedEmail || savedEmail !== email) {
        document.getElementById("resetEmailError").textContent =
            "This email does not match the account saved in this browser.";
        return;
    }

    resetButton.disabled = true;
    resetButton.textContent = "Checking password...";

    try {
        const currentPasswordIsCorrect =
            await TcmAuth.verifyPassword(email, currentPassword);

        if (!currentPasswordIsCorrect) {
            document.getElementById("currentPasswordError").textContent =
                "The current password is incorrect.";
            resetButton.disabled = false;
            resetButton.textContent = "Reset password";
            return;
        }

        resetButton.textContent = "Saving new password...";
        await TcmAuth.setPassword(email, newPassword);

        status.textContent =
            "Password changed successfully. You can now log in with your new password.";

        resetForm.reset();
        updateResetChecklist();
        resetButton.textContent = "Password changed";
    } catch (error) {
        status.textContent =
            error.message || "Could not change your password. Please try again.";

        resetButton.disabled = false;
        resetButton.textContent = "Reset password";
    }
});