import { encryptResponseData } from './encryptionUtils.js';

export function encryptResponse(req, res, next) {
    // Store the original send method in a closure variable
    const originalSend = res.send.bind(res);
    // Create a flag to ensure encryption happens only once
    let encrypted = false;
  
    res.send = function (body) {
      // If already encrypted, just send the body with the original send method
      if (encrypted) {
        return originalSend(body);
      }
  
      // If a user exists, encrypt only once
      if (req.user) {
        try {
          const { encryptedAESKey, encryptedMessage } = encryptResponseData(body, req.user.publicKey);
          // Set the flag so subsequent calls won't encrypt again
          encrypted = true;
          return originalSend({ key: encryptedAESKey, encryptedMessage });
        } catch (error) {
          console.error("Error encrypting response:", error);
          return originalSend({ error: "Failed to encrypt response." });
        }
      } else {
        return originalSend(body);
      }
    };
  
    next();
  }
  