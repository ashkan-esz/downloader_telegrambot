import config from "./config.js";
import {session, Telegraf} from "telegraf";
import * as Sentry from "@sentry/node";
import {ProfilingIntegration} from "@sentry/profiling-node";
import {getMenuButtons, handleMenuButtons, handleMovieData, handleMovieDownload, sendTrailer} from "./menuButtons.js";
import {saveError} from "./saveError.js";
import {sendMoviesToChannel} from "./channel.js";
import cron from "node-cron";

if (!config.botToken) {
    throw new Error('"BOT_TOKEN" env var is required!');
}

Sentry.init({
    dsn: config.sentryDns,
    integrations: [
        new ProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.01,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 0.01,
});

const bot = new Telegraf(config.botToken);
bot.use(session());

await bot.telegram.setChatMenuButton();

bot.catch(async (err, ctx) => {
    saveError(err);
    try {
        await ctx.reply('Sorry, Internal Error');
    } catch (err2) {
        saveError(err2);
    }
});

bot.use(async (ctx, next) => {
    const userId = ctx.message?.from?.id || (ctx.update.callback_query || ctx.update)?.message?.chat?.id;

    try {
        let chatMember = await ctx.telegram.getChatMember('@' + config.channel, userId);
        if (chatMember.status === 'left' || chatMember.status === 'kicked') {
            await ctx.reply(`Please join our channel to use this bot: https://t.me/${config.channel}`);
            return;
        }
    } catch (error) {
        saveError(error);
        return;
    }

    await next();
});

bot.hears(/^\/start (.*)$/, ctx => {
    let text = ctx.update.message.text.replace('/start ', '');
    if (text.startsWith('movieID_')) {
        return handleMovieData(ctx, text);
    } else if (text.startsWith('trailer_')) {
        return sendTrailer(ctx, text.split('trailer_').pop());
    } else if (text.startsWith('download_')) {
        return handleMovieDownload(ctx, text);
    }
});

bot.start(async (ctx) => {
    ctx.session = {
        pageNumber: 1,
    };
    ctx.reply('Welcome', getMenuButtons());
});

cron.schedule('*/5 * * * *', () => {
    sendMoviesToChannel(bot);
});

handleMenuButtons(bot);

await bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

