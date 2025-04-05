import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Login } from "./pages/Login";
import { useApp } from "./utils/AppProvider";
import { loadSessionUser } from "./utils/users";
import { useCallback, useEffect } from "react";
//import Dashboard from "./pages/Dashboard";
import Sidebar from "./utils/Sidebar";
import AddConversation from "./pages/AddConversation";
import "./App.css";

//<Route path="/dashboard" element={<Dashboard />} />
function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/*"
                    element={
                        <div className="app-layout">
                            <Sidebar />
                            <div className="main-content">
                                <Routes>
                                    <Route path="/add-conv" element={<AddConversation />} />
                                    <Route path="*" element={<div>Page Not Found</div>} />
                                </Routes>
                            </div>
                        </div>
                    }
                />
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
        if (user && (location.pathname === "/login" || location.pathname === "/login/")) {
          console.log("User is logged in, redirecting to dashboard");
            navigate("/dashboard");
        } else if (!user && location.pathname !== "/login") {
            setPreferredUrl(location.pathname);
            navigate("/login");
        }
    }, [location, navigate, setPreferredUrl]);

    useEffect(() => {
        checkConnected();
    }, [checkConnected]);

    return null;
};

export default App;
