
// logger.js
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: "../../.env" });

// Create logs directory if it doesn't exist
const logDir = path.resolve('../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Setup the file stream
const logStream = pino.destination({
    dest: path.join(logDir, 'app.log'),
    sync: false,
});


// Setup pretty transport for development
const logger = pino(
    {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production' && {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    },
    logStream
);

export default logger;