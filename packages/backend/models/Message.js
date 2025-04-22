import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    convoId: { type: String, required: true, index: true },
    sequence: { type: Number, required: true },
    sender: {
        type: String,
        default: null,
        validate: {
            validator: function (v) {
                return typeof v === "string" || v === null;
            },
            message: "Sender must be a string or null",
        },
    },

    date: { type: Date, required: true },
    type: { type: String, enum: ["text", "media"], required: true },

    hierarchy: {
        vault: { type: Number, required: true },
        block: { type: Number, required: true },
        group: { type: Number, required: true },
        chunk: { type: Number, required: true },
        message: { type: Number, required: true },
    },

    // For text messages only
    content: {
        ciphertext: { type: String },
        iv: { type: String },
        metadata: {
            encoding: String,
            lang: String,
        },
    },

    // For media messages only
    mediaRef: {
        mediaId: mongoose.Types.ObjectId,
        encryptedMediaKey: {
            ciphertext: { type: String },
            iv: { type: String },
        },
    },

    uploader: {
        type: String,
        required: true,
        default: null,
    },

    // Optional field for search support (hashed or HMACed value of plaintext)
    searchableHash: {
        type: [String],
        index: true,
    },
});

// Conditional validation based on type
messageSchema.pre("validate", function (next) {
    if (this.type === "text") {
        if (!this.content?.ciphertext || !this.content?.iv) {
            return next(
                new Error("Text messages require content.ciphertext and iv")
            );
        }
        this.mediaRef = undefined;
    } else if (this.type === "media") {
        if (
            !this.mediaRef?.mediaId ||
            !this.mediaRef?.encryptedMediaKey?.ciphertext ||
            !this.mediaRef?.encryptedMediaKey?.iv
        ) {
            return next(
                new Error(
                    "Media messages require mediaRef with encryptedMediaKey"
                )
            );
        }
    } else {
        return next(new Error("Invalid message type"));
    }

    next();
});

export const Message = mongoose.model("Message", messageSchema);
