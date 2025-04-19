import fs from "fs/promises";
import path from "path";

import { Media } from "../models/Media.js";
import { logger } from "@timemachine/utils";

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
        setTimeout(() => {
            res.status(200).json({
                message: "Media uploaded successfully.",
                media: savedMedia,
            });
        }, 2000);
         
    } catch (err) {
        logger.error({ err }, "Upload error");
        return res.status(500).json({ error: "Internal server error." });
    }
};
