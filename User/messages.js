const storageKey = "tcmMessages";

const conversations = [
    {
        id: "dr-lim",
        name: "Dr. Lim Wei Ming",
        role: "TCM Practitioner · Usually replies within one day",
        initials: "LW",
        unread: 1,
        messages: [
            {
                from: "them",
                text: "Hello Jamie, I reviewed your recent wellness check-in. How have you been feeling since your last visit?",
                time: "9:20 AM"
            },
            {
                from: "me",
                text: "I have been sleeping a little better, but my shoulder is still tight.",
                time: "9:34 AM"
            },
            {
                from: "them",
                text: "Thanks for letting me know. Please make a note of when the tightness is strongest, and we can discuss it at your appointment.",
                time: "9:42 AM"
            }
        ]
    },
    {
        id: "care-team",
        name: "Care Team",
        role: "Patient support · Usually replies within one day",
        initials: "TC",
        unread: 1,
        messages: [
            {
                from: "them",
                text: "Welcome to TCM Smartcare+. You can message us here if you need help with your appointments.",
                time: "Yesterday"
            }
        ]
    },
    {
        id: "dr-tan",
        name: "Dr. Tan Mei Ling",
        role: "TCM Practitioner · Usually replies within one day",
        initials: "TM",
        unread: 0,
        messages: [
            {
                from: "them",
                text: "Your herbal plan is ready to review. Please contact the care team if you have any questions.",
                time: "Monday"
            }
        ]
    },
    {
        id: "dr-wong",
        name: "Dr. Wong Jun Hao",
        role: "TCM Practitioner · Usually replies within one day",
        initials: "WJ",
        unread: 0,
        messages: [
            {
                from: "them",
                text: "Hello, how can I help with your acupuncture or cupping therapy questions?",
                time: "Today"
            }
        ]
    }
];

const requestedDoctor = new URLSearchParams(window.location.search).get("doctor");

let activeConversationId = conversations.some(
    (conversation) => conversation.id === requestedDoctor
)
    ? requestedDoctor
    : conversations[0].id;

try {
    const savedConversations = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
    );

    savedConversations.forEach((savedConversation) => {
        const conversation = conversations.find(
            (item) => item.id === savedConversation.id
        );

        if (conversation && Array.isArray(savedConversation.messages)) {
            conversation.messages = savedConversation.messages;
            conversation.unread = savedConversation.unread || 0;
        }
    });
} catch {
    // Use the sample conversations if saved data is unavailable.
}

const conversationList = document.getElementById("conversationList");
const chatMessages = document.getElementById("chatMessages");
const chatName = document.getElementById("chatName");
const chatStatus = document.getElementById("chatStatus");
const chatAvatar = document.getElementById("chatAvatar");
const messageInput = document.getElementById("messageInput");
const conversationSearch = document.getElementById("conversationSearch");

function saveConversations() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(conversations));
    } catch {
        alert("Could not save this message in your browser.");
    }
}

function renderConversationList(filter = "") {
    const query = filter.trim().toLowerCase();

    const matchingConversations = conversations.filter((conversation) =>
        conversation.name.toLowerCase().includes(query)
    );

    conversationList.replaceChildren();

    if (matchingConversations.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent = "No conversations found.";
        conversationList.append(emptyState);
        return;
    }

    matchingConversations.forEach((conversation) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "conversation-item";
        button.classList.toggle(
            "active",
            conversation.id === activeConversationId
        );

        const avatar = document.createElement("span");
        avatar.className = "conversation-avatar";
        avatar.textContent = conversation.initials;

        const summary = document.createElement("span");
        summary.className = "conversation-summary";

        const name = document.createElement("strong");
        name.textContent = conversation.name;
        summary.append(name);

        const meta = document.createElement("span");
        meta.className = "conversation-meta";

        const time = document.createElement("span");
        time.textContent =
            conversation.messages[conversation.messages.length - 1]?.time || "";

        const unread = document.createElement("span");
        unread.className = "unread-count";
        unread.textContent = conversation.unread
            ? String(conversation.unread)
            : "";

        meta.append(time, unread);
        button.append(avatar, summary, meta);

        button.addEventListener("click", () => {
            openConversation(conversation.id);
        });

        conversationList.append(button);
    });
}

function renderMessages() {
    const conversation = conversations.find(
        (item) => item.id === activeConversationId
    );

    if (!conversation) return;

    chatMessages.replaceChildren();

    const dateLabel = document.createElement("div");
    dateLabel.className = "message-date";
    dateLabel.textContent = "Recent messages";
    chatMessages.append(dateLabel);

    conversation.messages.forEach((item) => {
        const bubble = document.createElement("article");
        bubble.className =
            `message ${item.from === "me" ? "outgoing" : "incoming"}`;

        const text = document.createElement("div");
        text.textContent = item.text;

        const time = document.createElement("time");
        time.textContent = item.time;

        bubble.append(text, time);
        chatMessages.append(bubble);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function openConversation(id) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;

    activeConversationId = id;
    conversation.unread = 0;

    chatName.textContent = conversation.name;
    chatStatus.textContent = conversation.role;
    chatAvatar.textContent = conversation.initials;

    renderConversationList(conversationSearch.value);
    renderMessages();
    saveConversations();
}

conversationSearch.addEventListener("input", () => {
    renderConversationList(conversationSearch.value);
});

document.getElementById("messageForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const text = messageInput.value.trim();
    if (!text) return;

    const conversation = conversations.find(
        (item) => item.id === activeConversationId
    );
    if (!conversation) return;

    const time = new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    conversation.messages.push({
        from: "me",
        text,
        time
    });

    messageInput.value = "";
    renderMessages();
    renderConversationList(conversationSearch.value);
    saveConversations();
});

document.getElementById("menuButton").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
});

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("tcmPatientName");
    window.location.href = "login.html";
});

try {
    const profile = JSON.parse(
        localStorage.getItem("tcmPatientProfile") || "{}"
    );

    if (profile.fullName) {
        document.getElementById("headerName").textContent = profile.fullName;
    }

    if (profile.photo) {
        const avatar = document.getElementById("headerAvatar");
        avatar.textContent = "";
        avatar.classList.add("profile-image");
        avatar.style.backgroundImage = `url("${profile.photo}")`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.style.backgroundRepeat = "no-repeat";
    }
} catch {
    // Keep the default header avatar when profile data is unavailable.
}

openConversation(activeConversationId);