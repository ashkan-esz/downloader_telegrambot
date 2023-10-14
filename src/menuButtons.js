import {Markup} from "telegraf";
import {message} from "telegraf/filters";
import {searchMovie} from "./api.js";


const homeBtn = [Markup.button.callback('🏠 Home', 'Home')];

export function getMenuButtons() {
    return Markup.keyboard([
        ['🔍 Search', 'button 2'], // Row1 with 2 buttons
        ['button 3', 'button 4'], // Row2 with 2 buttons
        ['button 5', 'button 6', 'button 7'] // Row3 with 3 buttons
    ]).resize();
}

export function handleMenuButtons(bot) {
    bot.action('Home', (ctx) => moveToMainMenu(ctx));

    bot.action(/prev_/, (ctx) => {
        if (!ctx.session) {
            return moveToMainMenu(ctx);
        }
        let data = (ctx.update.callback_query?.data || '').split('_');
        ctx.session.pageNumber--;
        if (data[1] === 'search') {
            return handleMovieSearch(ctx, data[2]);
        }
    });
    bot.action(/next_/, (ctx) => {
        if (!ctx.session) {
            return moveToMainMenu(ctx);
        }
        let data = (ctx.update.callback_query?.data || '').split('_');
        ctx.session.pageNumber++;
        if (data[1] === 'search') {
            return handleMovieSearch(ctx, data[2]);
        }
    });

    bot.on(message('text'), (ctx) => {
        return handleMovieSearch(ctx);
    });
}

async function handleMovieSearch(ctx, title) {
    if (!ctx.session) {
        ctx.session = {
            pageNumber: 1,
        };
    }
    let message = title || ctx.message.text;
    if (!title) {
        ctx.session.pageNumber = 1;
    }
    const pageNumber = ctx.session.pageNumber;

    const replyMessage = `Searching \"${message}\" (Page:${pageNumber})`;
    let lastMessageId = ctx.session.lastMessageId || '';
    if (!title || !lastMessageId) {
        const {message_id} = await ctx.reply(replyMessage);
        lastMessageId = message_id;
    } else {
        const {message_id} = await ctx.telegram.editMessageText(
            ctx.update.callback_query.message.chat.id, ctx.session.lastMessageId,
            undefined, replyMessage);
        lastMessageId = message_id;
    }

    let searchResult = await searchMovie(message, pageNumber);

    if (searchResult === 'error') {
        return ctx.reply(`Server error on searching \"${message}\"`);
    }
    if (searchResult.length === 0 && pageNumber === 1) {
        const replyMessage = `No result for \"${message}\"`;
        return ctx.reply(replyMessage);
    }

    let buttons = searchResult.map(item => (
        [Markup.button.callback(
            `${item.rawTitle} | ${item.type} | ${item.year}`,
            'movieID_' + (item._id || item.movieId)
        )]
    ));
    let pagination = getPaginationButtons(ctx, searchResult, ['search', message]);
    if (lastMessageId) {
        await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, lastMessageId,
            undefined, `Choose one of the options: (Page:${pageNumber})`,
            {
                reply_markup: {
                    inline_keyboard: [...buttons, pagination, homeBtn],
                }
            });
        ctx.session.lastMessageId = lastMessageId;
    } else {
        let {message_id} = await ctx.reply(`Choose one of the options: (Page:${pageNumber})`,
            Markup.inlineKeyboard([...buttons, pagination, homeBtn]).resize());
        ctx.session.lastMessageId = message_id;
    }
}

function getPaginationButtons(ctx, searchResult, data) {
    let currentPage = ctx.session.pageNumber;
    if (searchResult.length % 12 !== 0) {
        if (currentPage > 1) {
            return [Markup.button.callback('⏪', 'prev_' + data.join('_'))];
        }
        return [];
    }
    if (currentPage === 1) {
        return [
            Markup.button.callback('⏩', 'next_' + data.join('_')),
        ];
    }
    return [
        Markup.button.callback('⏪', 'prev_' + data.join('_')),
        Markup.button.callback('⏩', 'next_' + data.join('_')),
    ];
}

function moveToMainMenu(ctx) {
    ctx.session = {
        pageNumber: 1,
    };
    return ctx.reply('What you wanna do now?', getMenuButtons());
}