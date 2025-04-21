// AppProvider.js
import React, { createContext, useCallback, useContext, useState } from "react";

// Create the context
const AppContext = createContext();

// Create the provider
export const AppProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null); // { username, key, etc. }
    const [theme, setTheme] = useState("soft-tech");
    const [modalOpen, setModalOpen] = useState(false);

    const [navReloadTracker, setReloadTracker] = useState(0);

    const reloadNav = useCallback(() => {
        setReloadTracker((prev) => prev + 1);
    }, [setReloadTracker]);

    const [preferredUrl, setPreferredUrl] = useState("/dashboard");

    const value = {
        currentUser,
        setCurrentUser,
        theme,
        setTheme,
        modalOpen,
        setModalOpen,
        preferredUrl,
        setPreferredUrl,
        navReloadTracker,
        reloadNav
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Hook to use the context
export const useApp = () => useContext(AppContext);
