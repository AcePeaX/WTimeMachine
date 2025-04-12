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

// Add request interceptor
secureAxios.interceptors.request.use(async (config) => {
    const user = loadSessionUser();
    if (!user || !user.privateKey || !user.username) {
        return config; // fallback to normal request if not available
    }


    // You can encrypt GET query params or POST body
    const data = config.data || {};
    try {
        const privateKey = await importPrivateKeyFromPEM(
            user.privateKey,
            KEY_TYPE_SIGN
        );

        data.username = user.username;

        let str_data;
        try{
            str_data = JSON.stringify(data)
        }
        catch (e){
            console.error("Failed to stringify data:", e, data);
            return config;
        }
        

        const signature = await signMessage(
            str_data,
            privateKey
        );

        config.data = {
            globalmessage: str_data,
            signature,
        };

        return config;
    } catch (err) {
        console.error("Encryption error:", err);
        return config; // fallback to raw data if encryption fails
    }
});

// Add response interceptor
async function tryDecryptResponseData(data, user) {
    if (!user || !user.privateKey || !data?.key || !data?.encryptedMessage) return null;

    try {
        const privateKey = await importPrivateKeyFromPEM(user.privateKey, KEY_TYPE_ENCRYPT);
        const decrypted = await decryptRequestData(data.key, data.encryptedMessage, privateKey);
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
        const decrypted = await tryDecryptResponseData(error.response?.data, user);

        if (decrypted) {
            error.response.data = decrypted;
        }

        return Promise.reject(error);
    }
);



export default secureAxios;
