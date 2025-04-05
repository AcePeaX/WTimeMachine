import mongoose from "mongoose";
import { encryptResponseData, decryptRequestData } from "@timemachine/security";

const EncryptedTraceLogSchema = new mongoose.Schema({
    // Stores the encrypted result (AES key + encrypted data)
    encrypted: {
        aesKey: { type: String, required: true }, // base64-encoded AES key, RSA-encrypted
        data: { type: String, required: true }, // AES-encrypted payload (base64)
    },
    createdAt: { type: Date, default: Date.now },
});

/**
 * Pre-save hook:
 *  - If `this._rawData` and `this._publicKey` exist,
 *    use them to perform encryption, storing into `this.encrypted`
 *  - Then strip out the temporary fields
 */
EncryptedTraceLogSchema.pre("save", function (next) {
    if (this._rawData && this._publicKey) {
        // 1. Perform encryption with your library
        const { encryptedAESKey, encryptedMessage } = encryptResponseData(
            this._rawData,
            this._publicKey
        );

        // 2. Store into `this.encrypted`
        this.encrypted.aesKey = encryptedAESKey;
        this.encrypted.data = encryptedMessage;

        // 3. Clean up
        delete this._rawData;
        delete this._publicKey;
    }
    next();
});

/**
 * Post-init hook:
 *  - If `this._decryptionPrivateKey` is present,
 *    automatically decrypt the payload into `this.decrypted`
 */
EncryptedTraceLogSchema.post("init", function (doc) {
    if (
        doc.encrypted?.aesKey &&
        doc.encrypted?.data &&
        doc._decryptionPrivateKey
    ) {
        try {
            const decrypted = decryptRequestData(
                doc.encrypted.aesKey,
                doc.encrypted.data,
                doc._decryptionPrivateKey
            );
            doc.decrypted = decrypted; // Attach the raw data for easy usage
        } catch (err) {
            console.warn("[EncryptedTraceLog] Decryption failed:", err.message);
        }
    }
});

export default mongoose.model("EncryptedTraceLog", EncryptedTraceLogSchema);
