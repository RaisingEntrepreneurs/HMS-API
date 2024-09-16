const { createLogger, transports, format } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Define log format
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
);

// Create a new logger instance with daily rotation
const logger = createLogger({
  transports: [
    new transports.Console(), // Log to console
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '15d' // Retain logs for 30 days
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '15d' // Retain logs for 30 days
    })
  ],
  format: logFormat
});

module.exports = logger;