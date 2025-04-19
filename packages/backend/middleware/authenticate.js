import { logger } from '@timemachine/utils';
import { User } from '../models/User.js';
import { verifyMessage } from '@timemachine/security';

// Authentication Middleware
export async function authenticate(req, res, next) {
    const { globalmessage, signature } = req.body;
    try {
      // Parse the message (assumes it's a JSON string)
      const parsedMessage = JSON.parse(globalmessage);
  
      const { username, timestamp } = parsedMessage;
  
      // Find the user in the database
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(401).send({ error: 'User not found.', state: 1 });
      }


      // Verify the signature using the user's public key
      const verified = verifyMessage(globalmessage, signature, user.publicKey);
      if (!verified) {
        return res.status(401).send({ error: 'Invalid signature.', state: 2 });
      }
  
      // Check if the timestamp is within a valid range (e.g., 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      const timeDifference = currentTime - parseInt(timestamp, 10);
  
      if (timeDifference > 120) { // 2 minutes
        return res.status(401).send({ error: 'Signature expired.', state: 3 });
      }
  
      // Attach the user to the request object
      req.user = user;
  
      // Merge all fields from the parsed message into req.body
      req.body = {
        ...req.body, // Keep existing fields in req.body
        ...parsedMessage, // Add all fields from the parsed message
      };
  
      next();
  
    } catch (err) {
      logger.error({err},'Error in authentication middleware');
      res.status(500).send({ error: 'Error authenticating user.', state: -1 });
    }
  }