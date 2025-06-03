import React, { useCallback, useEffect, useState } from "react";
import "./Sidebar.css";
import { generateColorFromUsername, loadSessionUser } from "../utils/users";
import secureAxios from "../utils/secure-axios";
import {
    Plus,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "./AppProvider";

const Sidebar = () => {
    const { navReloadTracker } = useApp();
    const user = loadSessionUser();
    const navigate = useNavigate();
    const location = useLocation();
    const [currentConv, setCurrentConv] = useState(null)
    const [conversations, setConversations] = useState([]);
    const [collapsed, setCollapsed] = useState(false);

    const toggleSidebar = () => setCollapsed((prev) => !prev);

    const clickConversation = useCallback(
        (convId) => {
            navigate(`/conversations/${convId}`);
        },
        [navigate]
    );

    useEffect(() => {
        secureAxios
            .get("/api/convo")
            .then((response) => {
                // Handle the response data here
                setConversations(response.data.conversations);
            })
            .catch((error) => {
                console.error("Error fetching conversations:", error);
            });
    }, [navReloadTracker]);

    useEffect(()=>{
        // Extract convId from the URL if it matches /conversations/:convId
        const match = location.pathname.match(/\/conversations\/([^/]+)/);
        const convId = match ? match[1] : null;
        setCurrentConv(convId)
    }, [location])

    return (
        <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
            <div className="sidebar-header">
                <div className="user-section">
                    <div className="user-initials" style={{ backgroundColor: user?.color ? user.color : generateColorFromUsername(user?.username) }}>
                        {user?.username?.slice(0, 2).toUpperCase() || "US"}
                    </div>
                    {!collapsed && (
                        <div className="username">{user?.username}</div>
                    )}
                </div>
                <button onClick={toggleSidebar} className="toggle-btn">
                    {collapsed ? (
                        <ChevronRight size={20} />
                    ) : (
                        <ChevronLeft size={20} />
                    )}
                </button>
            </div>

            <div className="sidebar-content">
                <button
                    onClick={() => {
                        navigate("/add-conv");
                    }}
                    className="sidebar-btn"
                >
                    <Plus size={18} />
                    {!collapsed && <span>New Conversation</span>}
                </button>

                <div className="conversation-list">
                    {/* Placeholder list, replace with dynamic data */}
                    {conversations.map((conv, i) => (
                        <div
                            onClick={() => clickConversation(conv._id)}
                            key={i}
                            className={"conversation-item"+(currentConv===conv._id ? " current-conv-item" : "")}
                            style={{
                                justifyContent: collapsed ? "center" : "start",
                                borderRightColor: `${conv.color}`,
                                paddingLeft: collapsed ? "0" : "8px",
                            }}
                        >
                            🗨️ {collapsed ? "" : conv.title}
                        </div>
                    ))}
                </div>
            </div>

            <div className="sidebar-footer">
                <button className="sidebar-btn">
                    <Settings size={18} />
                    {!collapsed && <span>Settings</span>}
                </button>
                <button
                    className="sidebar-btn"
                    onClick={() => {
                        sessionStorage.removeItem("currentUser");
                        navigate("/login");
                    }}
                >
                    <LogOut size={18} />
                    {!collapsed && <span>Disconnect</span>}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
