import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css"; // Optional for styling
import Lottie from "lottie-react";
import logo from "../logo.svg"; // replace with your actual logo path

import { useApp } from "../utils/AppProvider";

import Modal from "../utils/Modal";
import {
    generateRSAKeyPair,
    exportPublicKeyToPEM,
    exportPrivateKeyToPEM,
    signMessage,
    importPrivateKeyFromPEM,
    encryptPrivateKeyWithPassword,
    decryptPrivateKeyWithPassword,
    KEY_TYPE_SIGN,
} from "../utils/security"; // Adjust the import path as necessary

import LockAnimation from "../assets/lottie-lock.json";
import LockAnimationMask from "../assets/lottie-checkmark-mask.json";

import {
    loadUsers,
    addUser,
    setSessionUser,
    loadSessionUser,
    saveUsers
} from "../utils/users";

import axios from "axios";

export const Login = () => {
    const navigate = useNavigate();

    const { preferredUrl, setPreferredUrl } = useApp();

    const [users, setUsers] = useState(loadUsers());
    const [selectedUser, setSelectedUser] = useState(null);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [loginError, setLoginError] = useState("");

    const [registerModelOpen, setRegisterModelOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const [secureModalOpen, setSecureModalOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [secureError, setSecureError] = useState("");

    const [securityConfirm, setSecurityConfirm] = useState(0);

    const selectUser = useRef(null);
    const publicKeyPEMRef = useRef("");
    const privateKeyPEMRef = useRef("");

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
                if (response.status === 201) {
                    setErrorMsg("");
                    setRegisterModelOpen(false);
                    setSecureModalOpen(true);
                    publicKeyPEMRef.current = publicKeyPEM;
                    privateKeyPEMRef.current = privateKeyPEM;
                }
            })
            .catch((error) => {
                if (error.status === 400) {
                    setErrorMsg(error.response.data.error);
                }
            });
    };

    const cleanUpSecureModal = useCallback(() => {
        setSecureModalOpen(false);
        setSecurityConfirm(0);
        setPassword("");
        setConfirmPassword("");
        setSecureError("");
        setUsername("");
        publicKeyPEMRef.current = "";
        privateKeyPEMRef.current = "";
    }, []);

    const handleSecureAccount = async () => {
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

        setUsers(loadUsers());

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
        setUsers(loadUsers());
        cleanUpSecureModal();
    };

    const handleLogin = useCallback(
        (e) => {
            e.preventDefault();
            const selectedAccount = selectUser.current.value;
            const user = users.find(
                (user) => user.username === selectedAccount
            );

            if (user) {
                if (user.requirePass) {
                    setShowPasswordModal(true);
                    setSelectedUser(user);
                    // Handle password prompt
                    // You can implement a password prompt here
                } else {
                    // Proceed with login
                    // For example, redirect to the main application page
                    setSelectedUser(user);
                    publicKeyPEMRef.current = user.publicKey;
                    privateKeyPEMRef.current = user.privateKey;
                }
            }
        },
        [users]
    );

    const checkConnected = useCallback(() => {
        const user = loadSessionUser();
        if (user) {
            const url = preferredUrl;
            setPreferredUrl("/dashboard");
            navigate(url); // Redirects without reload
        }
    }, [navigate, preferredUrl, setPreferredUrl]);

    const verifyLogin = useCallback(async () => {
        let sign_privateKey = {};
        try {
            sign_privateKey = await importPrivateKeyFromPEM(
                privateKeyPEMRef.current,
                KEY_TYPE_SIGN
            );
        } catch (error) {
            setLoginError("It seems like the password is incorrect.");
            return;
        }
        const body = {
            username: selectedUser.username,
        };
        axios
            .post("/api/login", {
                globalmessage: JSON.stringify(body),
                signature: await signMessage(
                    JSON.stringify(body),
                    sign_privateKey
                ),
            })
            .then((response) => {
                setSessionUser(selectedUser.username, privateKeyPEMRef.current, publicKeyPEMRef.current);

                // Reorder users: move selected user to the top
                const allUsers = loadUsers(); // get the full list
                const reordered = [
                    selectedUser,
                    ...allUsers.filter(
                        (u) => u.username !== selectedUser.username
                    ),
                ];
                saveUsers(reordered); // save the reordered list

                setSelectedUser(null);
                setPasswordInput("");
                setShowPasswordModal(false);
                setLoginError("");
                checkConnected();
            })
            .catch((error) => {
                if (error.status === 401) {
                    if (error.response.data.state === 1) {
                        setLoginError("User not found.");
                    } else if (error.response.data.state === 2) {
                        setLoginError(
                            "It seems like the password is incorrect."
                        );
                    } else if (error.response.data.state === 3) {
                        setLoginError("Signature expired.");
                    }
                } else if (error.status === 500) {
                    setLoginError("Server error.");
                } else {
                    setLoginError("Unknown error.");
                }
            });
    }, [selectedUser, checkConnected]);


    const handlePasswordUnlock = useCallback(async () => {
        const result = await decryptPrivateKeyWithPassword(
            selectedUser.encryptedPrivateKey,
            "9a2813jdzA21_" + passwordInput
        );
        publicKeyPEMRef.current = selectedUser.publicKey;
        privateKeyPEMRef.current = result;

        
        verifyLogin();
    }, [selectedUser, passwordInput, verifyLogin]);

    useEffect(() => {
        if (selectedUser && !selectedUser.requirePass) {
            verifyLogin();
        }
    }, [selectedUser, verifyLogin]);

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
                    <select ref={selectUser} id="account-select">
                        <option>Select an account</option>
                        {users.map((user, index) => (
                            <option key={index} value={user.username}>
                                {user.username} {user.requirePass ? "🛡️" : ""}
                            </option>
                        ))}
                    </select>

                    <button onClick={handleLogin} className="btn connect">
                        Connect
                    </button>

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
                        <div className="secure-account-container">
                            <div
                                style={{
                                    position: "relative",
                                    width: "70%",
                                    margin: "0 auto",
                                    height: "210px",
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
                                        style={{
                                            width: "100%",
                                            height: "auto",
                                        }}
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
                                        style={{
                                            width: "100%",
                                            height: "auto",
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="label_account_secured">
                                Account Secured
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
            <Modal
                isOpen={
                    !!selectedUser &&
                    selectedUser.requirePass &&
                    showPasswordModal
                }
                onClose={() => {
                    setShowPasswordModal(false);
                    setPasswordInput("");
                    setLoginError("");
                }}
            >
                <div className="password-modal">
                    <h2>
                        Unlock Account: <i>{selectedUser?.username}</i>{" "}
                        {selectedUser?.requirePass && "🛡️"}
                    </h2>

                    {loginError && (
                        <p className="error-message">{loginError}</p>
                    )}

                    <input
                        type="password"
                        placeholder="Enter password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="modal-input"
                    />

                    <button
                        className="btn primary confirm unlock-account"
                        disabled={!passwordInput || passwordInput.length < 4}
                        onClick={handlePasswordUnlock}
                    >
                        Unlock
                    </button>
                </div>
            </Modal>
        </div>
    );
};
