import React, { useCallback, useRef, useState } from "react";
import "./Login.css"; // Optional for styling
import Lottie from "lottie-react";
import logo from "../logo.svg"; // replace with your actual logo path

import Modal from "../utils/Modal";
import {
    generateRSAKeyPair,
    exportPublicKeyToPEM,
    exportPrivateKeyToPEM,
    signMessage,
    importPrivateKeyFromPEM,
    encryptPrivateKeyWithPassword,
    KEY_TYPE_SIGN,
} from "../utils/security"; // Adjust the import path as necessary

import LockAnimation from "../assets/lottie-lock.json";
import LockAnimationMask from "../assets/lottie-checkmark-mask.json";

import { loadUsers, addUser } from "../utils/users";

import axios from "axios";


export const Login = () => {
    const [registerModelOpen, setRegisterModelOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const [secureModalOpen, setSecureModalOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [secureError, setSecureError] = useState("");

    const [securityConfirm, setSecurityConfirm] = useState(0);

    const publicKeyPEMRef = useRef("")
    const privateKeyPEMRef = useRef("")

    const register = useCallback(() => {
        setRegisterModelOpen(true);
    }, []);

    const confirmRegister = async () => {
        const { privateKey, publicKey } = await generateRSAKeyPair();
        const publicKeyPEM = await exportPublicKeyToPEM(publicKey);
        const privateKeyPEM = await exportPrivateKeyToPEM(privateKey);

        const sign_privateKey = await importPrivateKeyFromPEM(
            privateKeyPEM,
            KEY_TYPE_SIGN
        );


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
                console.log("Response:", response.status);
                if (response.status === 201) {
                    setErrorMsg("");
                    setUsername("");
                    setRegisterModelOpen(false);
                    setSecureModalOpen(true);
                    publicKeyPEMRef.current = publicKeyPEM;
                    privateKeyPEMRef.current = privateKeyPEM;
                }
            })
            .catch((error) => {
                console.log("Error:", error.status, error.response.data);
                if (error.status === 400) {
                    if (error.response.data.state === 2) {
                        setErrorMsg("User already exists.");
                    }
                }
            });
    };

    const cleanUpSecureModal = useCallback(() => {
        setSecureModalOpen(false);
        setSecurityConfirm(0);
        setPassword("");
        setConfirmPassword("");
        setSecureError("");
    }, []);

    const handleSecureAccount = async() => {
        if (securityConfirm === 1) {
            setSecurityConfirm(0);
            return;
        }
        if (password !== confirmPassword) {
            setSecureError("Passwords do not match.");
            return;
        }

        const augmented_pass = "9a2813jdzA21_" + password;
        const encryptedPrivateKey = await encryptPrivateKeyWithPassword(
            privateKeyPEMRef.current,
            augmented_pass
        );

        addUser({
            username,
            publicKey: publicKeyPEMRef.current,
            encryptedPrivateKey,
            requirePass: true,
        });

        // Proceed to hash, encrypt, or store the password securely
        setSecurityConfirm(2);
    };

    const handleUnsafeAccount = () => {
        if (securityConfirm === 0) {
            setSecurityConfirm(1);
            return;
        }
        addUser({
            username,
            publicKey: publicKeyPEMRef.current,
            privateKey: privateKeyPEMRef.current,
            requirePass: false,
        });
        cleanUpSecureModal();
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
                {errorMsg && <p className="error-message">{errorMsg}</p>}
                <input
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="modal-input"
                />
                <button
                    onClick={confirmRegister}
                    className="btn confirm"
                    disabled={!username || username.length < 3}
                >
                    Confirm
                </button>
            </Modal>
            <Modal
                isOpen={secureModalOpen}
                onClose={
                    securityConfirm === 2
                        ? () => {
                                cleanUpSecureModal();
                            }
                        : undefined
                }
            >
                <div
                    style={{
                        minHeight: "390px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                    }}
                >
                    {securityConfirm === 2 ? (
                        <div
                            style={{
                                position: "relative",
                                width: "70%",
                                margin: "0 auto",
                            }}
                        >
                            <div
                                className="lock-animation lock-animation-1"
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                }}
                            >
                                <Lottie
                                    animationData={LockAnimation}
                                    loop={false}
                                    style={{ width: "100%", height: "auto" }}
                                />
                            </div>

                            <div
                                className="lock-animation lock-animation-2"
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                }}
                            >
                                <Lottie
                                    animationData={LockAnimationMask}
                                    loop={false}
                                    style={{ width: "100%", height: "auto" }}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2>
                                Secure Your Account: <i>{username}</i>
                            </h2>

                            <p className="modal-info">
                                Your account has been created and is stored on
                                your device. However, we strongly recommend
                                adding a password to protect it in case someone
                                gains access to your computer.
                            </p>

                            {secureError && (
                                <p className="error-message">{secureError}</p>
                            )}

                            <input
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="modal-input"
                            />

                            <input
                                type="password"
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                className="modal-input"
                            />

                            <div className="modal-actions">
                                <button
                                    className="btn secondary keep-unsafe"
                                    style={{
                                        width:
                                            securityConfirm === 0
                                                ? "100%"
                                                : "200%",
                                    }}
                                    onClick={handleUnsafeAccount}
                                >
                                    {securityConfirm === 0
                                        ? "Keep my account unsafe"
                                        : "I am sure want to keep my account unsafe"}
                                </button>

                                <button
                                    className="btn primary safe-button"
                                    style={{
                                        width:
                                            securityConfirm === 0
                                                ? "100%"
                                                : "40%",
                                    }}
                                    disabled={
                                        securityConfirm === 0 &&
                                        (!password ||
                                            password.length < 4 ||
                                            password !== confirmPassword)
                                    }
                                    onClick={handleSecureAccount}
                                >
                                    {securityConfirm === 0
                                        ? "Secure My Account"
                                        : "No"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};
