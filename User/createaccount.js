const createAccountForm = document.getElementById("createAccountForm");
const createPassword = document.getElementById("password");
const createConfirmPassword = document.getElementById("confirmPassword");
const createPasswordError = document.getElementById("passwordError");
const createConfirmPasswordError =
    document.getElementById("confirmPasswordError");

const passwordRequirements = [
    {
        label: "At least 8 characters",
        test: (value) => value.length >= 8
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

function setError(id, message) {
    document.getElementById(id).textContent = message;
}

function clearErrors() {
    document.querySelectorAll(".field-error").forEach((element) => {
        element.textContent = "";
    });
}

function createChecklist(input, errorElement, id) {
    const list = document.createElement("ul");
    list.id = id;
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

    errorElement.before(list);

    function update() {
        list.replaceChildren();

        passwordRequirements.forEach((requirement) => {
            const passed = requirement.test(input.value);
            const item = document.createElement("li");

            item.textContent = `${passed ? "✓" : "○"} ${requirement.label}`;

            Object.assign(item.style, {
                color: passed ? "#287052" : "#9a5550",
                fontSize: "11px"
            });

            list.append(item);
        });
    }

    input.addEventListener("input", update);
    update();

    return update;
}

const updateCreatePasswordChecklist = createChecklist(
    createPassword,
    createPasswordError,
    "createPasswordChecklist"
);

createConfirmPassword.addEventListener("input", () => {
    if (!createConfirmPassword.value) {
        createConfirmPasswordError.textContent = "";
    } else if (createPassword.value !== createConfirmPassword.value) {
        createConfirmPasswordError.textContent = "The passwords do not match.";
    } else {
        createConfirmPasswordError.textContent = "";
    }
});

createAccountForm.addEventListener("submit", (event) => {
    clearErrors();
    updateCreatePasswordChecklist();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const phone = document.getElementById("phone").value.trim();
    const gender = document.getElementById("gender").value;
    const age = Number(document.getElementById("age").value);
    const password = createPassword.value;
    const confirmPassword = createConfirmPassword.value;
    const termsAccepted = document.getElementById("terms").checked;

    let isValid = true;

    if (fullName.length < 2) {
        setError("fullNameError", "Enter your full name.");
        isValid = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("emailError", "Enter a valid email address.");
        isValid = false;
    }

    if (phone.replace(/\D/g, "").length < 7) {
        setError("phoneError", "Enter a valid phone number.");
        isValid = false;
    }

    if (!gender) {
        setError("genderError", "Select a gender option.");
        isValid = false;
    }

    if (!Number.isInteger(age) || age < 1 || age > 120) {
        setError("ageError", "Enter an age from 1 to 120.");
        isValid = false;
    }

    const missingRequirements = passwordRequirements.filter(
        (requirement) => !requirement.test(password)
    );

    if (missingRequirements.length > 0) {
        createPasswordError.textContent =
            "Password is missing: " +
            missingRequirements.map((requirement) => requirement.label).join(", ") +
            ".";
        isValid = false;
    }

    if (password !== confirmPassword) {
        createConfirmPasswordError.textContent = "The passwords do not match.";
        isValid = false;
    }

    if (!termsAccepted) {
        setError("termsError", "Please check the box to continue.");
        isValid = false;
    }

        
        if (!isValid) {
            event.preventDefault();

            document.getElementById("formStatus").textContent =
                "Please correct the highlighted fields.";

            return;
        }
    });

    // Display PHP registration result
    const params = new URLSearchParams(window.location.search);

    const messages = {
        details: "Please check your registration details.",
        phone: "Invalid phone number.",
        password: "Password does not meet the requirements.",
        confirm: "Passwords do not match.",
        terms: "Please accept the agreement.",
        duplicate: "This email is already registered.",
        server: "Registration failed. Please try again."
    };

    const formStatus = document.getElementById("formStatus");

    if (params.has("error")) {
        formStatus.textContent =
            messages[params.get("error")] || "Registration failed.";

        formStatus.style.color = "#a33c3c";
    }

    if (params.get("success") === "1") {
        formStatus.textContent =
            "Account created successfully! You can now log in.";

        formStatus.style.color = "#287052";
    }