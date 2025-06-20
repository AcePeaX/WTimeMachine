const USER_STORAGE_KEY = "chat-users";
const SPECTATE_STORAGE_KEY = "chat-spectate";

// Load all users
export function loadUsers() {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Save full list
export function saveUsers(users) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
}

// Add a new user
export function addUser(newUser) {
    const users = loadUsers();
    users.push(newUser);
    saveUsers(users);
}

// Delete by username
export function deleteUser(username) {
    const users = loadUsers().filter((u) => u.username !== username);
    saveUsers(users);
}

function loadSpectate() {
    const data = localStorage.getItem(SPECTATE_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

function saveSpectate(obj){
    localStorage.setItem(SPECTATE_STORAGE_KEY, JSON.stringify(obj));
}

export function getSpectate(username, convoId) {
    const spectate = loadSpectate();
    if(!spectate[username]){
        return null;
    }
    if(!spectate[username][convoId]){
        return null
    }
    return spectate[username][convoId]
}

export function setSpectate(username, convoId, spectated) {
    const spectate = loadSpectate();
    const convDict = spectate[username] ? spectate[username] : {};
    convDict[convoId] = spectated
    spectate[username] = convDict
    saveSpectate(spectate)
}

export function deleteSpectate(username, convoId) {
    const spectate = loadSpectate();
    if(!spectate[username]){
        return;
    }
    if(!spectate[username][convoId]){
        return;
    }
    delete spectate[username][convoId]
    saveSpectate(spectate)
}



// Session storage

// sessionUser.js

const SESSION_KEY = "currentUser";

// Load the currently active user from sessionStorage
export function loadSessionUser() {
    const json = sessionStorage.getItem(SESSION_KEY);
    if (!json) return null;

    try {
        return JSON.parse(json); // { username, encryptedPrivateKey, ... }
    } catch (e) {
        console.error("Failed to parse session user:", e);
        return null;
    }
}

// Set the current user in sessionStorage
export function setSessionUser(username, privateKey, publicKey) {
    const user = {
        username,
        privateKey,
        publicKey
    };
    // Validate the user object
    if (!user || typeof user !== "object") {
        throw new Error("Invalid user object");
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

// Delete the current user from sessionStorage
export function clearSessionUser() {
    sessionStorage.removeItem(SESSION_KEY);
}



function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;

    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) =>
        Math.round(
            255 *
                (l -
                    a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))
        );

    return `#${[f(0), f(8), f(4)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")}`;
}

function generateHSLColorFromText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    let hue = hash % 360;
    if (hue < 0) hue = hue + 360;
    return hslToHex(hue, 70, 45); // pastel-like
}

export function generateColorFromUsername(username) {
    if (!username) {
        return "#000000"; // Default color for empty username
    }
    const color = generateHSLColorFromText(username);
    return color;
}
