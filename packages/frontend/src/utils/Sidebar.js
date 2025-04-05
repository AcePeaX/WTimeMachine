import React, { useState } from "react";
import "./Sidebar.css";
import { loadSessionUser } from "../utils/users";
import {
    Plus,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Sidebar = () => {
    const user = loadSessionUser();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const toggleSidebar = () => setCollapsed((prev) => !prev);

    return (
        <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
            <div className="sidebar-header">
                <div className="user-section">
                    <div className="user-initials">
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
                <button onClick={()=>{navigate("/add-conv")}} className="sidebar-btn">
                    <Plus size={18} />
                    {!collapsed && <span>New Conversation</span>}
                </button>

                <div className="conversation-list">
                    {/* Placeholder list, replace with dynamic data */}
                    {["Chat with AI", "Team Discussion"].map((conv, i) => (
                        <div
                            key={i}
                            className="conversation-item"
                            style={{
                                justifyContent: collapsed ? "center" : "start",
                            }}
                        >
                            🗨️ {collapsed ? "" : conv}
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
