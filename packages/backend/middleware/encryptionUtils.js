import crypto from 'crypto';
import AES from 'aes-js';

// Function to encrypt a message with AES
export function encryptAES(message, key) {
  const textBytes = AES.utils.utf8.toBytes(message);
  const aesCtr = new AES.ModeOfOperation.ctr(key, new AES.Counter(5));
  const encryptedBytes = aesCtr.encrypt(textBytes);
  return AES.utils.hex.fromBytes(encryptedBytes);
}

// Function to decrypt a message with AES
export function decryptAES(encryptedHex, key) {
  const encryptedBytes = AES.utils.hex.toBytes(encryptedHex);
  const aesCtr = new AES.ModeOfOperation.ctr(key, new AES.Counter(5));
  const decryptedBytes = aesCtr.decrypt(encryptedBytes);
  return AES.utils.utf8.fromBytes(decryptedBytes);
}

// Function to encrypt an AES key with a public key
export function encryptAESKey(aesKey, publicKey) {
  return crypto.publicEncrypt(publicKey, aesKey);
}

// Function to decrypt an AES key with a private key
export function decryptAESKey(encryptedAESKey, privateKey) {
  return crypto.privateDecrypt(privateKey, Buffer.from(encryptedAESKey, 'base64'));
}

// Function to handle the entire encryption process
export function encryptResponseData(body, publicKey) {
  const aesKey = crypto.randomBytes(32); // Generate a random AES key
  const encryptedAESKey = encryptAESKey(aesKey, publicKey); // Encrypt the AES key
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const encryptedMessage = encryptAES(bodyString, aesKey); // Encrypt the message
  return {
    encryptedAESKey: encryptedAESKey.toString('base64'),
    encryptedMessage,
  };
}

// Function to handle the entire decryption process
export function decryptRequestData(encryptedAESKey, encryptedMessage, privateKey) {
    const aesKey = decryptAESKey(encryptedAESKey, privateKey); // Decrypt the AES key
    const decryptedMessage = decryptAES(encryptedMessage, aesKey); // Decrypt the message
  
    // Check if the decrypted message is a JSON object
    try {
      const parsedMessage = JSON.parse(decryptedMessage);
      return parsedMessage; // Return as an object if parsing succeeds
    } catch (error) {
      return decryptedMessage; // Return as a string if parsing fails
    }
}

// Function to sign a message with a private key
export function signMessage(message, privateKey) {
  const sign = crypto.createSign('SHA256'); // Create a SHA256 signature
  sign.update(message); // Add the message to be signed
  sign.end();
  const signature = sign.sign(privateKey, 'base64'); // Sign the message and return the signature in base64 format
  return signature;
}

// Function to verify a message with a public key
export function verifyMessage(message, signature, publicKey) {
  const verify = crypto.createVerify('SHA256'); // Create a SHA256 verifier
  verify.update(message); // Add the message to be verified
  verify.end();
  return verify.verify(publicKey, signature, 'base64'); // Verify the signature and return true/false
}


export function generateSignMessage(username, body, privateKey) {
  // Create a message to sign (you can customize this structure as needed)
  const message = JSON.stringify({
    ...body,
    username,
    timestamp: Date.now(), // Add a timestamp to ensure the signature is unique and time-sensitive
  });

  // Sign the message using the private key
  const signature = signMessage(message, privateKey);

  // Return the signed message and the signature
  return {
    globalmessage:message,
    signature,
  };
}
