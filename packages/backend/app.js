import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from './middleware/authenticate.js';
import { encryptResponse } from './middleware/encryptResponse.js';
import { User } from './models/User.js';
import crypto from 'crypto';
import AES from 'aes-js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Connect to MongoDB
mongoose.connect('mongodb://root:example_password@localhost:27017/secure-auth-app?authSource=admin');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});



// Registration route
app.post('/register', async (req, res) => {
  const { username } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send({error:'User already exists.'});
    }

    // Generate key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Save the public key to the database
    const newUser = new User({ username, publicKey });
    await newUser.save();

    // Return the private key to the user (to be stored locally)
    res.status(201).json({ username, privateKey });
  } catch (err) {
    res.status(500).send('Error registering user.');
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
