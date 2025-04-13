// ProgressBar.js
import React from "react";
import "./ProgressBar.css";

export const ProgressBar = ({ progress = 0, color = "#7C3AED", height = "10px", className }) => {
    return (
        <div className={`progress-container ${className}`} style={{ height }}>
            <div
                className="progress-bar"
                style={{
                    width: `${progress}%`,
                    backgroundColor: color,
                }}
            />
        </div>
    );
};

export default ProgressBar;
