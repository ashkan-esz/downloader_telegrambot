import config from "./config.js";
import {session, Telegraf} from "telegraf";
import {getMenuButtons, handleMenuButtons, handleMovieData, handleMovieDownload, sendTrailer} from "./menuButtons.js";

if (!config.botToken) {
    throw new Error('"BOT_TOKEN" env var is required!');
}

const bot = new Telegraf(config.botToken);
bot.use(session());

await bot.telegram.setChatMenuButton();

bot.use(async (ctx, next) => {
    const userId = ctx.message?.from?.id || (ctx.update.callback_query || ctx.update)?.message?.chat?.id;

    try {
        let chatMember = await ctx.telegram.getChatMember('@' + config.channel, userId);
        if (chatMember.status === 'left' || chatMember.status === 'kicked') {
            await ctx.reply(`Please join our channel to use this bot: https://t.me/${config.channel}`);
            return;
        }
    } catch (error) {
        // saveError(error);
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

// bot.command('oldschool', (ctx) => ctx.reply('Hello')); //todo :

handleMenuButtons(bot);

await bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

