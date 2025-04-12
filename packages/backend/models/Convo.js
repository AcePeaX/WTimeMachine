import mongoose from "mongoose";

const VaultMetaSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            match: /^\d{6}$/, // 6-digit vault ID
        },
        label: {
            type: String,
            default: "",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        archived: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

const ConvoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: "",
    },
    color: {
        type: String,
        default: "#000000",
    },
    aesSize: {
        type: Number,
        default: 256,
    },
    encryptedAesConvoKey: {
        type: String,
        required: true
    },
    // 🔐 Admins and participants
    adminUsers: {
        type: [String],
        default: [],
        index: true,
    },

    participantUsers: {
        type: [String],
        default: [],
        index: true,
    },

    // 🔒 List of vaults used in this conversation
    vaults: {
        type: [VaultMetaSchema],
        default: [],
    },

    // Stats / Metadata
    messageCount: {
        type: Number,
        default: 0,
    },
    mediaCount: {
        type: Number,
        default: 0,
    },

    archived: {
        type: Boolean,
        default: false,
    },
    lastMessageAt: {
        type: Date,
    },
    lastEditedBy: {
        type: String,
    },
    createdBy: {
        type: String,
    },
    encryptionVersion: {
        type: String,
        default: "1.0",
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Automatically update `updatedAt` on any modification
ConvoSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

export const Convo = mongoose.model("Convo", ConvoSchema);
