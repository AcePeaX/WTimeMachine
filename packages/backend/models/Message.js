import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    convoId: { type: String, required: true, index: true },
    sequence: { type: Number, required: true },
    sender: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return typeof v === "string" || v === null;
            },
            message: "Sender must be a string or null",
        },
        default: null,
    },

    timestamp: { type: Number, required: true },
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
        ciphertext: { type: String , required: true},
        iv: { type: String, required: true },
        metadata: {
            encoding: String,
            lang: String,
        }
    },

    // For media messages only
    mediaRef: {
        mediaId: mongoose.Types.ObjectId,
        encryptedMediaKey: {
            ciphertext: { type: String , required: true},
            iv: { type: String, required: true },
        }
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
        if (!this.content?.ciphertext) {
            return next(new Error("Text messages require content.ciphertext"));
        }
        this.mediaRef = undefined; // strip mediaRef if not needed
    } else if (this.type === "media") {
        if (!this.mediaRef?.mediaId || !this.mediaRef?.encryptedMediaKey) {
            return next(
                new Error("Media messages require mediaRef with encrypted key")
            );
        }
        this.content = undefined; // strip text content
    } else {
        return next(new Error("Invalid message type"));
    }

    next();
});

export const Message = mongoose.model("Message", messageSchema);
