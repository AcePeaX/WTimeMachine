import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true }
});

export const User = mongoose.model('User', userSchema);
