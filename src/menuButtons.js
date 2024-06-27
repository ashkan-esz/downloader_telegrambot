import config from "./config.js";
import {Markup} from "telegraf";
import {message} from "telegraf/filters";
import {getApps, getMovieData, getNewsAndUpdates, getSortedMovies, searchMovie} from "./api.js";
import {capitalize, encodersRegex} from "./utils.js";
import {saveError} from "./saveError.js";
import {sleep} from "./channel.js";


const homeBtn = [Markup.button.callback('🏠 Home', 'Home')];

export function getMenuButtons() {
    return Markup.keyboard([
        ['🔍 Search'],
        ['🔥 News', '🔥 Updates'],
        ['🔥 Coming Soon Anime', '🔥 Airing Anime'],
        ['🔥 Season Anime', '🔥 Upcoming Season Anime'],
        ['🔥 Coming Soon', '🔥 Theaters'],
        ['🔥 Top Likes', '🔥 Top Likes Of Month'],
        ['🔥 Top Follow Of Month'],
        ['📕 Instruction', 'Apps'],
    ]).resize();
}

export function handleMenuButtons(bot) {
    bot.action('Home', (ctx) => moveToMainMenu(ctx));
    bot.hears('🏠 Home', (ctx) => moveToMainMenu(ctx));

    bot.hears('🔍 Search', (ctx) => ctx.reply('Type the name of title to search'));

    bot.hears('🔥 Coming Soon Anime', (ctx) => sendSortedMovies(ctx, 'animeTopComingSoon'));
    bot.hears('🔥 Airing Anime', (ctx) => sendSortedMovies(ctx, 'animeTopAiring'));
    bot.hears('🔥 Season Anime', (ctx) => sendSortedMovies(ctx, 'animeSeasonNow'));
    bot.hears('🔥 Upcoming Season Anime', (ctx) => sendSortedMovies(ctx, 'animeSeasonUpcoming'));
    bot.hears('🔥 Coming Soon', (ctx) => sendSortedMovies(ctx, 'comingSoon'));
    bot.hears('🔥 Theaters', (ctx) => sendSortedMovies(ctx, 'inTheaters'));
    bot.hears('🔥 Top Likes', (ctx) => sendSortedMovies(ctx, 'like'));
    bot.hears('🔥 Top Likes Of Month', (ctx) => sendSortedMovies(ctx, 'like_month'));
    bot.hears('🔥 Top Follow Of Month', (ctx) => sendSortedMovies(ctx, 'follow_month'));
    bot.hears('🔥 News', (ctx) => sendSortedMovies(ctx, 'news'));
    bot.hears('🔥 Updates', (ctx) => sendSortedMovies(ctx, 'updates'));

    bot.hears('📕 Instruction', (ctx) => sendInstruction(ctx));
    bot.hears('Apps', (ctx) => sendApps(ctx));

    bot.hears('More...', (ctx) => {
        if (ctx.session && ctx.session.sortBase) {
            ctx.session.pageNumber++;
            return sendSortedMovies(ctx, ctx.session.sortBase);
        }
        return handleMovieSearch(ctx);
    });

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

    bot.action(/download_/, async (ctx) => {
        return handleMovieDownload(ctx);
    });

    bot.on(message('text'), (ctx) => {
        return handleMovieSearch(ctx);
    });
}

export async function sendSortedMovies(ctx, sortBase) {
    if (!ctx.session || !ctx.session.sortBase) {
        ctx.session = {
            pageNumber: 1,
            sortBase: sortBase,
        };
    } else if (ctx.session.sortBase !== sortBase) {
        ctx.session.pageNumber = 1;
        ctx.session.sortBase = sortBase;
    }

    await ctx.reply(`Fetching Movie Data (Page: ${ctx.session.pageNumber})`,
        Markup.keyboard([['🏠 Home', 'More...']]).resize());
    let movies = (sortBase === 'news' || sortBase === 'updates')
        ? await getNewsAndUpdates(sortBase, 'info', ctx.session.pageNumber)
        : await getSortedMovies(sortBase, 'info', ctx.session.pageNumber);
    if (movies === 'error') {
        return await ctx.reply('Server Error on fetching Movies data');
    } else if (movies.length === 0) {
        return await ctx.reply('Movies not found!');
    }
    for (let i = 0; i < movies.length; i++) {
        await sendMovieData(ctx, '', movies[i]);
        await sleep(1000);
    }
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
    if (ctx.session.sortBase) {
        ctx.session.sortBase = '';
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

    let searchResult = await searchMovie(message, 'low', pageNumber);

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
    try {
        if (message_id) {
            await ctx.deleteMessage(message_id);
        }

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
🎖 IMDB: ${movieData.rating.imdb} |Ⓜ️Meta: ${movieData.rating.metacritic} |🍅RT: ${movieData.rating.rottenTomatoes} | MAL: ${movieData.rating.myAnimeList}\n
📅 Year : ${movieData.year}\n
▶️ Status: ${capitalize(movieData.status)}\n
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
        caption += `📥 [Download](t.me/${config.botId}?start=download_${movieID}_${movieData.type})\n`;
        if (config.webUrl) {
            caption += `🌐 [Website](${config.webUrl}/${movieData.type}/${movieID}/${movieTitle.replace(/\s/g, '-') + '-' + movieData.year})\n`;
        }
        if (config.appDeepLink) {
            caption += `📱 [App](${config.appDeepLink}${movieData.type}/${movieID}/${movieData.year})\n`;
        }
        if (config.channel) {
            caption += `🆔 [@${config.channel}](t.me/${config.channel})`;
        }
        caption = caption.replace(/[!.*|{}#+>=_-]/g, res => '\\' + res);

        let replied = false;
        movieData.posters = movieData.posters.sort((a, b) => b.size - a.size);
        for (let i = 0; i < movieData.posters.length; i++) {
            try {
                await ctx.replyWithPhoto(movieData.posters[i].url, {
                    caption: caption,
                    parse_mode: 'MarkdownV2',
                });
                replied = true;
                break;
            } catch (error2) {
                if (error2.message.includes('Too Many Requests')) {
                    let sleepAmount = Number(error2.message.match(/\d+$/g).pop());
                    await sleep((sleepAmount + 1) && 1000);
                    i--;
                    continue;
                }
                if (
                    error2.message !== '400: Bad Request: wrong file identifier/HTTP URL specified' &&
                    error2.message !== '400: Bad Request: failed to get HTTP URL content'
                ) {
                    saveError(error2);
                }
            }
        }
        if (!replied) {
            await ctx.reply(caption, {parse_mode: 'MarkdownV2',});
        }
    } catch (error) {
        if (error.message && error.message.includes('Too Many Requests')) {
            let sleepAmount = Number(error.message.match(/\d+$/g).pop());
            await sleep((sleepAmount + 1) && 1000);
            return await sendMovieData(ctx, message_id, movieData);
        }
        saveError(error);
    }
}

export async function handleMovieDownload(ctx, text) {
    let data = (ctx.update.callback_query?.data || text || '')
        .toLowerCase()
        .replace('anime_movie', 'animemovie')
        .replace('anime_serial', 'animeserial')
        .split('_').slice(1);// movieID_type_season_episode
    if (data.length === 0 || data.length === 1) {
        return await ctx.reply(`Invalid MovieID`);
    }

    let state = data.length === 2 ? (data[1].includes('serial') ? 'Season' : 'DownloadLinks')
        : data.length === 3 ? 'Episode' : 'DownloadLinks';
    const {message_id} = await ctx.reply(`Fetching ${state} Data`);
    let movieData = await getMovieData(data[0], 'dlink', data[2]);
    if (movieData === 'error') {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'Server Error on fetching Movie data');
    } else if (!movieData) {
        return await ctx.telegram.editMessageText(
            ctx.update.message.chat.id, message_id,
            undefined, 'Movie data not found!');
    }

    if (data.length === 2) {
        //show seasons / movies download links
        if (data[1].includes('movie')) {
            //its movies download link
            let {links, torrentLinks, buttons, columns} = createMoviesDownloadLinksButtons(movieData.qualities);
            if (links.length === 0 && torrentLinks.length === 0) {
                return await ctx.telegram.editMessageText(
                    (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                    undefined, `\"${movieData.rawTitle}\" => No Download Link Found!`);
            }

            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, `\"${movieData.rawTitle}\" => Download Links`,
                Markup.inlineKeyboard(buttons, {columns: columns}),
            );
        } else {
            //its serial, choose season
            if (movieData.seasons.length === 0) {
                return await ctx.telegram.editMessageText(
                    (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                    undefined, `\"${movieData.rawTitle}\" => No Season Found!`);
            }

            let {buttons, columns} = createSeasonButtons(movieData.seasons, data[0], data[1]);

            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, `\"${movieData.rawTitle}\" => Choose Season`,
                Markup.inlineKeyboard([...buttons], {columns: columns}));
        }
    }
    if (data.length === 3) {
        //show episodes
        let {buttons, episodes, columns} = createEpisodesButtons(movieData.seasons, data[0], data[1], Number(data[2]));
        if (episodes.length === 0) {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, `\"${movieData.rawTitle}\" (Season: ${data[2]}) => No Episode Found!`);
        }

        return await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
            undefined, `\"${movieData.rawTitle}\" (Season: ${data[2]}) => Choose Episode`,
            Markup.inlineKeyboard([...buttons], {columns: columns}));
    }

    //show download links
    let {
        links,
        torrentLinks,
        buttons,
        columns
    } = createSerialsDownloadLinkButtons(movieData.seasons, Number(data[2]), Number(data[3]));
    if (links.length === 0 && torrentLinks.length === 0) {
        return await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
            undefined, `\"${movieData.rawTitle}\" (S${data[2]}E${data[3]}) => No Download Link Found!`);
    }

    return await ctx.telegram.editMessageText(
        (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
        undefined, `\"${movieData.rawTitle}\" (S${data[2]}E${data[3]}) => Download Links`,
        Markup.inlineKeyboard(buttons, {columns: columns}),
    );
}

export function createMoviesDownloadLinksButtons(qualities) {
    let links = qualities.map(q => q.links).flat(1);
    let torrentLinks = qualities.map(q => q.torrentLinks).flat(1);

    let buttons = links
        .filter(l => !l.info.toLowerCase().includes('censored'))
        .map(l => Markup.button.url(
            `${l.info.replace(encodersRegex, '').replace(/(Hard|Soft)sub/i, 'subbed').replace(/\.+/g, '.')}`,
            l.link
        ));
    let torrentButtons = torrentLinks.filter(l => l.type !== "magnet").map(l => Markup.button.url(
        `[Torrent]: ${l.info}`,
        l.link
    ));
    let torrentDirectButtons = torrentLinks.filter(l => l.localLink).map(l => Markup.button.url(
        `[Torrent:LocalLink]: ${l.info}`,
        config.localDownloadUrl + '/' + l.localLink.replace(/^\//, '')
    ));

    return {
        links: links,
        torrentLinks: torrentLinks,
        buttons: [...buttons, ...torrentButtons, ...torrentDirectButtons],
        columns: 2,
    }
}

export function createSeasonButtons(seasons, movieId, type) {
    let buttons = seasons.filter(s => s.episodes.find(e => e.links.length > 0 || e.torrentLinks.length > 0))
        .map(s => Markup.button.callback(
            `Season ${s.seasonNumber} (Episodes: ${s.episodes.length})`,
            'download_' + movieId + '_' + type + '_' + s.seasonNumber,
        ));

    return {
        buttons: buttons,
        columns: 2,
    }
}

export function createEpisodesButtons(seasons, movieId, type, season) {
    let episodes = seasons.find(item => item.seasonNumber === season)?.episodes
        .filter(e => e.links.length > 0 || e.torrentLinks.length > 0) || [];
    if (episodes.length > 200) {
        episodes = episodes.slice(episodes.length - 200);
    }

    let buttons = episodes.map(e => Markup.button.callback(
        `Epi ${e.episodeNumber} ${(e.title && e.title !== 'unknown' && !e.title.match(/episode \d/i)) ? `(${e.title})` : ''}`,
        'download_' + movieId + '_' + type + '_' + season + '_' + e.episodeNumber,
    ));

    return {
        episodes: episodes,
        buttons: buttons,
        columns: 3,
    }
}

export function createSerialsDownloadLinkButtons(seasons, seasonNumber, episodeNumber) {
    let episodes = seasons.find(item => item.seasonNumber === seasonNumber)?.episodes || [];
    let links = episodes.find(e => e.episodeNumber === episodeNumber)?.links || [];
    let torrentLinks = episodes.find(e => e.episodeNumber === episodeNumber)?.torrentLinks || [];

    let buttons = links.map(l => Markup.button.url(
        `${l.info.replace(encodersRegex, '').replace(/(Hard|Soft)sub/i, 'subbed').replace(/\.+/g, '.')}`,
        l.link
    ));
    let torrentButtons = torrentLinks.filter(l => l.type !== "magnet").map(l => Markup.button.url(
        `[Torrent]: ${l.info}`,
        l.link
    ));
    let torrentDirectButtons = torrentLinks.filter(l => l.localLink).map(l => Markup.button.url(
        `[Torrent:LocalLink]: ${l.info}`,
        config.localDownloadUrl + '/' + l.localLink.replace(/^\//, '')
    ));

    return {
        links: links,
        torrentLinks: torrentLinks,
        buttons: [...buttons, ...torrentButtons, ...torrentDirectButtons],
        columns: torrentButtons.length > 0 ? 1 : 2,
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
            saveError(error2);
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

async function sendApps(ctx) {
    let apps = await getApps();
    if (config.appsDownloadLink) {
        await ctx.reply('Check: https://github.com/ashkan-esz/downloader_app/releases/tag/release');
    }
    if (apps === 'error') {
        return await ctx.reply('Server Error on fetching Apps data');
    } else if (apps.length === 0) {
        return await ctx.reply('Apps not found!');
    }
    let text = '';
    for (let i = 0; i < apps.length; i++) {
        text += `${apps[i].appName} | ${apps[i].os}`;
        let version = apps[i].versions[0];
        if (version) {
            text += ` | ver ${version.version} --> [Download \\(${(version.fileData.size / 1024 / 1024).toFixed(1)}MB\\)](${version.fileData.url})\n\n`;
        }
    }
    text = text.replace(/[!.*|{}#+>=_-]/g, res => '\\' + res);
    await ctx.reply(text, {parse_mode: 'MarkdownV2'});
}

async function sendInstruction(ctx) {
    let botId = config.botId.replace(/[!.*|{}#+>=_-]/g, res => '\\' + res);
    let text = `
*1. Inline search:*\n@${botId} name\\_of\\_movie
_Example: @${botId} jujutsu kaisen_\n
*2. Inline search with direct download:*\n@${botId} name\\_of\\_movie -download
_Example: @${botId} jujutsu kaisen -download_\n
*3. Inline search with seasons list:*\n@${botId} name\\_of\\_movie -season
_Example: @${botId} jujutsu kaisen -season_\n
*4. Inline search with season selection:*\n@${botId} name\\_of\\_movie -season \\_number\\_
_Example: @${botId} jujutsu kaisen -season 1_\n
*5. Inline search with season and episode selection:*\n@${botId} name\\_of\\_movie -season \\_number\\_ episode \\_number\\_
_Example: @${botId} jujutsu kaisen -season 1 episode 5_\n
    `;
    text = text.replace(/[!.|{}#+>=-]/g, res => '\\' + res);
    await ctx.reply(text, {parse_mode: 'MarkdownV2'});
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