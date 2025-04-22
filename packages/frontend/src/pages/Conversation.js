import React, { useCallback, useEffect, useState } from "react";
import { Settings, Search, LoaderCircle } from "lucide-react";
import { MessageBubble } from "../utils/MessageUI"; // 👈 make sure the path is correct
import "./Conversation.css";
import secureAxios from "../utils/secure-axios";
import { useParams } from "react-router-dom";

const dummyMessages = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    sender: i % 2 === 0 ? "simo" : "ayoub",
    content:
        i % 5 === 0
            ? "https://t4.ftcdn.net/jpg/01/62/69/25/360_F_162692511_SidIKVCDnt5UKHPNqpCb2MSKvfBlx1lG.jpg"
            : `This is message #${i} from ${i % 2 === 0 ? "simo" : "ayoub"} are you okay with it my bro?`,
    type: i % 5 === 0 ? "image" : "text",
    date: new Date(Date.now() + i * 100000),
}));

export const ConversationViewer = () => {
    const { convId } = useParams()
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [spectator, setSpectator] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const lazyLoadMessages = useCallback(()=>{
        secureAxios.get(`/api/message/${convId}`)
        .then(response=>{
            console.log(response.data)
        })
        .catch(error=>{
            console.error(error)
        })
    },[setMessages, messages, convId])

    useEffect(() => {
        lazyLoadMessages()
        setTimeout(() => {
            setMessages(dummyMessages);
            setLoading(false);
        }, 1200);
    }, [convId]);

    return (
        <div className="conversation-container">
            {/* Top Bar */}
            <div className="conversation-topbar">
                <div className="flex items-center gap-2 search-container">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Spectate Sender */}
                <div className="topbar-subcontainer">
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
                    <div className="conv-settings-button">
                        <Settings size={18} />
                    </div>
                </div>
            </div>

            {/* Message Area */}
            <div className="message-area">
                {loading ? (
                    <div className="loading-msg">
                        <LoaderCircle className="spin mr-2" size={20} />
                        Loading messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        No messages
                    </div>
                ) : (
                    [...messages].reverse().map((msg) => (
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
