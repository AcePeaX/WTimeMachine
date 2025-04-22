import fs from "fs/promises";
import path from "path";

import { Media } from "../models/Media.js";
import { Grant } from "../models/Grant.js";
import { Message } from "../models/Message.js";
import { Convo } from "../models/Convo.js";

import { logger, MSGUtils, validateRequest } from "@timemachine/utils";

// POST /api/media/:conv_id
export const uploadMedia = async (req, res) => {
    try {
        const { user } = req; // authenticated user via middleware
        const files = req.files;
        const body = req.body;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No media files received." });
        }

        const savedMedia = {};

        for (const file of files) {
            const fieldName = file.fieldname; // e.g., 'file_0'

            // Get metadata fields like 'file_0_iv', 'file_0_mimeType', etc.
            const iv = body[`${fieldName}_iv`];
            const mimeType = body[`${fieldName}_mimeType`] || file.mimetype;
            const size = parseInt(body[`${fieldName}_size`] || file.size);

            if (!iv || !mimeType || !size) {
                return res.status(400).json({
                    error: `Missing metadata for file ${fieldName}`,
                });
            }

            // Read the encrypted content from disk
            const absolutePath = path.resolve(file.path);
            const ciphertext = await fs.readFile(absolutePath);

            // Save to MongoDB
            const mediaDoc = new Media({
                data: {
                    ciphertext,
                    iv,
                },
                mimeType,
                name: file.originalname,
                size,
                uploadedBy: user.username,
                uploadedAt: new Date(),
                width: undefined, // can be extracted later if needed
                height: undefined,
                duration: undefined,
                externalStorage: null, // or storage info if you use external later
            });

            const saved = await mediaDoc.save();
            savedMedia[file.originalname] = {
                id: saved._id,
            };
        }

        return res.status(200).json({
            message: "Media uploaded successfully.",
            media: savedMedia,
        });
    } catch (err) {
        logger.error({ err }, "Upload error");
        return res.status(500).json({ error: "Internal server error." });
    }
};

export const uploadMessage = async (req, res) => {
    const { user } = req; // authenticated user via middleware
    const { convId } = req.params;

    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "No messages provided." });
    }

    // Check admin privilege from Grant model
    const grant = await Grant.findOne({
        convoId: convId,
        grantee: user.username,
    });

    if (!grant || !grant.isAdmin) {
        return res.status(403).send({
            error: "Permission denied",
            state: 1,
        });
    }

    // ✅ Step 2: Get the last message's sequence
    const lastMsg = await Message.findOne({ convoId: convId })
        .sort({ sequence: -1 })
        .select("sequence");
    let currentSequence = lastMsg?.sequence ?? 0;

    const docs = [];

    for (const msg of messages) {
        // Validate basic fields
        if (!msg.type || !["text", "media"].includes(msg.type)) {
            return res
                .status(400)
                .json({ error: `Invalid type at index ${msg.index ?? "?"}` });
        }

        if (!msg.date || isNaN(new Date(msg.date).getTime())) {
            return res.status(400).json({
                error: `Missing or invalid date at index ${msg.index ?? "?"}`,
            });
        }

        const hierarchy = MSGUtils.indexToHierarchy(currentSequence);

        const baseDoc = {
            convoId: convId,
            sequence: ++currentSequence,
            sender: msg.sender ?? null,
            uploader: user.username, // who uploaded the message
            date: msg.date,
            type: msg.type,
            hierarchy: hierarchy,
            searchableHash: msg.searchableHash ?? [],
        };

        if (msg.type === "text") {
            if (!msg.content?.ciphertext || !msg.content?.iv) {
                return res.status(400).json({
                    error: `Missing content.ciphertext or iv in text message at index ${msg.index ?? "?"
                        }`,
                });
            }

            baseDoc.content = {
                ciphertext: msg.content.ciphertext,
                iv: msg.content.iv,
                metadata: msg.content.metadata ?? {},
            };
        } else if (msg.type === "media") {
            if (
                !msg.mediaRef?.mediaId ||
                !msg.mediaRef?.encryptedMediaKey?.ciphertext ||
                !msg.mediaRef?.encryptedMediaKey?.iv
            ) {
                return res.status(400).json({
                    error: `Missing mediaRef or encryptedMediaKey in media message at index ${msg.index ?? "?"
                        }`,
                });
            }

            baseDoc.mediaRef = {
                mediaId: msg.mediaRef.mediaId,
                encryptedMediaKey: {
                    ciphertext: msg.mediaRef.encryptedMediaKey.ciphertext,
                    iv: msg.mediaRef.encryptedMediaKey.iv,
                },
            };
            baseDoc.content = {
                ciphertext: msg.content.ciphertext,
                iv: msg.content.iv,
                metadata: msg.content.metadata ?? {},
            };
        }

        docs.push(baseDoc);
    }

    try {
        // Bulk insert
        await Message.insertMany(docs, { ordered: true });
    } catch (err) {
        logger.child("messages").error({ err }, "Bulk insert error");
        return res.status(500).json({ error: "Internal server error." });
    }

    res.status(200).json({
        message: "Messages uploaded successfully.",
        state: 0,
    });
};


export const getMessages = async (req, res) => {
    let { convId, startSeq, endSeq } = req.params

    const rules = {
        convId: { required: true, type: "string" },
    };

    const errors = validateRequest(req.params, rules);

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    // Default values for startSeq and endSeq
    startSeq = startSeq ? parseInt(startSeq) : undefined;
    endSeq = endSeq ? parseInt(endSeq) : 20;
    
    const grant = await Grant.findOne({
        convoId: convId,
        grantee: req.user.username,
    })
    if(grant===null){
        return res.status(403).json({
            error: "Forbidden.",
        });
    }

    const grantMap = grant.grants

    try {
        // If startSeq is undefined, fetch the last `endSeq` messages
        let query;
        if (typeof startSeq === "undefined") {
            query = Message.find({ convoId: convId })
                .sort({ sequence: -1 })
                .limit(endSeq);
        } else {
            // Fetch messages between startSeq and endSeq
            query = Message.find({
                convoId: convId,
                sequence: { $gte: startSeq, $lt: startSeq + endSeq },
            }).sort({ sequence: 1 });
        }

        const convoPromise = Convo.findOne({_id:convId})


        let [messages,convo] = await Promise.all([query.exec(),convoPromise])
        if(convo==null){
            return res.status(404).json({
                error: "No conversation found for the given id.",
            });
        }

        const grants = {}

        if(grantMap.has("all")){
            grants["all"] = grantMap.get("all")
        }
        else{
            grants["sender"] = grantMap.get("sender")

            // TODO: Complete the grants to send to the user
        }

        if (!messages || messages.length === 0) {
            return res.status(404).json({
                error: "No messages found for the given conversation.",
            });
        }

        return res.status(200).json({
            messages,
            grants,
            keySize:convo.aesSize
        });
    } catch (err) {
        logger.error({ err }, "Error fetching messages");
        return res.status(500).json({
            error: "Internal server error."
        });
    }
}

export const getMedia = async (req, res) => {
    const { mediaId } = req.params

    const rules = {
        mediaId: { required: true, type: "string" },
    };

    const errors = validateRequest(req.params, rules);

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        const media = await Media.findById(mediaId);

        if (!media) {
            return res.status(404).json({ error: "Media not found." });
        }

        // Decrypt the media content

        // Set the appropriate headers
        res.setHeader("Content-Type", media.mimeType);
        res.setHeader("Content-Length", media.size);

        // Send the decrypted content
        res.status(200).send({data:media.data,mimeType:media.mimeType});
    } catch (err) {
        logger.error({ err }, "Error fetching media");
        return res.status(500).json({ error: "Internal server error." });
    }
}