import React, { useCallback, useEffect, useRef, useState } from "react";
import { Settings, Search, LoaderCircle, Cpu } from "lucide-react";
import { MessageBubble } from "../utils/MessageUI"; // 👈 make sure the path is correct
import "./Conversation.css";
import secureAxios from "../utils/secure-axios";
import { useParams } from "react-router-dom";
import {
    decryptMessagesWithGrants,
    getFileTypeFromMimeType,
} from "../utils/messages";
import {
    decryptAESGCM_rawhalf,
    importAESKeyFromBase64,
} from "../utils/security";
import { getSpectate, loadSessionUser, setSpectate } from "../utils/users";

function mergeSortedListsAndGetSenders(list1, list2) {
    const mergedList = [];
    const Senders = {};
    let i = 0; // Pointer for list1
    let j = 0; // Pointer for list2

    // Merge the two lists
    while (i < list1.length && j < list2.length) {
        if (list1[i].id < list2[j].id) {
            mergedList.push(list1[i]);
            if (list1[i].sender != null) {
                Senders[list1[i].sender] = true;
            }
            i++;
        } else if (list1[i].id > list2[j].id) {
            mergedList.push(list2[j]);
            if (list2[j].sender != null) {
                Senders[list2[j].sender] = true;
            }
            j++;
        } else {
            // If ids are equal, take the one from list2
            mergedList.push(list2[j]);
            if (list2[j].sender != null) {
                Senders[list2[j].sender] = true;
            }
            i++; // Skip the one from list1
            j++;
        }
    }

    // Add remaining elements from list1 (if any)
    while (i < list1.length) {
        mergedList.push(list1[i]);
        if (list1[i].sender != null) {
            Senders[list1[i].sender] = true;
        }
        i++;
    }

    // Add remaining elements from list2 (if any)
    while (j < list2.length) {
        mergedList.push(list2[j]);
        if (list2[j].sender != null) {
            Senders[list2[j].sender] = true;
        }
        j++;
    }

    return [mergedList, Object.keys(Senders)];
}

export const ConversationViewer = () => {
    const [settingsOpen, setSettingsOpen] = useState(false)
    const { convId } = useParams();
    const [senders, setSenders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [spectator, setSpectator] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [, setDummyReload] = useState(0);
    const [reachedEnd, setReachedEnd] = useState(false)

    const [settingsInfo, setSettingsInfo] = useState({ title: "", users: { normal: [], admin: [] } })

    const mediaIdToKey = useRef({});
    const mediaInCall = useRef({});
    const mediaIdToContent = useRef({});

    const lastLoadedMessage = useRef(-1);
    const loadingNewRef = useRef(false);
    const containerRef = useRef(null);
    const loaderTopRef = useRef(-1);

    const getMediaContent = useCallback(
        (mediaId) => {
            if (mediaIdToContent.current[mediaId] != null) {
                return mediaIdToContent.current[mediaId];
            }
            if (mediaInCall.current[mediaId] !== false) {
                return;
            }
            mediaInCall.current[mediaId] = true;
            secureAxios
                .get(`/api/media/${mediaId}`)
                .then(async (response) => {
                    const aesKey = await importAESKeyFromBase64(
                        mediaIdToKey.current[mediaId]
                    );

                    // Determine the file type from the MIME type
                    const fileType = getFileTypeFromMimeType(
                        response.data.mimeType
                    );

                    const decryptedData = await decryptAESGCM_rawhalf(
                        new Uint8Array(response.data.data.ciphertext.data),
                        response.data.data.iv,
                        aesKey
                    );

                    if (fileType === "image") {
                        const blob = new Blob([decryptedData], {
                            type: response.data.mimeType,
                        });
                        const url = URL.createObjectURL(blob);
                        mediaIdToContent.current[mediaId] = url;
                        mediaInCall.current[mediaId] = false;
                        setDummyReload((old) => old + 1);
                    } else if (fileType === "audio") {
                        const blob = new Blob([decryptedData], {
                            type: response.data.mimeType,
                        });
                        const url = URL.createObjectURL(blob);
                        console.log("audio url", url);
                        mediaIdToContent.current[mediaId] = url;
                        mediaInCall.current[mediaId] = false;
                        setDummyReload((old) => old + 1);
                    }
                })
                .catch((error) => {
                    console.error(error);
                });
        },
        [setDummyReload]
    );

    const lazyLoadMessages = useCallback((start_seq = -1, limit = undefined) => {
        secureAxios
            .get(`/api/message/${convId}` + (start_seq !== -1 ? `?startSeq=${start_seq}&limit=${limit}` : ''))
            .then(async (response) => {
                if (response.status === 204) {
                    setReachedEnd(true)
                    return
                }
                setSettingsInfo({ title: response.data.convoTitle, users: response.data.convoUsers })
                const newMessages = await decryptMessagesWithGrants(
                    response.data.messages,
                    response.data.grants,
                    response.data.keySize
                );
                if (response.data.isEnd) {
                    setReachedEnd(true)
                }
                for (let i = 0; i < newMessages.length; i++) {
                    if (newMessages[i].type !== "text") {
                        if (
                            mediaIdToKey.current[
                            newMessages[i].mediaRef.mediaId
                            ] == null
                        ) {
                            mediaIdToKey.current[
                                newMessages[i].mediaRef.mediaId
                            ] = newMessages[i].mediaRef.mediaKey;
                            mediaInCall.current[
                                newMessages[i].mediaRef.mediaId
                            ] = false;
                        }
                    }
                }
                setLoading(false);
                setMessages((oldMessages) => {
                    const [result, new_senders] = mergeSortedListsAndGetSenders(
                        oldMessages,
                        newMessages
                    );
                    setSenders(new_senders);
                    let i = 0;
                    let last_sender = null;
                    let last_time = null;
                    for (i = 0; i < result.length; i++) {
                        const date = new Date(result[i].date);
                        if (lastLoadedMessage.current === -1 || lastLoadedMessage.current > result[i].id) {
                            lastLoadedMessage.current = result[i].id
                        }
                        result[i].displaySender = false;
                        result[i].marginTop = false;
                        result[i].marginBottom = false;
                        last_time = date;
                        if (
                            last_sender == null ||
                            last_sender != result[i].sender
                        ) {
                            result[i].marginTop = true;
                            if (i > 0) {
                                result[i - 1].marginBottom = false;
                            }
                            result[i].displaySender = true;
                            last_sender = result[i].sender;
                            continue;
                        }
                        last_sender = result[i].sender;
                        if (
                            last_time == null ||
                            date.getTime() - last_time.getTime() >
                            1000 * 60 * 10
                        ) {
                            result[i].displaySender = true;
                            result[i].marginTop = true;
                            if (i > 0) {
                                result[i - 1].marginBottom = false;
                            }
                        }
                    }
                    loadingNewRef.current = false
                    return result;
                });
            })
            .catch((error) => {
                console.error(error);
            });
    }, [setMessages, setSenders, convId, setReachedEnd]);

    useEffect(() => {
        setMessages([]);
        setTimeout(() => {
            setLoading(true);
            lazyLoadMessages();
        }, 0);
    }, [convId, setMessages, lazyLoadMessages]);

    useEffect(() => {
        setSettingsOpen(false)
        const { username } = loadSessionUser();
        const oldSpectator = getSpectate(username, convId)
        setSpectator(oldSpectator)
    }, [convId])

    useEffect(() => {
        const container = containerRef.current;

        const handleScroll = () => {
            if (loaderTopRef.current !== null && -container.scrollTop + container.clientHeight > container.scrollHeight - loaderTopRef.current.clientHeight - 20) {
                if (!loading && !loadingNewRef.current) {
                    loadingNewRef.current = true
                    lazyLoadMessages(lastLoadedMessage.current - 1)
                }

                if (loaderTopRef.current !== null && -container.scrollTop + container.clientHeight > container.scrollHeight - 20) {
                    container.scrollTop = container.clientHeight - (container.scrollHeight - 20)
                }

            }
        };

        // Attach scroll event listener
        container.addEventListener("scroll", handleScroll);

        // Cleanup event listener on unmount
        return () => container.removeEventListener("scroll", handleScroll);
    }, [messages, loading]);

    return (<div class="conversation-full-container">
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
                            onChange={(e) => {
                                setSpectator(e.target.value || null)
                                const { username } = loadSessionUser();
                                setSpectate(username, convId, e.target.value || null)
                            }
                            }
                        >
                            <option value="">- None -</option>
                            {senders.map((sender) => (
                                <option key={sender} value={sender}>
                                    {sender}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="conv-settings-button" onClick={() => { setSettingsOpen((old) => !old) }}>
                        <Settings size={18} />
                    </div>
                </div>
            </div>

            {/* Message Area */}
            <div className="message-area" ref={containerRef}>
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
                    [...messages]
                        .reverse()
                        .map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                isSpectator={
                                    spectator ? msg.sender === spectator : false
                                }
                                getMediaContent={getMediaContent}
                            />
                        ))
                )}
                {!reachedEnd ? <div ref={loaderTopRef} className="loading-bubble-up"><LoaderCircle className="spin mr-2" size={20} /></div> : ''}
            </div>
        </div>
        <div className={"conv-settings-page" + (settingsOpen ? " conv-settings-page-open" : "")}>
            <ConvSettings setSettingsOpen={setSettingsOpen} settingsInfo={settingsInfo} />
        </div>
    </div>
    );
};


const ConvSettings = ({ setSettingsOpen, settingsInfo }) => {
    return <>


        <div className="conv-settings-header">
            <div className="conv-settings-button" onClick={() => { setSettingsOpen((old) => !old) }}>
                <Settings size={18} />
            </div>{settingsInfo.title}</div>
        <div className="conv-settings-users">
            {settingsInfo.users.normal.map(user =>
                <div className="conv-settings-users-one">{user} {settingsInfo.users.admin.includes(user) ? "admin" : ""}</div>
            )}
        </div>
    </>
}