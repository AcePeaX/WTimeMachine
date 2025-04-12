import express from "express";
import mongoose from "mongoose";

import { logger } from "@timemachine/utils";

import apiRouter from "./api/api.js"; // Make sure extension is included
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const app = express();


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Connect to MongoDB
mongoose.connect(
    `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@localhost:27017/${process.env.DB_NAME}?authSource=admin`
);

const db = mongoose.connection;
db.on("error", ()=>{
    logger.error("MongoDB connection error");
});
db.once("open", () => {
    logger.info("Connected to MongoDB");
});

// Mount the API sub-app on /api
app.use("/api", apiRouter);

app.all("*", (req, res) => {
    logger.info("Request received:", req.method, req.url);
    res.status(404).send("Not Found");
});

// Start the server
app.listen(process.env.BACKEND_PORT, () => {
    logger.info(
        "Backend server is running on http://localhost:" +
            process.env.BACKEND_PORT
    );
});
