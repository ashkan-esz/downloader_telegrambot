import config from "./config.js";
import {Markup} from "telegraf";
import {message} from "telegraf/filters";
import {getMovieData, searchMovie} from "./api.js";
import {capitalize} from "./utils.js";


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

    bot.hears('🔍 Search', (ctx) => ctx.reply('Type the name of title to search'));

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

    bot.action(/movieID_/, async (ctx) => {
        return handleMovieData(ctx);
    });

    bot.on(message('text'), (ctx) => {
        return handleMovieSearch(ctx);
    });
}

export async function handleMovieData(ctx, movieID) {
    let data = (ctx.update.callback_query?.data || movieID || '').split('_');
    const {message_id} = await ctx.reply(`Fetching Movie Data`);
    let movieData = await getMovieData(data[1], 'info');
    if (movieData === 'error') {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'Server Error on fetching Movie data');
    } else if (!movieData) {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'Movie data not found!');
    }
    return await sendMovieData(ctx, message_id, movieData);
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
            `${item.rawTitle} | ${capitalize(item.type)} | ${item.year}`,
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

async function sendMovieData(ctx, message_id, movieData) {
    await ctx.deleteMessage(message_id);
    //todo : handle download

    let movieID = movieData._id || movieData.movieID;
    let trailerLink = '';
    if (movieData.trailers) {
        let trailer = movieData.trailers.filter(t => t.vpnStatus !== 'noVpn')[0];
        if (trailer) {
            trailerLink = `🎬 [Trailer](t.me/${config.botId}?start=trailer_${movieID})\n`;
        }
    }
    let caption = `
🎬 ${movieData.rawTitle}\n${trailerLink ? 'TRAILER' : ''}
🔹 Type : ${capitalize(movieData.type)}\n
🎖 IMDB: ${movieData.rating.imdb} |Ⓜ️Meta: ${movieData.rating.metacritic} |🍅RT: ${movieData.rating.rottenTomatoes} |MAL: ${movieData.rating.myAnimeList}\n
📅 Year : ${movieData.year}\n
⭕️ Genre : ${movieData.genres.map(g => capitalize(g)).join(', ')}\n
🎭 Actors : ${movieData.actorsAndCharacters.filter(item => !!item.staff).map(item => item.staff.name).join(', ')}\n
📜 Summary : \n${(movieData.summary.persian || movieData.summary.english).slice(0, 150)}...\n\n`;

    caption = caption.replace(/[()\[\]]/g, res => '\\' + res);
    caption = caption.replace('TRAILER', trailerLink);
    if (movieData.relatedTitles && movieData.relatedTitles.length > 0) {
        caption += `🔗 Related: \n${movieData.relatedTitles.slice(0, 10).map(item => {
            let title = `${item.rawTitle} \\(${item.year}\\) \\(${capitalize(item.relation)}\\)`;
            return `\t\t\t🎬 [${title}](t.me/${config.botId}?start=movieID_${item._id})`;
        }).join('\n')}\n\n`;
    }

    let movieTitle = movieData.title || movieData.rawTitle;
    caption += `📥 [Download](t.me/${config.botId}?start=download_${movieID})\n`;
    if (config.webUrl) {
        caption += `🌐 [Website](${config.webUrl}/${movieData.type}/${movieID}/${movieTitle.replace(/\s/g, '-') + '-' + movieData.year})\n`;
    }
    if (config.channel) {
        caption += `🔔 [Channel](t.me/${config.channel})`;
    }
    caption = caption.replace(/[!.*|{}#+=_-]/g, res => '\\' + res);

    let replied = false;
    for (let i = 0; i < movieData.posters.length; i++) {
        try {
            await ctx.replyWithPhoto(movieData.posters[i].url, {
                caption: caption,
                parse_mode: 'MarkdownV2',
            });
            replied = true;
            break;
        } catch (error2) {
            // saveError(error2);
        }
    }
    if (!replied) {
        await ctx.reply(caption, {parse_mode: 'MarkdownV2',});
    }

}

export async function sendTrailer(ctx, movieID) {
    const {message_id} = await ctx.reply(`Uploading Movie Trailer`);
    let movieData = await getMovieData(movieID, 'info');
    if (movieData === 'error') {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'Server Error on fetching Movie data');
    } else if (!movieData) {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'Movie data not found!');
    } else if (!movieData.trailers || movieData.trailers.length === 0) {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'No Trailer to upload!');
    }
    let counter = 0;
    let promiseArray = [];
    for (let i = 0; i < movieData.trailers.length; i++) {
        try {
            let prom = ctx.replyWithVideo(movieData.trailers[i].url).then(() => {
                counter++;
            });
            promiseArray.push(prom);
        } catch (error2) {
            // saveError(error2);
        }
    }
    await Promise.allSettled(promiseArray);
    promiseArray = null;
    if (counter === 0) {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'Error on uploading trailers');
    }
    await ctx.deleteMessage(message_id);
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