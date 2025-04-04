import React, { useCallback, useState } from "react";
import "./Login.css"; // Optional for styling
import logo from "../logo.svg"; // replace with your actual logo path

import Modal from "../utils/Modal";
import {
    generateRSAKeyPair,
    exportPublicKeyToPEM,
    exportPrivateKeyToPEM,
    signMessage,
    importPrivateKeyFromPEM,
    KEY_TYPE_SIGN,
} from "../utils/security"; // Adjust the import path as necessary

import axios from "axios";

export const Login = () => {
    const [registerModelOpen, setRegisterModelOpen] = useState(false);
    const [username, setUsername] = useState("");

    const register = useCallback(() => {
        setRegisterModelOpen(true);
    }, []);

    const confirmRegister = async () => {
        console.log("Username:", username);
        const { privateKey, publicKey } = await generateRSAKeyPair();
        const publicKeyPEM = await exportPublicKeyToPEM(publicKey);
        const privateKeyPEM = await exportPrivateKeyToPEM(privateKey);
        console.log("Public Key:", publicKeyPEM);
        console.log("Private Key:", privateKeyPEM);

        const sign_privateKey = await importPrivateKeyFromPEM(
            privateKeyPEM,
            KEY_TYPE_SIGN
        );
        console.log("Sign Private Key:", sign_privateKey);

        const body = {
            username,
            publicKey: publicKeyPEM,
            timestamp: Math.floor(Date.now() / 1000),
        };

        axios
            .post("/api/register", {
                globalmessage: JSON.stringify(body),
                signature: await signMessage(
                    JSON.stringify(body),
                    sign_privateKey
                ),
            })
            .then((response) => {
                console.log("Response:", response.data);
                // Handle successful registration
            });
        // TODO: handle registration logic here
        setRegisterModelOpen(false);
    };

    return (
        <div className="login-page">
            <div className="login-box">
                <div className="logo-area">
                    <img
                        src={logo}
                        alt="ChatTimeMachine Logo"
                        className="logo-icon"
                    />
                    <h1 className="logo-text">ChatTimeMachine</h1>
                </div>

                <div className="form">
                    <label htmlFor="account-select">Select an account</label>
                    <select id="account-select">
                        <option>Select an account</option>
                    </select>

                    <button className="btn connect">Connect</button>

                    <div className="actions">
                        <button className="btn secondary">
                            Import Profile
                        </button>
                        <button onClick={register} className="btn primary">
                            Create New Account
                        </button>
                    </div>
                </div>
            </div>
            <Modal
                isOpen={registerModelOpen}
                onClose={() => setRegisterModelOpen(false)}
            >
                <h2>Create New Account</h2>
                <input
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="modal-input"
                />
                <button onClick={confirmRegister} className="btn confirm">
                    Confirm
                </button>
            </Modal>
        </div>
    );
};
