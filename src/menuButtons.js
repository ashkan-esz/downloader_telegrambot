import {Markup} from "telegraf";
import {message} from "telegraf/filters";
import {searchMovie} from "./api.js";


const homeBtn = ['🏠 Home'];

export function getMenuButtons() {
    return Markup.keyboard([
        ['🔍 Search', 'button 2'], // Row1 with 2 buttons
        ['button 3', 'button 4'], // Row2 with 2 buttons
        ['button 5', 'button 6', 'button 7'] // Row3 with 3 buttons
    ]).resize();
}

export function handleMenuButtons(bot) {
    bot.hears('🏠 Home', (ctx) => moveToMainMenu(ctx));

    bot.hears('⏪', (ctx) => {
        if (!ctx.session) {
            return moveToMainMenu(ctx);
        }
        ctx.session.pageNumber--;
        if (ctx.session.apiState === 'search') {
            return handleMovieSearch(ctx, false);
        }
    });
    bot.hears('⏩', (ctx) => {
        if (!ctx.session) {
            return moveToMainMenu(ctx);
        }
        ctx.session.pageNumber++;
        if (ctx.session.apiState === 'search') {
            return handleMovieSearch(ctx, false);
        }
    });

    bot.on(message('text'), (ctx) => {
        return handleMovieSearch(ctx, true);
    });
}

async function handleMovieSearch(ctx, newSearch = true) {
    if (!ctx.session) {
        ctx.session = {
            pageNumber: 1,
            apiState: '',
        };
    }
    let message = ctx.message.text;
    ctx.session.apiState = 'search';
    if (newSearch) {
        ctx.session.pageNumber = 1;
        ctx.session.apiState_title = message;
    } else {
        message = ctx.session.apiState_title;
    }
    const pageNumber = ctx.session.pageNumber;

    const replyMessage = pageNumber === 1
        ? `Searching \"${message}\"`
        : `Searching \"${message}\" (Page:${pageNumber})`;
    await ctx.reply(replyMessage, Markup.keyboard([homeBtn]).resize());

    let searchResult = await searchMovie(message, pageNumber);

    if (searchResult === 'error') {
        return ctx.reply(`Server error on searching \"${message}\"`);
    }
    if (searchResult.length === 0) {
        const replyMessage = pageNumber === 1
            ? `No result for \"${message}\"`
            : `No result for \"${message}\" (Page:${pageNumber})`;
        return ctx.reply(replyMessage);
    }
    let buttons = searchResult.map(item => ([`${item.rawTitle} | ${item.type} | ${item.year}`]));
    let pagination = getPaginationButtons(ctx, searchResult);
    return ctx.reply('Choose one of the options:', Markup.keyboard([homeBtn, ...buttons, pagination]).resize());
}

function getPaginationButtons(ctx, searchResult) {
    let currentPage = ctx.session.pageNumber;
    if (searchResult.length % 12 !== 0) {
        if (currentPage > 1) {
            return ['⏪'];
        }
        return [];
    }
    if (currentPage === 1) {
        return ['⏩'];
    }
    return ['⏪', '⏩'];
}

function moveToMainMenu(ctx) {
    ctx.session = {
        pageNumber: 1,
        apiState: '',
    };
    return ctx.reply('What you wanna do now?', getMenuButtons());
}