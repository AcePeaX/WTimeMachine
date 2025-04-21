import axios from "axios";
import {
    decryptRequestData,
    importPrivateKeyFromPEM,
    signMessage,
    KEY_TYPE_ENCRYPT,
    KEY_TYPE_SIGN,
} from "./security";

import { loadSessionUser } from "./users"; // or wherever your session data is

const secureAxios = axios.create();

const buildMessageForFormData = (fd) => {
    const filesInfo = []; // collect non‑sensitive metadata only
    fd.forEach((value, key) => {
        if (value instanceof Blob) {
            filesInfo.push({ field: key, name: value.name, size: value.size });
        }
    });
    return { filesInfo };
};

const isFormData = (obj) =>
    obj && typeof FormData !== "undefined" && obj instanceof FormData;
secureAxios.interceptors.request.use(async (config) => {
    const user = loadSessionUser();
    if (!user?.privateKey || !user?.username) return config;

    const timestamp = Math.floor(Date.now() / 1000);
    const privateKey = await importPrivateKeyFromPEM(
        user.privateKey,
        KEY_TYPE_SIGN
    );

    // ----- 1. JSON body (POST/PUT/DELETE with body) -----
    if (config.data && !isFormData(config.data)) {
        const raw = { ...config.data, username: user.username, timestamp };
        const globalmessage = JSON.stringify(raw);
        const signature = await signMessage(globalmessage, privateKey);

        config.data = { globalmessage, signature };
        return config;
    }

    // ----- 2. multipart/form‑data -----
    if (isFormData(config.data)) {
        const fd = config.data;
        const msgObj = {
            username: user.username,
            timestamp,
            ...buildMessageForFormData(fd),
        };
        const globalmessage = JSON.stringify(msgObj);
        const signature = await signMessage(globalmessage, privateKey);

        fd.append("globalmessage", globalmessage);
        fd.append("signature", signature);
        return config;
    }

    // ----- 3. GET request with query parameters -----
    if (config.method?.toLowerCase() === "get") {
        const baseParams = config.params || {};
        const raw = { ...baseParams, username: user.username, timestamp };
        const globalmessage = JSON.stringify(raw);
        const signature = await signMessage(globalmessage, privateKey);

        config.params = {
            globalmessage,
            signature,
        };
        return config;
    }

    return config;
});

// Add response interceptor
async function tryDecryptResponseData(data, user) {
    if (!user || !user.privateKey || !data?.key || !data?.encryptedMessage)
        return null;

    try {
        const privateKey = await importPrivateKeyFromPEM(
            user.privateKey,
            KEY_TYPE_ENCRYPT
        );
        const decrypted = await decryptRequestData(
            data.key,
            data.encryptedMessage,
            privateKey
        );
        return decrypted;
    } catch (err) {
        console.error("Decryption failed:", err);
        return null;
    }
}

secureAxios.interceptors.response.use(
    async (response) => {
        const user = loadSessionUser();
        const decrypted = await tryDecryptResponseData(response.data, user);

        if (decrypted) {
            return {
                ...response,
                data: decrypted,
            };
        }

        return response;
    },

    async (error) => {
        const user = loadSessionUser();
        const decrypted = await tryDecryptResponseData(
            error.response?.data,
            user
        );

        if (decrypted) {
            error.response.data = decrypted;
        }

        return Promise.reject(error);
    }
);

export default secureAxios;
