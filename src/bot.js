import config from "./config.js";
import {session, Telegraf} from "telegraf";
import {getMenuButtons, handleMenuButtons, handleMovieData, sendTrailer} from "./menuButtons.js";

if (!config.botToken) {
    throw new Error('"BOT_TOKEN" env var is required!');
}

const bot = new Telegraf(config.botToken);
bot.use(session());

await bot.telegram.setChatMenuButton();

bot.hears(/^\/start (.*)$/, ctx => {
    let text = ctx.update.message.text.replace('/start ', '');
    if (text.startsWith('movieID_')) {
        return handleMovieData(ctx, text);
    } else if (text.startsWith('trailer_')) {
        return sendTrailer(ctx, text.split('trailer_').pop());
    }
});

bot.start((ctx) => {
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

