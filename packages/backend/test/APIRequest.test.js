import { generateSignMessage, decryptRequestData } from "@timemachine/security";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const TEST_URL = "http://localhost:" + (process.env.BACKEND_PORT || 5000);

const APIReq = async (props) => {
    const defaults = {
        url: TEST_URL,
        path: "/",
        method: "GET",
        headers: {},
        body: {},
    };
    props = { ...defaults, ...props };
    return await fetch(props.url + props.path, {
        method: props.method,
        headers: {
            "Content-Type": "application/json",
            ...props.headers,
        },
        body: JSON.stringify(props.body),
    })
        .then((response) => response.json())
        .catch((error) => console.error("Error:", error));
};

const username = "test_user_" + Date.now();

// Generate key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: {
        type: "spki",
        format: "pem",
    },
    privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
    },
});

const result = await APIReq({
    path: "/api/register",
    method: "POST",
    body: generateSignMessage(username, { publicKey }, privateKey),
});

if (!result.username) {
    throw Error("Problem while registering: " + JSON.stringify(result));
} else {
    console.log("Register successful: " + username);
}
const prvKey = privateKey;

const result2 = await APIReq({
    path: "/api/user",
    method: "POST",
    body: generateSignMessage(username, { hey: "lo" }, prvKey),
});

console.log(result2);
console.log("\nDecrypting message:");
const result3 = decryptRequestData(
    result2.key,
    result2.encryptedMessage,
    prvKey
);
console.log(result3);
