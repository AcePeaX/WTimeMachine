import React from "react";
import "./MessageUI.css";

export const MessageBubble = ({ msg, isSpectator }) => {
    const { type, content, sender, date } = msg;

    // Check if it's a system message
    const isSystemMessage = sender === null;

    // Determine alignment class
    const alignClass = isSystemMessage
        ? "bubble-center"
        : isSpectator
        ? "bubble-right"
        : "bubble-left";

    const renderContent = () => {
        switch (type) {
            case "text":
                return <div className="bubble-text">{content}</div>;

            case "image":
                return (
                    <img
                        src={content.url}
                        alt={content.filename}
                        className="bubble-image"
                        loading="lazy"
                    />
                );

            case "audio":
                return (
                    <audio controls className="bubble-audio">
                        <source src={content} />
                        Your browser does not support the audio element.
                    </audio>
                );

            case "video":
                return (
                    <video controls className="bubble-video">
                        <source src={content} />
                        Your browser does not support the video tag.
                    </video>
                );

            default:
                return (
                    <a href={content} className="bubble-file" download>
                        📎 Download file
                    </a>
                );
        }
    };

    return (
        <div className={`message-bubble ${alignClass}`}>
            {/* Only show sender if it's not a system message */}
            {!isSystemMessage && <div className="bubble-sender">{sender}</div>}
            <div className="bubble-body-container">
                {renderContent()}
                {!isSystemMessage && (
                    <div className="bubble-time">
                        {new Date(date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
