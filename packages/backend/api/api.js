// api.js
import { Router } from "express";
import multer from "multer";

import { User } from '../models/User.js';


import { authenticate } from '../middleware/authenticate.js';
import { encryptResponse } from '../middleware/encryptResponse.js';

import crypto from "crypto";
import { verifyMessage } from '@timemachine/security';

import { addConvo, getUserConversations } from "./convo-handler.js";
import { uploadMedia, uploadMessage, getMessages, getMedia } from "./message-handler.js";


const apiRouter = Router();

const upload = multer({ dest: './resources/uploads/' });

// Registration route
apiRouter.post("/register", async (req, res) => {
    let body = {};
    try {
        body = JSON.parse(req.body.globalmessage);
    } catch (err) {
        return res.status(400).send({error: "Error in the request.", state: 1});
    }
    const { username, publicKey, timestamp } = body;
    const usernameRegex = /^[a-zA-Z0-9_]+$/;

    if (!usernameRegex.test(username)) {
        return res.status(400).send({
            error: "Invalid username. Only letters (A-Z, a-z), digits (0-9), and underscores (_) are allowed.",
            state: 5
        });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).send({ error: "User already exists.", state: 2 });
        }

        // Verify the public key
        crypto.createPublicKey({
            key: publicKey, // Convert from Base64
            format: "pem",
            type: "spki",
        });

        if (
            !verifyMessage(
                req.body.globalmessage,
                req.body.signature,
                publicKey
            )
        ) {
            return res.status(400).send({ error: "Error verifying signature", state: 3 });
        }

        // Check if the timestamp is within a valid range (e.g., 5 minutes)
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        const timeDifference = currentTime - parseInt(timestamp, 10);

        if (timeDifference > 120) {
            // 2 minutes
            return res.status(401).send({ error: "Signature expired.", state: 4 });
        }

        // Save the public key to the database
        const newUser = new User({ username, publicKey });
        await newUser.save();

        // Return the private key to the user (to be stored locally)
        res.status(201).json({ username, state: 0 });
    } catch (err) {
        res.status(500).send({
            error: "Error registering user.",
            state: -1,
            msg: err.message,
        });
    }
});

apiRouter.post("/login", authenticate, async (req, res) => {
    res.status(200).send({username: req.user.username, state: 0});
})

apiRouter.post("/media/:convoId", upload.any(), authenticate, encryptResponse, uploadMedia);

apiRouter.use(authenticate, encryptResponse);

apiRouter.post("/user", (req, res) => {
    res.status(200).send({ username: req.user.username, state: 0 });
})

apiRouter.get("/convo", getUserConversations);

apiRouter.post("/convo", addConvo);

apiRouter.get("/message/:convId", getMessages);
apiRouter.post("/message/:convId", uploadMessage);

apiRouter.get("/media/:mediaId", getMedia);




export default apiRouter;
