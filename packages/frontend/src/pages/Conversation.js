import React, { useEffect, useState } from "react";
import { Settings, Search, LoaderCircle } from "lucide-react";
import { MessageBubble } from "../utils/MessageUI"; // 👈 make sure the path is correct
import "./Conversation.css";

const dummyMessages = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    sender: i % 2 === 0 ? "simo" : "ayoub",
    content:
        i % 5 === 0
            ? "https://t4.ftcdn.net/jpg/01/62/69/25/360_F_162692511_SidIKVCDnt5UKHPNqpCb2MSKvfBlx1lG.jpg"
            : `This is message #${i} from ${i % 2 === 0 ? "simo" : "ayoub"}`,
    type: i % 5 === 0 ? "image" : "text",
    date: new Date(Date.now() - i * 100000),
}));

export const ConversationViewer = () => {
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [spectator, setSpectator] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setTimeout(() => {
            setMessages(dummyMessages);
            setLoading(false);
        }, 1200);
    }, []);

    const filtered = messages;

    return (
        <div className="conversation-container">
            {/* Top Bar */}
            <div className="conversation-topbar">
                <div className="flex items-center gap-2">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="p-2 hover:bg-gray-100 rounded">
                    <Settings size={18} />
                </button>
            </div>

            {/* Spectate Sender */}
            <div className="spectate-bar">
                👁️ Spectate:
                <select
                    value={spectator || ""}
                    onChange={(e) => setSpectator(e.target.value || null)}
                >
                    <option value="">– None –</option>
                    <option value="simo">simo</option>
                    <option value="ayoub">ayoub</option>
                </select>
            </div>

            {/* Message Area */}
            <div className="message-area">
                {loading ? (
                    <div className="loading-msg">
                        <LoaderCircle className="spin mr-2" size={20} />
                        Loading messages...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        No messages
                    </div>
                ) : (
                    filtered.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            msg={msg}
                            isSpectator={
                                spectator
                                    ? msg.sender === spectator
                                    : false
                            } // fallback logic
                        />
                    ))
                )}
            </div>
        </div>
    );
};
