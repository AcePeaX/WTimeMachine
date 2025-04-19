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

function formDataToObject(formData) {
    const obj = {};
    formData.forEach((value, key) => {
        if (value instanceof Blob) {
            obj[key] = {
                _type: 'Blob',
                name: value.name,
                size: value.size,
                type: value.type,
            };
        } else {
            obj[key] = value;
        }
    });
    return obj;
}


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

    // ----- 1.  Ordinary JSON body -------------------------------------------
    if (!isFormData(config.data)) {
        const raw = { ...config.data, username: user.username, timestamp };
        const globalmessage = JSON.stringify(raw);
        const signature = await signMessage(globalmessage, privateKey);

        config.data = { globalmessage, signature };
        // leave headers alone (axios sets application/json automatically)
        return config;
    }

    // ----- 2.  multipart/form‑data upload ------------------------------------
    const fd = config.data; // original FormData
    const msgObj = {
        username: user.username,
        timestamp,
        ...buildMessageForFormData(fd),
    };
    const globalmessage = JSON.stringify(msgObj);
    const signature = await signMessage(globalmessage, privateKey);

    // A. Put them as *extra* form fields  (recommended)
    fd.append("globalmessage", globalmessage);
    fd.append("signature", signature);

    // B. Or, if you prefer headers instead, comment out A and use:
    // config.headers["X-Username"]   = user.username;
    // config.headers["X-Timestamp"]  = timestamp;
    // config.headers["X-Signature"]  = signature;

    // Never set Content‑Type manually for FormData → axios will insert the
    // correct multipart boundary for you.
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
