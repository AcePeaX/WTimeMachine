import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Login } from "./pages/Login";
import { useApp } from "./utils/AppProvider";
import "./App.css";

import { loadSessionUser } from "./utils/users";
import { useCallback, useEffect } from "react";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<></>} />
                <Route path="*" element={<></>} />
            </Routes>
            <LoggedInVerifier />
        </Router>
    );
}

const LoggedInVerifier = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const { setPreferredUrl } = useApp();

    const checkConnected = useCallback(() => {
        const user = loadSessionUser();
        if (user && location.pathname === "/login") {
            navigate("/dashboard"); // Redirects without reload
        } else if (!user && location.pathname !== "/login") {
            setPreferredUrl(location.pathname);
            navigate("/login"); // Redirects without reload
        }
    }, [location, navigate, setPreferredUrl]);

    useEffect(() => {
        checkConnected();
    }, [checkConnected]);

    return <></>;
};

export default App;
