const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '..', 'logs');

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message }) =>
        `${timestamp} [${level.toUpperCase()}] ${message}`
      )
    )
  })
];

// File transport apenas para erros, e apenas em ambiente local (não em Vercel)
if (process.env.VERCEL !== '1') {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message }) =>
            `${timestamp} [${level.toUpperCase()}] ${message}`
          )
        )
      })
    );
  } catch (err) {
    console.error('Aviso: não foi possível criar diretório de logs:', err.message);
  }
}

const logger = winston.createLogger({
  level: 'info',
  transports
});

module.exports = logger;
