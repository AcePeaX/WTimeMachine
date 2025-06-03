import {
    encryptAESGCM,
    encryptAES,
    decryptAESGCM,
    decryptAES,
    cryptoKeyToUint8Array,
    exportAESKeyToBase64,
    deriveKeyFromMaster,
    decryptAESKey,
    importPrivateKeyFromPEM,
    base64ToUint8Array,
    uint8ArrayToBase64,
    importAESKeyFromBase64,
    encryptAESKey,
    importPublicKeyFromPEM,
} from "./security.js";
import { loadSessionUser } from "./users.js";

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
    const encryptedContent = await encryptAESGCM(content, key);

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
    const decryptedContent = await decryptAESGCM(content.ciphertext, content.iv, key)

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

/**
 * 
 * @param {object} myGrant Current user grant
 * @param {string} otherUserPublicKey Target user public key
 * @returns {Promise<string>}
 */
export const makeNewUserGrant = async(myGrant, otherUserPublicKey) => {
    const sessionUser = loadSessionUser()
    const privateKey = await importPrivateKeyFromPEM(sessionUser.privateKey)
    const encryptedDerivedKey = base64ToUint8Array(myGrant["all"].encryptedDerivedKey)
    const conversationKey = await decryptAESKey(encryptedDerivedKey, privateKey)


    const publicKey = await importPublicKeyFromPEM(otherUserPublicKey)
    const otherEncryptedDerivedKey = await encryptAESKey(conversationKey, publicKey)
    return uint8ArrayToBase64(otherEncryptedDerivedKey)
}

/**
 * @typedef {Object} Hierarchy
 * @property {number} vault
 * @property {number} block
 * @property {number} group
 * @property {number} chunk
 * @property {number} message
 */
export async function decryptMessagesWithGrants(messages, grants, keySize) {
    messages = messages.sort((a, b) => a.sequence - b.sequence)
    let [oldVault, oldBlock, oldGroup, oldChunk] = [-1, -1, -1, -1]
    let [vaultKey, blockKey, groupKey, chunkKey, messageKey] = [null, null, null, null, null]
    if (typeof grants["all"] == 'undefined') {
        throw Error("Using sub grants not yet implemented") // TODO: implement the use of different grants
    }

    const sessionUser = loadSessionUser()
    const privateKey = await importPrivateKeyFromPEM(sessionUser.privateKey)
    const encryptedDerivedKey = base64ToUint8Array(grants["all"].encryptedDerivedKey)
    const conversationKey = await decryptAESKey(encryptedDerivedKey, privateKey)
    const conversationKeyString = uint8ArrayToBase64(conversationKey)

    const senderKey = await deriveKeyFromMaster(
        conversationKeyString,
        "sender",
        keySize
    );

    const decryptedMessages = []

    for (const { sender, type, content, mediaRef, hierarchy, date, sequence } of messages) {
        /** @type {Hierarchy} */
        const { vault, block, group, chunk, message } = hierarchy;
        if (vault !== oldVault) {
            try {
                vaultKey = await exportAESKeyToBase64(
                    await deriveKeyFromMaster(
                        conversationKeyString,
                        `vault-${vault.toString().padStart(6, "0")}`,
                        keySize
                    )
                );
            } catch (e) {
                console.error("Error deriving vault key:", e);
                throw e;
            }
        }
        if (block !== oldBlock) {
            try {
                blockKey = await exportAESKeyToBase64(
                    await deriveKeyFromMaster(
                        vaultKey,
                        `block-${vault.toString().padStart(6, "0")}.${block
                            .toString()
                            .padStart(2, "0")}`,
                        keySize
                    )
                );
            } catch (e) {
                console.error("Error deriving block key:", e);
                throw e;
            }
        }
        if (group !== oldGroup) {
            try {
                groupKey = await exportAESKeyToBase64(
                    await deriveKeyFromMaster(
                        blockKey,
                        `group-${vault.toString().padStart(6, "0")}.${block
                            .toString()
                            .padStart(2, "0")}.${group
                                .toString()
                                .padStart(2, "0")}`,
                        keySize
                    )
                );
            } catch (e) {
                console.error("Error deriving group key:", e);
                throw e;
            }
        }
        if (chunk !== oldChunk) {
            try {
                chunkKey = await exportAESKeyToBase64(
                    await deriveKeyFromMaster(
                        groupKey,
                        `chunk-${vault.toString().padStart(6, "0")}.${block
                            .toString()
                            .padStart(2, "0")}.${group
                                .toString()
                                .padStart(2, "0")}.${chunk
                                    .toString()
                                    .padStart(2, "0")}`,
                        keySize
                    )
                );
            } catch (e) {
                console.error("Error deriving chunk key:", e);
                throw e;
            }
        }
        try {
            messageKey = await deriveKeyFromMaster(
                chunkKey,
                `message-${vault.toString().padStart(6, "0")}.${block
                    .toString()
                    .padStart(2, "0")}.${group
                        .toString()
                        .padStart(2, "0")}.${chunk.toString().padStart(2, "0")}.${message
                            .toString()
                            .padStart(2, "0")}`,
                keySize
            );
        } catch (e) {
            console.error("Error deriving chunk key:", e);
            throw e;
        }

        const decryptedMessage = await decryptMessage({ sender, type, content, mediaRef }, messageKey, senderKey)
        if (decryptedMessage.type === "media") {
            decryptedMessage.content = JSON.parse(decryptedMessage.content)
            const ciphertext = decryptedMessage.mediaRef.encryptedMediaKey.ciphertext
            const iv = decryptedMessage.mediaRef.encryptedMediaKey.iv
            const decryptedMediaRefKey = await decryptAESGCM(ciphertext, iv, messageKey)
            const real_filename = decryptAES(decryptedMessage.content.filename, await cryptoKeyToUint8Array(await importAESKeyFromBase64(decryptedMediaRefKey)))
            decryptedMessage.content.filename = real_filename
            delete decryptedMessage.mediaRef.encryptedMediaKey
            decryptedMessage.mediaRef.mediaKey = decryptedMediaRefKey
        }
        decryptedMessages.push({
            ...decryptedMessage,
            content: decryptedMessage.content ? decryptedMessage.content : decryptedMessage.mediaRef,
            id: sequence,
            date,
            type: decryptedMessage.content.mimeType ? getFileTypeFromMimeType(decryptedMessage.content.mimeType) : "text"
        })
    }
    
    return decryptedMessages.sort((a,b)=>a.id-b.id)
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

export function getFileTypeFromMimeType(mimeType) {
    const typeMapping = {
        // Images
        "image/jpeg": "image",
        "image/png": "image",
        "image/gif": "image",
        "image/webp": "image",
        "image/svg+xml": "image",
        "image/bmp": "image",

        // Audio
        "audio/mpeg": "audio",
        "audio/wav": "audio",
        "audio/ogg": "audio",
        "audio/opus": "audio",
        "audio/mp4": "audio",

        // Video
        "video/mp4": "video",
        "video/webm": "video",
        "video/quicktime": "video",

        // Text & documents
        "text/plain": "file",
        "text/html": "file",
        "application/json": "file",
        "text/csv": "file",
        "application/pdf": "file",
        "text/vcard": "file",

        // Compressed / Archive
        "application/zip": "file",
        "application/vnd.rar": "file",
        "application/x-7z-compressed": "file",
        "application/x-tar": "file",

        // Default fallback
        "application/octet-stream": "file",
    };

    return typeMapping[mimeType] || "file"; // Default to "file" if MIME type is unknown
}
