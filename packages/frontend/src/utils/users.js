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
