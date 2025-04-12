import React, { useEffect, useRef, useState } from "react";
import "./AddConversation.css";
import secureAxios from "../utils/secure-axios";
import { Upload, Info } from "lucide-react";
import {
    generateAESKey,
    exportAESKeyToBase64,
    encryptAESKey,
    importPublicKeyFromPEM,
    base64ToUint8Array,
    uint8ArrayToBase64,
} from "../utils/security";
import { loadSessionUser } from "../utils/users";
import { QuickModal } from "../utils/Modal";

export function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;

    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) =>
        Math.round(
            255 *
                (l -
                    a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))
        );

    return `#${[f(0), f(8), f(4)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")}`;
}

export function generateHSLColorFromText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    let hue = hash % 360;
    if (hue < 0) hue = hue + 360;
    return hslToHex(hue, 70, 80); // pastel-like
}

const AddConversation = () => {
    const [conversationName, setConversationName] = useState("");
    const [description, setDescription] = useState("");
    const [uploadedFile, setUploadedFile] = useState(null);
    const [color, setColor] = useState("#7C3AED");
    const [aesSize, setAESSize] = useState("256");

    const confirmModal = useRef(null);

    const [erros, setErrors] = useState({});

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setUploadedFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        setUploadedFile(file);
    };

    const handleDragOver = (e) => e.preventDefault();

    const handleSubmit = async (e, force=false) => {
        if (!conversationName) return;

        const user = loadSessionUser();
        const publicKey = await importPublicKeyFromPEM(user.publicKey);

        const aesKey = await generateAESKey(parseInt(aesSize));
        const aesKeyString = await exportAESKeyToBase64(aesKey);
        console.log(aesKeyString)

        const encryptedAesKey = await encryptAESKey(
            base64ToUint8Array(aesKeyString),
            publicKey
        );
        const encryptedAesKeyString = uint8ArrayToBase64(encryptedAesKey)

        secureAxios
            .post("/api/add-convo", {
                title: conversationName.trim(),
                description,
                color,
                aesSize: parseInt(aesSize),
                encryptedAesConvoKey: encryptedAesKeyString,
                force: force
            })
            .then((response) => {
                console.log("Conversation created:", response.data);
                // Handle successful conversation creation
            })
            .catch((error) => {
                console.error("Error creating conversation:", error);
                setErrors(error.response.data.errors || {});
                if(error.response.data.state === 2) {
                    confirmModal.current.open()
                }
            });
    };


    useEffect(() => {
        setColor(generateHSLColorFromText(Date.now() + ""));
    }, [setColor]);

    return (
        <div className="add-convo-page">
            <h1>Add a New Conversation</h1>

            <label className="form-label">Conversation Name</label>
            <span className="error-span">{erros["title"]}</span>
            <input
                type="text"
                className="text-input"
                value={conversationName}
                onChange={(e) => {
                    setConversationName(e.target.value);
                }}
                placeholder="E.g., Chat with David"
            />

            <label className="form-label">Description (Optional)</label>
            <span className="error-span">{erros["description"]}</span>
            <input
                type="text"
                className="text-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of the conversation"
            />

            <label className="form-label">Upload a .zip File</label>
            <div
                className="upload-box"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById("fileInput").click()}
            >
                <Upload size={28} />
                <p>
                    {uploadedFile
                        ? uploadedFile.name
                        : "Click or drag a file here"}
                </p>
                <input
                    id="fileInput"
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />
            </div>

            <label className="form-label">Color Label</label>
            <span className="error-span">{erros["color"]}</span>
            <input
                type="color"
                className="color-input"
                value={color}
                onChange={(e) => {
                    setColor(e.target.value);
                }}
            />

            <label className="form-label">AES Encryption Key Size</label>
            <span className="error-span">{erros["aesSize"]}</span>
            <select
                className="text-input"
                value={aesSize}
                onChange={(e) => setAESSize(e.target.value)}
            >
                <option value="256">256-bit (Recommended)</option>
                <option value="192">192-bit</option>
                <option value="128">128-bit</option>
            </select>

            <div className="info-box notice-box">
                <Info size={18} />
                <p>
                    You’ll be able to add or remove users to this conversation
                    later.
                </p>
            </div>

            <button
                className="btn primary"
                onClick={handleSubmit}
                disabled={!conversationName}
            >
                Create Conversation
            </button>

            <div className="info-box info-secondary">
                <Info size={37} />
                <p>
                    <strong>How encryption works:</strong> your conversation is
                    encrypted locally with a private AES key that only you (and
                    users you allow) can access. The server never sees
                    unencrypted content.
                </p>
            </div>

            <div className="info-box info-secondary">
                <Info size={37} />
                <p>
                    <strong>Security logs:</strong> In case of suspicious
                    activity or breach detection, encrypted logs may be used to
                    trace access history. These logs remain fully private unless
                    a confirmed breach occurs.
                </p>
            </div>
            <QuickModal ref={confirmModal} onConfirm={()=>{handleSubmit(null, true)}}>
                <h2>Are you sure?</h2>
                <center>A conversation with this name does already exist in your account</center>
            </QuickModal>
        </div>
    );
};

export default AddConversation;
