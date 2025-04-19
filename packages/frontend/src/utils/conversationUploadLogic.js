import secureAxios from "./secure-axios";
import {
    deriveKeyFromMaster,
    exportAESKeyToBase64,
    generateAESKey,
} from "./security";
import * as MSG from "./messages.js";
import { unzipSync, strFromU8 } from "fflate";
import {
    encryptMessage,
    getMimeTypeFromFilename,
    encryptFile,
} from "./messages.js";

function splitOnce(str, delimiter) {
    const index = str.indexOf(delimiter);
    if (index === -1) return [str]; // Delimiter not found

    return [str.slice(0, index), str.slice(index + delimiter.length)];
}

function splitOnceIgnoringQuotes(str, delimiter) {
    let inQuotes = false;

    for (let i = 0; i <= str.length - delimiter.length; i++) {
        const char = str[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        }

        // Check for full delimiter match only outside quotes
        if (!inQuotes && str.slice(i, i + delimiter.length) === delimiter) {
            return [str.slice(0, i), str.slice(i + delimiter.length)];
        }
    }

    return [str]; // Delimiter not found
}

function parseDateTime(input) {
    const [datePart, timePart] = input.split(", ");
    const [month, day, year] = datePart.split("/").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    return new Date(2000 + year, month - 1, day, hour, minute);
}

export async function unzipFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const uint8Array = new Uint8Array(e.target.result);
                const files = unzipSync(uint8Array); // returns { filename: Uint8Array }

                // Convert all files to text (or handle them however you want)
                const extracted = Object.entries(files).map(([name, data]) => ({
                    name,
                    content: data,
                    size: data.length, // size in bytes
                    mimeType: getMimeTypeFromFilename(name),
                }));

                resolve(extracted);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

export const conversationUploadLogic = async (
    setUploadModalState,
    conv_id,
    zip_file,
    conversationKeyString,
    keySize
) => {
    setUploadModalState((old) => {
        return {
            ...old,
            open: true,
            pg1: 0,
            pg1_comment: "Unzipping...",
            pg2: 0,
            pg2_comment: "Waiting...",
        };
    });

    const file = await unzipFile(zip_file);

    if (
        !file[0].name.startsWith("WhatsApp Chat with ") ||
        !file[0].name.endsWith(".txt")
    ) {
        throw new Error(
            "Invalid file format. Expected a WhatsApp chat export."
        );
    }

    const mainFile = strFromU8(file[0].content);

    setUploadModalState((old) => {
        return {
            ...old,
            open: true,
            pg1: 0,
            pg1_comment: "Counting messages: 0",
            pg2: 0,
            pg2_comment: "Waiting...",
        };
    });

    let messageCount = 0;

    /**
    @type {{
        date: Date,
        sender: string | null,
        content: string,
        type: string,
    }[]} messages
    */
    const messages = [];

    let timeTracker = Date.now();

    const files_needed = {};

    // Loop over lines in mainFile
    const lines = mainFile.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === "") continue;
        let [msgDateRaw, rest] = splitOnce(line, " - ");
        let msgDate = null;
        try {
            msgDate = parseDateTime(msgDateRaw);
            if (isNaN(msgDate.getTime())) {
                messages[messages.length - 1].content += "\n" + line;
                continue;
            }
        } catch (e) {
            continue;
        }
        let [msgSender, msgContent] = splitOnceIgnoringQuotes(rest, ": ");
        if (msgContent === undefined) {
            msgContent = msgSender;
            msgSender = null;
        }

        let type = "text";
        if (msgSender !== null) {
            let [a, b] = splitOnce(msgContent, " (file attached)");
            if (b === "") {
                const correspondingFileIndex = file.findIndex(
                    (f) => f.name === a
                );
                if (correspondingFileIndex !== -1) {
                    msgContent = a;
                    files_needed[msgContent] = correspondingFileIndex;
                    type = "media";
                }
            }
        }
        messages.push({
            date: msgDate,
            sender: msgSender,
            content: msgContent,
            type: type,
        });
        messageCount++;
        if (Date.now() - timeTracker > 300) {
            timeTracker = Date.now();
            const messageCountSafe = messageCount;
            setUploadModalState((old) => {
                return {
                    ...old,
                    pg1: 0,
                    pg1_comment: `Counting messages: ${messageCountSafe}`,
                };
            });
        }
    }
    setUploadModalState((old) => {
        return {
            ...old,
            pg1: 0,
            pg1_comment: `Counting messages: ${messageCount}`,
        };
    });

    let total_file_size = 0;
    for (const [, value] of Object.entries(files_needed)) {
        const size = file[value].size;
        total_file_size += size;
    }

    const message_size = Math.max(file[0].size, messageCount * 10000);

    const pg1_percentage_phase1 =
        Math.min(
            Math.max(total_file_size / (message_size + total_file_size), 0.3),
            0.7
        ) * 99;
    const pg2_percentage_phase1 =
        Math.min(
            Math.max(total_file_size / (message_size + total_file_size), 0.1),
            0.9
        ) * 100;

    const num_files = Object.keys(files_needed).length;

    setUploadModalState((old) => {
        return {
            ...old,
            pg1: 1,
            pg1_comment: `Encrypting files: 0/${num_files}`,
        };
    });

    const encryptedMessages = {};
    const encryptedFiles = {};

    const fileOriginalName_to_encryptedName = {};
    const encryptedFileName_to_id = {};

    const THRESHOLD_BATCH_MSG_UPLOAD_SIZE = 1024 * 5;
    const THRESHOLD_BATCH_IMG_UPLOAD_SIZE = 1024 * 1024 * 2;

    let uploading = false;
    let numUploadedFiles = 0;
    let numUploadedMsg = 0;

    let done_encrypting_files = false;
    let done_encrypting_msg = false;

    let done_uploading_files = false;

    const check_and_upload = () => {
        if (!uploading) {
            if (!done_uploading_files) {
                let [keys] = getKeysWithinSizeLimit(
                    encryptedFiles,
                    THRESHOLD_BATCH_IMG_UPLOAD_SIZE
                );
                if (keys.length === 0 && !done_encrypting_files) return;
                else if (keys.length === 0) {
                    keys = Object.keys(encryptedFiles);
                    done_uploading_files = true;
                }
                const toUploadDict = {};
                let numFiles = 0;
                for (let key of keys) {
                    numFiles++;
                    toUploadDict[key] = encryptedFiles[key];
                    delete encryptedFiles[key];
                }
                uploading = true;
                return new Promise(async (resolve, reject) => {
                    let result = null;
                    try {
                        // Create a FormData object to handle the files and other data
                        const formData = new FormData();

                        // Loop through your files (toUploadDict) and append them to the FormData
                        Object.values(toUploadDict).forEach(
                            (fileData, index) => {
                                // Convert Uint8Array to Blob
                                const contentBlob = new Blob(
                                    [fileData.content.ciphertext],
                                    { type: fileData.mimeType }
                                );

                                // Append the file (ciphertext as Blob) with a unique field name (e.g., 'file_0', 'file_1', etc.)
                                formData.append(
                                    `file_${index}`,
                                    contentBlob,
                                    fileData.filename
                                );

                                // Append metadata (iv, mimeType, size) with unique field names too
                                formData.append(
                                    `file_${index}_iv`,
                                    fileData.content.iv
                                );
                                formData.append(
                                    `file_${index}_mimeType`,
                                    fileData.mimeType
                                );
                                formData.append(
                                    `file_${index}_size`,
                                    fileData.size
                                );
                            }
                        );
                        if (Object.values(toUploadDict).length === 0) {
                            resolve(true);
                            return;
                        }
                        result = await secureAxios.post(
                            `/api/media/${conv_id}`,
                            formData,
                            {
                                headers: {
                                    "Content-Type": "multipart/form-data", // Ensure the correct content type for file uploads
                                },
                            }
                        );
                        for (const file in result.data.media) {
                            encryptedFileName_to_id[file] =
                                result.data.media[file].id;
                        }
                    } catch (e) {
                        console.error("Error uploading files:", e);
                        throw e;
                    }
                    numUploadedFiles += numFiles;
                    setUploadModalState((old) => {
                        return {
                            ...old,
                            pg2:
                                (numUploadedFiles / num_files) *
                                pg2_percentage_phase1,
                            pg2_comment: `Uploading files ${numUploadedFiles}/${num_files}`,
                        };
                    });
                    uploading = false;
                    resolve(true);
                });
            }
            let [keys, size] = getKeysWithinSizeLimit(
                encryptedMessages,
                THRESHOLD_BATCH_MSG_UPLOAD_SIZE
            );
            if (keys.length === 0 && !done_encrypting_msg) return;
            else if (keys.length === 0) {
                keys = Object.keys(encryptedMessages);
            }
            const toUploadDict = {};
            let numMsg = 0;
            for (let key of keys) {
                numMsg++;
                toUploadDict[key] = encryptedMessages[key];
                delete encryptedMessages[key];
            }
            uploading = true;
            return new Promise(async (resolve, reject) => {
                await sleep(200 + size / 300);
                numUploadedMsg += numMsg;
                setUploadModalState((old) => {
                    return {
                        ...old,
                        pg2:
                            pg2_percentage_phase1 +
                            (numUploadedMsg / messageCount) *
                                (100 - pg2_percentage_phase1),
                        pg2_comment: `Uploading messages ${numUploadedMsg}/${messageCount}`,
                    };
                });
                uploading = false;
                resolve(true);
            });
        }
    };

    const senderKey = await deriveKeyFromMaster(
        conversationKeyString,
        "sender",
        keySize
    );

    setUploadModalState((old) => {
        return {
            ...old,
            pg2: 0,
            pg2_comment: `Uploading files 0/${num_files}`,
        };
    });

    let pg1timeTracker = Date.now() - 2000;

    const filename_to_key = {};

    // Loop over files
    let current_idx = 0;
    for (const [filename, index] of Object.entries(files_needed)) {
        const fileData = file[index];
        const fileContent = fileData.content;
        const mimeType = fileData.mimeType;

        const uniqueKey = await generateAESKey(keySize);

        const encryptedFile = await encryptFile(
            {
                filename,
                content: fileContent,
                mimeType,
                size: fileData.size,
            },
            uniqueKey
        );
        encryptedFiles[current_idx] = encryptedFile;
        filename_to_key[filename] = await exportAESKeyToBase64(uniqueKey);
        fileOriginalName_to_encryptedName[filename] = encryptedFile.filename;
        file[index].content = null;
        check_and_upload();
        const current_idx_safe = current_idx + 1;
        const pg1 = (current_idx_safe / num_files) * pg1_percentage_phase1 + 1;
        if (Date.now() - pg1timeTracker > 50) {
            pg1timeTracker = Date.now();
            setUploadModalState((old) => {
                return {
                    ...old,
                    pg1: pg1,
                    pg1_comment: `Encrypting files: ${current_idx_safe}/${num_files}`,
                };
            });
        } else {
            setUploadModalState((old) => {
                return {
                    ...old,
                    pg1_comment: `Encrypting files: ${current_idx_safe}/${num_files}`,
                };
            });
        }
        current_idx++;
    }
    setUploadModalState((old) => {
        return {
            ...old,
            pg1: pg1_percentage_phase1 + 1,
            pg1_comment: `Encrypting files: ${num_files}/${num_files}`,
        };
    });
    done_encrypting_files = true;
    pg1timeTracker = Date.now();

    let [oldVault, oldBlock, oldGroup, oldChunk] = [-1, -1, -1, -1];
    let [vaultKey, blockKey, groupKey, chunkKey, messageKey] = [
        null,
        null,
        null,
        null,
        null,
    ];
    // Loop over messages
    for (let i = 0; i < messages.length; i++) {
        const { vault, block, group, chunk } = MSG.indexToHierarchy(i);

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
                    .padStart(2, "0")}.${chunk.toString().padStart(2, "0")}.${i
                    .toString()
                    .padStart(2, "0")}`,
                keySize
            );
        } catch (e) {
            console.error("Error deriving chunk key:", e);
            throw e;
        }

        if (messages[i].type === "media") {
            const fileIndex = files_needed[messages[i].content];
            if (fileIndex === undefined) {
                console.error("File index not found for media message.");
                continue;
            }
            const fileKey = filename_to_key[messages[i].content];
            messages[i].content = {
                ciphertext: messages[i].content,
                iv: fileKey,
                filename:
                    fileOriginalName_to_encryptedName[messages[i].content],
                mimeType: file[fileIndex].mimeType,
                size: file[fileIndex].size,
            };
            const encFileName = messages[i].content.filename;
            while (encryptedFileName_to_id[encFileName] === undefined) {
                await sleep(20);
                check_and_upload();
            }
            messages[i].mediaRef = {
                mediaId: encryptedFileName_to_id[messages[i].content.filename],
                encryptedMediaKey: fileKey,
            };
        }

        const encryptedMessage = await encryptMessage(
            messages[i],
            messageKey,
            senderKey
        );
        encryptedMessages[i] = { index: i, ...encryptedMessage };
        messages[i] = null;
        check_and_upload();
        const current_idx = i + 1;
        const pg1 =
            (current_idx / messageCount) * (99 - pg1_percentage_phase1) +
            pg1_percentage_phase1 +
            1;
        const current_idx_safe = current_idx;
        if (Date.now() - pg1timeTracker > 50) {
            pg1timeTracker = Date.now();
            setUploadModalState((old) => {
                return {
                    ...old,
                    pg1: pg1,
                    pg1_comment: `Encrypting messages: ${current_idx_safe}/${messageCount}`,
                };
            });
        } else {
            setUploadModalState((old) => {
                return {
                    ...old,
                    pg1_comment: `Encrypting messages: ${current_idx_safe}/${messageCount}`,
                };
            });
        }
        oldVault = vault;
        oldBlock = block;
        oldGroup = group;
        oldChunk = chunk;
    }
    setUploadModalState((old) => {
        return {
            ...old,
            pg1: 100,
            pg1_comment: `Encrypting messages: ${messageCount}/${messageCount}`,
        };
    });

    done_encrypting_msg = true;

    while (Object.keys(encryptedMessages).length > 0) {
        await check_and_upload();
        await sleep(10);
    }
};

/**
 * Returns the list of keys (in order) whose cumulative size does not exceed the given byte threshold.
 *
 * @param {Object} dict - A dictionary with numeric keys and any values.
 * @param {number} maxBytes - The maximum cumulative size allowed in bytes.
 * @returns {number[]} An array of keys whose total serialized size is within the limit.
 */
function getKeysWithinSizeLimit(dict, maxBytes) {
    const keys = Object.keys(dict)
        .map(Number)
        .sort((a, b) => a - b);

    let cumulativeSize = 0;
    const result = [];

    for (const key of keys) {
        const itemSize = new Blob([JSON.stringify(dict[key])]).size;
        cumulativeSize += itemSize;
        result.push(key);
        if (cumulativeSize > maxBytes) return [result, cumulativeSize];
    }

    return [result, cumulativeSize];
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
