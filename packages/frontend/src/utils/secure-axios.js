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

        const str_data = JSON.stringify(data)

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
secureAxios.interceptors.response.use(
    async (response) => {
        const user = loadSessionUser();
        if (!user || !user.privateKey) {
            return response; // fallback if no key
        }

        try {
            const privateKey = await importPrivateKeyFromPEM(
                user.privateKey,
                KEY_TYPE_ENCRYPT
            );
            const { key, encryptedMessage } = response.data;
            const decrypted = await decryptRequestData(
                key,
                encryptedMessage,
                privateKey
            );

            return {
                ...response,
                data: decrypted,
            };
        } catch (err) {
            console.error("Decryption error:", err);
            return response; // fallback to raw data if decryption fails
        }
    },
    (error) => Promise.reject(error)
);


export default secureAxios;
