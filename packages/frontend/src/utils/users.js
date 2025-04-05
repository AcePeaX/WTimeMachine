const STORAGE_KEY = "chat-users";

// Load all users
export function loadUsers() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Save full list
export function saveUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
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
export function setSessionUser(username, privateKey) {
    const user = {
        username,
        privateKey,
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
