import { Convo } from "../models/Convo.js";
import { Grant } from "../models/Grant.js";

import { validateRequest, logger } from "@timemachine/utils";

export const addConvo = async (req, res) => {
    const rules = {
        title: { required: true, type: "string" },
        description: { type: "string" },
        color: { type: "string" },
        aesSize: { required: true, type: "number", oneOf: [128, 192, 256] },
        encryptedAesConvoKey: { required: true, type: "string" },
        force: { type: "boolean" },
    };

    const errors = validateRequest(req.body, rules);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    const title = req.body.title;
    const force = req.body.force;
    const username = req.user.username;

    if (!force) {
        const similarConvo = await Convo.findOne({
            title: { $regex: new RegExp(`^${title}$`, "i") }, // case-insensitive match
            participantUsers: username, // checks if username exists in the array
        });

        if (similarConvo) {
            return res.status(400).send({
                error: "Conversation already exists.",
                state: 2,
            });
        }
    }

    try {
        const convo = await Convo.create({
            title,
            adminUsers: [username],
            description: req.body.description,
            participantUsers: [username],
            createdBy: username,
            aesSize: req.body.aesSize,
            color: req.body.color,
        });

        await Grant.create({
            grantee: username,
            convoId: convo._id,
            isAdmin: true,
            grants: {
                all: {
                    encryptedDerivedKey: req.body.encryptedAesConvoKey,
                },
            },
        });

        logger.info("Conversation created", { convoId: convo._id });
        res.status(201).json({
            convoId: convo._id,
            state: 0,
        });
    } catch (err) {
        logger.error("Error creating conversation:", err);
        res.status(500).send({
            error: "Error creating conversation.",
            state: -1,
            msg: err.message,
        });
    }
};

export const getUserConversations = async (req, res) => {
    try {
        const { user } = req;

        // Step 1: Get convoIds the user has access to
        const userGrants = await Grant.find({ grantee: user.username }).select(
            "convoId"
        );
        const convoIds = userGrants.map((grant) => grant.convoId);

        if (convoIds.length === 0) {
            return res.status(200).json({ conversations: [] });
        }

        // Step 2: Fetch those conversations
        const conversations = await Convo.find({ _id: { $in: convoIds } }).sort(
            { lastMessageAt: -1 }
        );

        return res.status(200).json({ conversations });
    } catch (err) {
        logger.warn("Error fetching conversations:", err.stack || err);
        return res.status(500).json({ error: "Internal server error" });
    }
};
