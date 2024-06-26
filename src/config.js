import dotenv from 'dotenv';

dotenv.config({path: './.env'});

export default Object.freeze({
    nodeEnv: process.env.NODE_ENV,
    printErrors: process.env.PRINT_ERRORS,
    botToken: process.env.BOT_TOKEN,
    serverBotToken: process.env.SERVER_BOT_TOKEN,
    apiUrl: process.env.API_URL,
    webUrl: process.env.WEB_URL,
    localDownloadUrl: process.env.LOCAL_DOWNLOAD_URL,
    appDeepLink: process.env.APP_DEEP_LINK,
    channel: process.env.CHANNEL,
    botId: process.env.BOT_ID,
    sentryDns: process.env.SENTRY_DNS,
    minIMDBRate: Number(process.env.MIN_IMDB_RATE || 0),
    minMALRate: Number(process.env.MIN_MAL_RATE || 0),
    initialSleepMinute: Number(process.env.INITIAL_SLEEP_MINUTE || 2),
    appsDownloadLink: process.env.APPS_DOWNLOAD_LINK,
});