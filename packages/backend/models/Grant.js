import mongoose from "mongoose";

// Grant Entry (what each grant contains)
const GrantEntrySchema = new mongoose.Schema(
    {
        encryptedDerivedKey: { type: String, required: true },
        grantedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

// Main Grant Bundle Schema (one per user per convo)
const GrantBundleSchema = new mongoose.Schema({
    convoId: { type: String, required: true, index: true },
    grantee: { type: String, required: true, index: true },

    isAdmin: { type: Boolean, default: false },

    // Map of grants by key like "chunk-000042.01.02.05" or "all"
    grants: {
        type: Map,
        of: GrantEntrySchema,
        default: {},
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// 🔒 Compound unique index to avoid duplicates
GrantBundleSchema.index({ convoId: 1, grantee: 1 }, { unique: true });

/**
 * Validate grant keys before saving:
 * Ensures:
 * - Valid level
 * - Correct digit lengths (vault: 6, others: 2)
 */
const LEVELS = ["vault", "block", "group", "chunk", "message"];

GrantBundleSchema.pre("validate", function (next) {
    const grantKeys = Array.from(this.grants?.keys?.() || []);

    for (const key of grantKeys) {
        if (key === "all" || key === "sender") continue; // Allow "all" and "sender" as a valid universal grant key

        const [level, pathStr] = key.split("-");
        if (!LEVELS.includes(level)) {
            return next(
                new Error(`Invalid grant level "${level}" in key: "${key}"`)
            );
        }

        const parts = pathStr.split(".");
        if (level === "vault") {
            if (parts.length !== 1 || parts[0].length !== 6) {
                return next(
                    new Error(
                        `Vault key "${key}" must be a single 6-digit path.`
                    )
                );
            }
        } else {
            if (parts[0].length !== 6) {
                return next(
                    new Error(`Key "${key}" must start with 6-digit vault ID.`)
                );
            }
            if (!parts.slice(1).every((p) => p.length === 2)) {
                return next(
                    new Error(
                        `Non-vault key "${key}" must have 2-digit subpaths.`
                    )
                );
            }
        }
    }

    next();
});

export const Grant = mongoose.model("UserGrantBundle", GrantBundleSchema);
