import { Convo } from "../models/Convo.js";
import { Grant } from "../models/Grant.js";

import { validateRequest, logger } from "@timemachine/utils";
import { User } from "../models/User.js";

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



export const addConvoUsers = async(req, res)=>{

    const rules = {
        convId: { required: true, type: "string" },
        username: { required: true, type: "string" },
        addUsername: { required: true, type: "string" },
        newGrantsKey: { type: "string" },
        isAdmin: { type: "boolean" }
    };

    const data = {...req.params, ...req.body}

    const errors = validateRequest(data, rules);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    const Conversation = await Convo.findOne({_id:data.convId})
    
    if(!Conversation.adminUsers.includes(data.username)) {
        return res.status(403).send({ error: "You don't have the permissions for such an action" })
    }

    if(Conversation.participantUsers.includes(data.addUsername)){
        return res.status(400).send({ error: "This user is already part of this conversation" })
    }

    if(!data.newGrantsKey){
        const grants = Grant.find({convoId: data.convId, grantee: data.username})
        const addedUser = User.findOne({username: data.addUsername})
        return res.status(202).send({status: 0, grants: await grants, addUserPubKey: (await addedUser).publicKey})
    }

    const isAdmin = data.isAdmin ? data.isAdmin : false

    await Grant.create({
        convoId: data.convId,
        grantee: data.addUsername,
        isAdmin,
        grants: {
            all:{
                encryptedDerivedKey: data.newGrantsKey,
            }
        }
    })

    const participantUsers = Conversation.participantUsers
    let adminUsers = Conversation.adminUsers

    participantUsers.push(data.addUsername)
    if(isAdmin){
        adminUsers.push(data.addUsername)
    }
    else{
        adminUsers = undefined
    }

    // # TO DO
    await Convo.updateOne({_id: data.convId},{participantUsers, adminUsers})

    res.status(200).send({status: 1})
}