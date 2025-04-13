import secureAxios from "./secure-axios";
import { unzipSync, strFromU8 } from "fflate";

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
                    content: strFromU8(data),
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
    zip_file
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
    console.log("Conversation ID:", conv_id);

    const file = await unzipFile(zip_file);

    if (
        !file[0].name.startsWith("WhatsApp Chat with ") ||
        !file[0].name.endsWith(".txt")
    ) {
        throw new Error(
            "Invalid file format. Expected a WhatsApp chat export."
        );
    }

    const mainFile = file[0].content;

    console.log(file[0]);

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

    // Loop over lines in mainFile
    const lines = mainFile.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === "") continue;
        const [msgDateRaw, rest] = splitOnce(line, " - ");
        let msgDate = null;
        try {
            msgDate = parseDateTime(msgDateRaw);
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
                const correspondingFiles = file.filter((f) => f.name === a);
                if (correspondingFiles.length > 1) {
                    throw new Error("Multiple files with the same name found");
                } else if (correspondingFiles.length === 1) {
                    msgContent = a;
                    type = "media";
                }
            }
        }
        //console.log(msgContent);
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

    setUploadModalState((old) => {
        return {
            ...old,
            pg1: 1,
            pg1_comment: `Encrypting messages: 0/${messageCount}`,
        };
    });

    const encryptedMessages = {};

    const THRESHOLD_BATCH_UPLOAD_SIZE = 1000;

    let uploading = false;
    let numUploaded = 0;

    let done_encrypting = false;

    const check_adn_upload = () => {
        if (!uploading) {
            let keys = getKeysWithinSizeLimit(
                encryptedMessages,
                THRESHOLD_BATCH_UPLOAD_SIZE
            );
            if (keys.length === 0 && !done_encrypting) return;
            else if(keys.length === 0 ){keys = Object.keys(encryptedMessages);}
            const toUploadDict = {};
            let numMsg = 0;
            for (let key of keys) {
                numMsg++;
                toUploadDict[key] = encryptedMessages[key];
                delete encryptedMessages[key];
            }
            uploading = true;
            return new Promise(async (resolve, reject) => {
                await sleep(1000);
                numUploaded += numMsg;
                setUploadModalState((old) => {
                    return {
                        ...old,
                        pg2: (numUploaded / messageCount) * 100,
                        pg2_comment: `Uploading ${numUploaded}/${messageCount}`,
                    };
                });
                uploading = false;
                resolve(true)
            });
        }
    };

    setUploadModalState((old) => {
        return {
            ...old,
            pg2: 0,
            pg2_comment: `Uploading 0/${messageCount}`,
        };
    });
    // Loop over messages
    for (let i = 0; i < messages.length; i++) {
        await sleep(200);
        encryptedMessages[i] = messages[i];
        check_adn_upload();
        const current_idx = i + 1;
        setUploadModalState((old) => {
            return {
                ...old,
                pg1: (current_idx / messageCount) * 100,
                pg1_comment: `Encrypting messages: ${current_idx}/${messageCount}`,
            };
        });
    }

    done_encrypting = true;

    while(Object.keys(encryptedMessages).length > 0){
        await check_adn_upload();
        await sleep(100);
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
        if (cumulativeSize > maxBytes) return result;
    }

    return result;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
