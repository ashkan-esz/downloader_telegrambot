import dotenv from 'dotenv';

dotenv.config({path: './.env'});

export default Object.freeze({
    nodeEnv: process.env.NODE_ENV,
    printErrors: process.env.PRINT_ERRORS,
    botToken: process.env.BOT_TOKEN,
    serverBotToken: process.env.SERVER_BOT_TOKEN,
    apiUrl: process.env.API_URL,
    webUrl: process.env.WEB_URL,
    channel: process.env.CHANNEL,
    botId: process.env.BOT_ID,
    sentryDns: process.env.SENTRY_DNS,
});