import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema({
    // Unique ID (e.g., hash of content)
    mediaId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // Encrypted media blob (binary)
    data: {
        type: Buffer,
        required: true,
    },

    // MIME type: image/jpeg, video/mp4, audio/ogg, etc.
    mimeType: {
        type: String,
        required: true,
    },

    // Optional metadata
    originalName: String,
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
});

export default mongoose.model("Media", MediaSchema);
