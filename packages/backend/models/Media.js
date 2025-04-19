import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
    {
        // 'inline' = stored directly, 'external' = stored on a remote drive
        storageType: {
            type: String,
            enum: ["inline", "external"],
            default: "inline",
        },

        // Encrypted media blob (only if inline)
        data: {
            ciphertext: { type: Buffer, required: true },
            iv: { type: String, required: true },
        },

        // External location (e.g., URL or Drive ID, only if external)
        location: {
            type: String,
        },

        // MIME type: image/jpeg, video/mp4, audio/ogg, etc.
        mimeType: {
            type: String,
            required: true,
        },

        // Optional metadata
        name: String,
        size: Number, // in bytes
        width: Number, // if image/video
        height: Number, // if image/video
        duration: Number, // if audio/video

        // Timestamps
        uploadedAt: {
            type: Date,
            default: Date.now,
        },

        uploadedBy: {
            type: String, // username
        },
    },
    {
        timestamps: {
            createdAt: "uploadedAt", // 👈 alias for createdAt
            updatedAt: "updatedAt", // 👈 alias for updatedAt
        },
    }
);

// Ensure consistency depending on storage type
MediaSchema.pre("validate", function (next) {
    if (this.storageType === "inline" && !this.data) {
        return next(new Error("Inline media must include data."));
    }
    if (this.storageType === "external" && !this.location) {
        return next(new Error("External media must include location."));
    }
    next();
});

export const Media = mongoose.model("Media", MediaSchema);
