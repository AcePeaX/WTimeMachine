// security.js — Browser-Compatible Version (React/Client-side)

import AES from "aes-js";

// --- AES ---

export function encryptAES(message, key) {
    const textBytes = AES.utils.utf8.toBytes(message);
    const aesCtr = new AES.ModeOfOperation.ctr(key, new AES.Counter(5));
    const encryptedBytes = aesCtr.encrypt(textBytes);
    return AES.utils.hex.fromBytes(encryptedBytes);
}

export function decryptAES(encryptedHex, key) {
    const encryptedBytes = AES.utils.hex.toBytes(encryptedHex);
    const aesCtr = new AES.ModeOfOperation.ctr(key, new AES.Counter(5));
    const decryptedBytes = aesCtr.decrypt(encryptedBytes);
    return AES.utils.utf8.fromBytes(decryptedBytes);
}

// --- RSA KEY ENCRYPTION ---

export async function encryptAESKey(aesKey, publicKey) {
    return await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        aesKey
    );
}

export async function decryptAESKey(encryptedAESKey, privateKey) {
    return await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedAESKey
    );
}

// --- GENERATE RSA KEY PAIR ---

export async function generateRSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 3072, // Stronger key length
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
    return keyPair; // { publicKey, privateKey } as CryptoKey objects
}

export async function exportPublicKeyToPEM(publicKey) {
    const spki = await window.crypto.subtle.exportKey("spki", publicKey);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
    return `-----BEGIN PUBLIC KEY-----\n${b64
        .match(/.{1,64}/g)
        .join("\n")}\n-----END PUBLIC KEY-----`;
}

export async function exportPrivateKeyToPEM(privateKey) {
    const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", privateKey);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
    return `-----BEGIN PRIVATE KEY-----\n${b64
        .match(/.{1,64}/g)
        .join("\n")}\n-----END PRIVATE KEY-----`;
}

export async function importPublicKeyFromPEM(pem, type = "RSA-OAEP") {
    const binaryDer = pemToBinary(pem);
    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer,
        {
            name: type,
            hash: "SHA-256",
        },
        true,
        ["encrypt"] // or ['verify'] if RSASSA
    );
}

function pemToBinary(pem) {
    const b64 = pem
        .replace(/-----BEGIN [^-]+-----/, "") // Remove header
        .replace(/-----END [^-]+-----/, "") // Remove footer
        .replace(/\s/g, ""); // Remove ALL whitespace

    try {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (err) {
        console.error("Invalid base64 in PEM:", err);
        throw err;
    }
}

export async function importPrivateKeyFromPEM(pem, type = "RSA-OAEP") {
    const binaryDer = pemToBinary(pem);
    return await window.crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        {
            name: type,
            hash: "SHA-256",
        },
        true,
        type === "RSA-OAEP" ? ["decrypt"] : ["sign"]
    );
}

export const KEY_TYPE_SIGN = "RSASSA-PKCS1-v1_5";
export const KEY_TYPE_ENCRYPT = "RSA-OAEP";

// --- ENCRYPT FULL PAYLOAD ---

export async function encryptResponseData(body, publicKey) {
    const aesKey = window.crypto.getRandomValues(new Uint8Array(32));
    const encryptedAESKey = await encryptAESKey(aesKey, publicKey);
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
    const encryptedMessage = encryptAES(bodyString, aesKey);

    return {
        encryptedAESKey: btoa(
            String.fromCharCode(...new Uint8Array(encryptedAESKey))
        ),
        encryptedMessage,
    };
}

export async function decryptRequestData(
    encryptedAESKeyBase64,
    encryptedMessage,
    privateKey
) {
    const encryptedAESKey = Uint8Array.from(atob(encryptedAESKeyBase64), (c) =>
        c.charCodeAt(0)
    );
    const aesKey = await decryptAESKey(encryptedAESKey, privateKey);
    const decryptedMessage = decryptAES(
        encryptedMessage,
        new Uint8Array(aesKey)
    );

    try {
        return JSON.parse(decryptedMessage);
    } catch {
        return decryptedMessage;
    }
}

// --- SIGNING ---

export async function signMessage(message, privateKey) {
    const data = new TextEncoder().encode(message);
    const signature = await window.crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" },
        privateKey,
        data
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyMessage(message, signatureBase64, publicKey) {
    const data = new TextEncoder().encode(message);
    const signature = Uint8Array.from(atob(signatureBase64), (c) =>
        c.charCodeAt(0)
    );
    return await window.crypto.subtle.verify(
        { name: "RSASSA-PKCS1-v1_5" },
        publicKey,
        signature,
        data
    );
}

export async function generateSignMessage(username, body, privateKey) {
    const message = JSON.stringify({
        ...body,
        username,
        timestamp: Date.now(),
    });
    const signature = await signMessage(message, privateKey);
    return { globalmessage: message, signature };
}

// --- UTILS ---

export function base64ToUint8Array(base64) {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function uint8ArrayToBase64(arr) {
    return btoa(String.fromCharCode(...new Uint8Array(arr)));
}

// Note: You must import/export/generate keys using window.crypto.subtle API
// Keys should be imported/exported in JWK or SPKI/PKCS8 format depending on use-case
