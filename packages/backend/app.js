import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from './middleware/authenticate.js';
import { encryptResponse } from './middleware/encryptResponse.js';
import { User } from './models/User.js';
import crypto from 'crypto';
import { verifyMessage } from '@timemachine/security';
import AES from 'aes-js';

const app = express();

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



// Registration route
app.post('/register', async (req, res) => {
  let body = {}
  try{
    body = JSON.parse(req.body.globalmessage);
  }
  catch (err){
    return res.status(400).send('Error registering user.');
  }
  const { username, publicKey, timestamp } = body
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send({error:'User already exists.'});
    }

    // Verify the public key
    const key = crypto.createPublicKey({
      key: publicKey, // Convert from Base64
      format: 'pem',
      type: 'spki',
    });

    if(!verifyMessage(req.body.globalmessage, req.body.signature, publicKey)){
      return res.status(400).send({error: "Error verifying signature"})
    }

    // Check if the timestamp is within a valid range (e.g., 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const timeDifference = currentTime - parseInt(timestamp, 10);

    if (timeDifference > 120) { // 2 minutes
      return res.status(401).send({ error: 'Signature expired.' });
    }

    // Save the public key to the database
    const newUser = new User({ username, publicKey });
    await newUser.save();

    // Return the private key to the user (to be stored locally)
    res.status(201).json({ username });
  } catch (err) {
    res.status(500).send({error:'Error registering user.',msg:err.message});
  }
});

// Protected route
app.post('/protected', authenticate, encryptResponse, (req, res) => {
  res.send({text:`Welcome to the protected endpoint, ${req.user.username}!`});
});

// Start the server
app.listen(3000, () => {
  console.log('Backend server is running on http://localhost:3000');
});
