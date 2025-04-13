import {
    encryptAESGCM,
    encryptAES,
    decryptAESGCM,
    decryptAES,
    cryptoKeyToUint8Array,
} from "./security.js";

export const BLOCK_per_VAULT = 8;
export const GROUP_per_BLOCK = 8;
export const CHUNK_per_GROUP = 8;
export const MESSAGE_per_CHUNK = 8;

export const TOTAL_per_VAULT =
    BLOCK_per_VAULT * GROUP_per_BLOCK * CHUNK_per_GROUP * MESSAGE_per_CHUNK;
export const TOTAL_per_BLOCK =
    GROUP_per_BLOCK * CHUNK_per_GROUP * MESSAGE_per_CHUNK;
export const TOTAL_per_GROUP = CHUNK_per_GROUP * MESSAGE_per_CHUNK;
export const TOTAL_per_CHUNK = MESSAGE_per_CHUNK;

/**
 * Converts a flat message index to a hierarchy of {vault, block, group, chunk, message}
 */
export function indexToHierarchy(index) {
    const vault = Math.floor(index / TOTAL_per_VAULT);
    const indexInVault = index % TOTAL_per_VAULT;

    const block = Math.floor(indexInVault / TOTAL_per_BLOCK);
    const indexInBlock = indexInVault % TOTAL_per_BLOCK;

    const group = Math.floor(indexInBlock / TOTAL_per_GROUP);
    const indexInGroup = indexInBlock % TOTAL_per_GROUP;

    const chunk = Math.floor(indexInGroup / TOTAL_per_CHUNK);
    const message = indexInGroup % TOTAL_per_CHUNK;

    return { vault, block, group, chunk, message };
}

/**
 * Converts a hierarchy {vault, block, group, chunk, message} back to a flat index
 */
export function hierarchyToIndex({ vault, block, group, chunk, message }) {
    return (
        vault * TOTAL_per_VAULT +
        block * TOTAL_per_BLOCK +
        group * TOTAL_per_GROUP +
        chunk * TOTAL_per_CHUNK +
        message
    );
}

export async function encryptMessage(
    { sender, type, content, mediaRef },
    key,
    senderKey
) {
    const encryptedContent =
        type === "text" ? await encryptAESGCM(content, key) : {};

    const senderEncrypted = sender
        ? encryptAES(sender, await cryptoKeyToUint8Array(senderKey))
        : null;
    return {
        sender: senderEncrypted,
        type,
        content: encryptedContent,
        mediaRef,
    };
}

export async function decryptMessage(
    { sender, type, content, mediaRef },
    key,
    senderKey
) {
    const decryptedContent =
        type === "text"
            ? await decryptAESGCM(content.ciphertext, content.iv, key)
            : null;

    const decryptedSender = sender
        ? decryptAES(sender, await cryptoKeyToUint8Array(senderKey))
        : null;

    return {
        sender: decryptedSender,
        type,
        content: decryptedContent,
        mediaRef,
    };
}

export async function encryptFile(
    { mimeType, content, filename, size },
    key
) {
    const encryptedContent = await encryptAESGCM(content, key);

    const filenameEncrypted = encryptAES(filename, await cryptoKeyToUint8Array(key))
    return {
        filename: filenameEncrypted,
        content: encryptedContent,
        mimeType,
        size
    };
}

export async function decryptFile(
    { filename, content, mimeType, size },
    key
) {
    const decryptedContent = await decryptAESGCM(content.ciphertext, content.iv, key);
    const decryptedFilename = decryptAES(filename, await cryptoKeyToUint8Array(key));

    return {
        filename: decryptedFilename,
        content: decryptedContent,
        mimeType,
        size
    };
}


export function getMimeTypeFromFilename(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
        // Text & documents
        txt: "text/plain",
        html: "text/html",
        json: "application/json",
        csv: "text/csv",
        pdf: "application/pdf",
        vcf: "text/vcard",

        // Images
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        bmp: "image/bmp",

        // Audio
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        opus: "audio/opus",
        m4a: "audio/mp4",

        // Video
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",

        // Compressed / Archive
        zip: "application/zip",
        rar: "application/vnd.rar",
        "7z": "application/x-7z-compressed",
        tar: "application/x-tar",

        // Default fallback
        default: "application/octet-stream",
    };

    return mimeTypes[extension] || mimeTypes.default;
}
