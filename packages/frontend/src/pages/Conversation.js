import React, { useCallback, useEffect, useState } from "react";
import { Settings, Search, LoaderCircle } from "lucide-react";
import { MessageBubble } from "../utils/MessageUI"; // 👈 make sure the path is correct
import "./Conversation.css";
import secureAxios from "../utils/secure-axios";
import { useParams } from "react-router-dom";
import { decryptMessagesWithGrants } from "../utils/messages";


function mergeSortedListsAndGetSenders(list1, list2) {
    const mergedList = [];
    const Senders = {}
    let i = 0; // Pointer for list1
    let j = 0; // Pointer for list2

    // Merge the two lists
    while (i < list1.length && j < list2.length) {
        if (list1[i].id < list2[j].id) {
            mergedList.push(list1[i]);
            if (list1[i].sender != null) {
                Senders[list1[i].sender] = true
            }
            i++;
        } else if (list1[i].id > list2[j].id) {
            mergedList.push(list2[j]);
            if (list2[j].sender != null) {
                Senders[list2[j].sender] = true
            }
            j++;
        } else {
            // If ids are equal, take the one from list2
            mergedList.push(list2[j]);
            if (list2[j].sender != null) {
                Senders[list2[j].sender] = true
            }
            i++; // Skip the one from list1
            j++;
        }
    }

    // Add remaining elements from list1 (if any)
    while (i < list1.length) {
        mergedList.push(list1[i]);
        i++;
    }

    // Add remaining elements from list2 (if any)
    while (j < list2.length) {
        mergedList.push(list2[j]);
        j++;
    }

    return [mergedList, Object.keys(Senders)];
}


export const ConversationViewer = () => {
    const { convId } = useParams()
    const [senders, setSenders] = useState([])
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [spectator, setSpectator] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const lazyLoadMessages = useCallback(() => {
        setLoading(true);
        secureAxios.get(`/api/message/${convId}`)
            .then(async response => {
                console.log(response.data)
                const newMessages = await decryptMessagesWithGrants(response.data.messages, response.data.grants, response.data.keySize)
                setLoading(false);
                setMessages((oldMessages) => {
                    const [result, senders] = mergeSortedListsAndGetSenders(oldMessages, newMessages)
                    setSenders(senders)
                    let i = 0
                    let last_sender = null
                    let last_time = null
                    for (i = 0; i < result.length; i++) {
                        const date = new Date(result[i].date);
                        result[i].displaySender = false
                        result[i].marginTop = false
                        result[i].marginBottom = false
                        last_time = date
                        if (last_sender == null || last_sender != result[i].sender) {
                            result[i].marginTop = true
                            if (i > 0) {
                                result[i - 1].marginBottom = false
                            }
                            result[i].displaySender = true
                            last_sender = result[i].sender
                            continue
                        }
                        last_sender = result[i].sender
                        if (last_time == null || date.getTime() - last_time.getTime() > 1000 * 60 * 10) {
                            result[i].displaySender = true
                            result[i].marginTop = true
                            if (i > 0) {
                                result[i - 1].marginBottom = false
                            }
                        }
                        console.log("time diff", date.getTime() - last_time.getTime(), result[i].displaySender)
                    }
                    console.log(result)
                    return result
                })
            })
            .catch(error => {
                console.error(error)
            })
        setSenders(senders)
    }, [setMessages, setSenders, convId])

    useEffect(() => {
        lazyLoadMessages()
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
                            <option value="">- None -</option>
                            {senders.map(sender => (
                                <option value={sender}>{sender}</option>
                            ))}
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
