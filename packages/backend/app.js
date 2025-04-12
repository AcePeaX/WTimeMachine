import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from './middleware/authenticate.js';
import { encryptResponse } from './middleware/encryptResponse.js';
import apiRouter from './api/api.js'; // Make sure extension is included
import dotenv from 'dotenv';

const app = express();

dotenv.config({ path: '../../.env' });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


// Connect to MongoDB
mongoose.connect(`mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@localhost:27017/${process.env.DB_NAME}?authSource=admin`);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});


// Mount the API sub-app on /api
app.use('/api', apiRouter);

app.all('*', (req, res) => {
  console.log('Request received:', req.method, req.url);
  res.status(404).send('Not Found');
});

// Start the server
app.listen(process.env.BACKEND_PORT, () => {
  console.log('Backend server is running on http://localhost:'+process.env.BACKEND_PORT);
});
