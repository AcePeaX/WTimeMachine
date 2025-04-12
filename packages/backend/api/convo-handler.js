import { Convo } from "../models/Convo.js";

import { validateRequest } from "@timemachine/utils";

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

    const { convo } = req.body;

    const title = req.body.title;
    const username = req.user.username;
    const force = req.user.force;

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
            adminUsers: [username],
            createdBy: username,
            aesSize: req.body.aesSize,
            encryptedAesConvoKey: req.body.encryptedAesConvoKey,
            color: req.body.color,
        });

        console.log("✅ Conversation created:", convo._id);
        return convo;
    } catch (err) {
        console.error("❌ Error creating conversation:", err);
        throw err;
    }

    res.status(501).send({
        error: "Not yet implemented.",
        state: -1,
    });
};
