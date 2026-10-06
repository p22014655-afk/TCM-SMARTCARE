// Browser-only demo authentication. Production applications must authenticate
// and reset passwords on a secure server.
window.TcmAuth = (() => {
    const accountKey = "tcmPatientAccount";
    const iterations = 150000;

    function bytesToBase64(bytes) {
        let binary = "";
        bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        return btoa(binary);
    }

    function base64ToBytes(value) {
        return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    }

    async function deriveHash(password, saltBytes) {
        if (!window.crypto?.subtle) {
            throw new Error("Secure browser cryptography is unavailable. Open this page through localhost or HTTPS.");
        }

        const passwordKey = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveBits"]
        );

        const bits = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: saltBytes,
                iterations,
                hash: "SHA-256"
            },
            passwordKey,
            256
        );

        return new Uint8Array(bits);
    }

    async function setPassword(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await deriveHash(password, salt);

        localStorage.setItem(accountKey, JSON.stringify({
            email: normalizedEmail,
            salt: bytesToBase64(salt),
            hash: bytesToBase64(hash),
            iterations
        }));
    }

    async function verifyPassword(email, password) {
        let account;
        try {
            account = JSON.parse(localStorage.getItem(accountKey) || "null");
        } catch {
            return false;
        }

        if (!account || account.email !== email.trim().toLowerCase()) {
            return false;
        }

        const salt = base64ToBytes(account.salt);
        const expectedHash = base64ToBytes(account.hash);
        const actualHash = await deriveHash(password, salt);

        if (expectedHash.length !== actualHash.length) return false;

        let difference = 0;
        for (let index = 0; index < expectedHash.length; index += 1) {
            difference |= expectedHash[index] ^ actualHash[index];
        }
        return difference === 0;
    }

    return { setPassword, verifyPassword };
})();
