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
mongoose.connect('mongodb://root:example_password@localhost:27017/time-machine?authSource=admin');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});


// Mount the API sub-app on /api
app.use('/api', apiRouter);

// Protected route
app.post('/protected', authenticate, encryptResponse, (req, res) => {
  res.send({text:`Welcome to the protected endpoint, ${req.user.username}!`});
});

app.all('*', (req, res) => {
  console.log(req.url)
  res.status(404).send('Not Found');
});

// Start the server
app.listen(process.env.BACKEND_PORT, () => {
  console.log('Backend server is running on http://localhost:'+process.env.BACKEND_PORT);
});
