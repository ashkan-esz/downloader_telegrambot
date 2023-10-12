import dotenv from 'dotenv';

dotenv.config({path: './.env'});

export default Object.freeze({
    botToken: process.env.BOT_TOKEN,
    serverBotToken: process.env.SERVER_BOT_TOKEN,
    apiUrl: process.env.API_URL,
});