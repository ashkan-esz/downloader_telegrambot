import config from "./config.js";
import {Markup} from "telegraf";
import {message} from "telegraf/filters";
import * as API from "./api.js";
import * as TORRENT_API from "./api/torrentApi.js";
import {capitalize, encodersRegex} from "./utils.js";
import {saveError} from "./saveError.js";
import {getAnimeWatchOnlineLink, sleep} from "./channel.js";
import {
    addLinkToMap,
    generateDirectLinkForTorrent,
    handleTorrentSearch,
    sendTorrentDownloads,
    sendTorrentUsage
} from "./package/torrent.js";
import {
    createUserAccount,
    handleUserAccountLogin,
    handleUserSignup,
    loginToAccount,
    toggleAccountNotification
} from "./package/user.js";
import {
    handleCastOptions,
    handleStaffAndCharacterSearch,
    sendCastCredits,
    sendCastInfo,
    sendCastList
} from "./package/cast.js";


export const homeBtn = [Markup.button.callback('🏠 Home', 'Home')];

export function getMenuButtons() {
    return Markup.keyboard([
        ['🔍 Search'],
        ['🔍 Search Staff', '🔍 Search Character'],
        ['⚡️ Followings', '⚡️ Followings Updates'],
        ['🔥 News', '🔥 Updates'],
        ['🔥 Coming Soon Anime', '🔥 Airing Anime'],
        ['🔥 Season Anime', '🔥 Upcoming Season Anime'],
        ['🔥 Coming Soon', '🔥 Theaters'],
        ['🔥 Top Likes', '🔥 Top Likes Of Month'],
        ['🔥 Top Follow Of Month'],
        ['📕 Instruction', 'Apps'],
        ['🔒 Login', '🔒 SignUp'],
        ['📩 Toggle Account Notifications'],
        ['📩 Search Torrent'],
        ['📩 Torrent Usage', '📩 Torrent Downloads']
    ]).resize();
}

export function handleMenuButtons(bot) {
    bot.action('Home', (ctx) => moveToMainMenu(ctx));
    bot.hears('🏠 Home', (ctx) => moveToMainMenu(ctx));

    bot.hears('🔍 Search Staff', (ctx) => {
        ctx.sendMessage(
            "Write the Staff name",
            {
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: "Staff name",
                },
            },
        );
    });
    bot.hears('🔍 Search Character', (ctx) => {
        ctx.sendMessage(
            "Write the Character name",
            {
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: "Character name",
                },
            },
        );
    });
    bot.hears('📩 Search Torrent', (ctx) => {
        ctx.sendMessage(
            "Write the name to search",
            {
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: "search name",
                },
            },
        );
    });

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
    bot.hears('⚡️ Followings', (ctx) => sendSortedMovies(ctx, 'followings'));
    bot.hears('⚡️ Followings Updates', (ctx) => sendFollowingUpdates(ctx));

    bot.hears('📕 Instruction', (ctx) => sendInstruction(ctx));
    bot.hears('help', (ctx) => sendInstruction(ctx));
    bot.hears('🔒 Login', (ctx) => loginToAccount(ctx));
    bot.hears('🔒 SignUp', (ctx) => createUserAccount(ctx));
    bot.hears('📩 Toggle Account Notifications', (ctx) => toggleAccountNotification(ctx));
    bot.hears('Apps', (ctx) => sendApps(ctx));

    bot.hears('📩 Torrent Usage', (ctx) => sendTorrentUsage(ctx));
    bot.hears('📩 Torrent Downloads', (ctx) => sendTorrentDownloads(ctx));

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

    bot.action(/follow_serial_/, async (ctx) => {
        return handleFollowSerial(ctx);
    });

    bot.hears(/followings_all_updates/, async (ctx) => {
        return sendFollowingUpdates(ctx);
    });
    bot.action(/followings_all_updates/, async (ctx) => {
        return sendFollowingUpdates(ctx);
    });
    bot.hears(/followings_all/, async (ctx) => {
        return sendSortedMovies(ctx, 'followings');
    });
    bot.action(/followings_all/, async (ctx) => {
        return sendSortedMovies(ctx, 'followings');
    });

    bot.action(/cast_options/, async (ctx) => {
        return handleCastOptions(ctx);
    });
    bot.action(/cast_(actors|directors|writers|others)_/, async (ctx) => {
        return sendCastList(ctx, '');
    });
    bot.action(/castID_(staff|character)_/, async (ctx) => {
        return sendCastCredits(ctx, '');
    });
    bot.action(/castInfo_(staff|character)_/, async (ctx) => {
        return sendCastInfo(ctx, '');
    });

    bot.action(/generate_direct_/, async (ctx) => {
        return generateDirectLinkForTorrent(ctx, '');
    });
    bot.action(/searchTorrent_/i, async (ctx) => {
        return handleTorrentSearch(ctx, '', true);
    });

    bot.on(message('text'), (ctx) => {
        if (ctx.update?.message?.reply_to_message?.text === "Write the Staff name") {
            return handleStaffAndCharacterSearch(ctx, 'staff');
        }
        if (ctx.update?.message?.reply_to_message?.text === "Write the Character name") {
            return handleStaffAndCharacterSearch(ctx, 'character');
        }
        if (ctx.update?.message?.reply_to_message?.text === "Write the name to search") {
            return handleTorrentSearch(ctx, '', false);
        }

        if (ctx.message?.text?.match(/email\s?:/i)) {
            return handleUserSignup(ctx);
        }
        if (ctx.message?.text?.match(/username\s?:/i)) {
            return handleUserAccountLogin(ctx);
        }
        return handleMovieSearch(ctx);
    });
}

export async function sendSortedMovies(ctx, sortBase) {
    if (!ctx.session.accessToken && sortBase === "followings") {
        return await ctx.reply(`login to account first`);
    }

    if (!ctx.session || !ctx.session.sortBase) {
        ctx.session = {
            ...(ctx.session || {}),
            pageNumber: 1,
            sortBase: sortBase,
        };
    } else if (ctx.session.sortBase !== sortBase) {
        ctx.session.pageNumber = 1;
        ctx.session.sortBase = sortBase;
    }

    // api send 12, want to show 6 per page
    let apiPage = Math.floor((ctx.session.pageNumber + 1) / 2);

    const {message_id} = await ctx.reply(`Fetching Movie Data (Page: ${ctx.session.pageNumber})`);
    let movies = sortBase === "followings"
        ? await API.getFollowingSerials('info', apiPage, ctx.session.accessToken)
        : (sortBase === 'news' || sortBase === 'updates')
            ? await API.getNewsAndUpdates(sortBase, 'info', apiPage)
            : await API.getSortedMovies(sortBase, 'info', apiPage);
    if (movies === 'error') {
        return await ctx.reply('Server Error on fetching Movies data');
    }

    if (ctx.session.pageNumber % 2 === 0) {
        movies = movies.slice(6)
    } else {
        movies = movies.slice(0, 6);
    }

    if (movies.length === 0) {
        return await ctx.reply('Movies not found!');
    }

    await ctx.deleteMessage(message_id);
    await ctx.reply(`Movie Data (Page: ${ctx.session.pageNumber}) ---> Items: ${movies.length}`,
        Markup.keyboard([['🏠 Home', 'More...']]).resize(),
    );

    for (let i = 0; i < movies.length; i++) {
        await sendMovieData(ctx, '', movies[i]);
        await sleep(1000);
    }
    await ctx.reply(`End of Movies (Page: ${ctx.session.pageNumber})`);
}

export async function handleMovieData(ctx, movieID) {
    let data = (ctx.update.callback_query?.data || movieID || '').split('_');
    const {message_id} = await ctx.reply(`Fetching Movie Data`);
    let movieData = await API.getMovieData(data[1], 'info');
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
            ...(ctx.session || {}),
            pageNumber: 1,
            sortBase: '',
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

    let searchResult = await API.searchMovie(message, 'low', pageNumber);

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
        let status = capitalize(movieData.status);

        // if (movieData.type.includes('serial') && movieData.status === "running") {
        //     let [_, torrentSeason, torrentEpisode] = movieData.latestData.torrentLinks.split(/[se]/gi).map(item => Number(item));
        //     let latestSe = movieData.seasonEpisode.pop();
        //     if (latestSe && latestSe.episodes > 11) {
        //         if (
        //             (movieData.latestData.season === latestSe.seasonNumber && movieData.latestData.episode === latestSe.episodes) ||
        //             (torrentSeason === latestSe.seasonNumber && torrentEpisode === latestSe.episodes)
        //         ) {
        //             status += " (waiting for new season)";
        //         } else {
        //             latestSe = movieData.seasonEpisode.pop();
        //             if (latestSe && latestSe.episodes > 11) {
        //                 if (
        //                     (movieData.latestData.season === latestSe.seasonNumber && movieData.latestData.episode === latestSe.episodes) ||
        //                     (torrentSeason === latestSe.seasonNumber && torrentEpisode === latestSe.episodes)
        //                 ) {
        //                     status += " (waiting for new season)";
        //                 }
        //             }
        //         }
        //     }
        // }

        let caption = `
🎬 ${movieData.rawTitle}\n${trailerLink ? 'TRAILER' : ''}
🔹 Type : ${capitalize(movieData.type)}\n
🎖 IMDB: ${movieData.rating.imdb} |Ⓜ️Meta: ${movieData.rating.metacritic} |🍅RT: ${movieData.rating.rottenTomatoes} | MAL: ${movieData.rating.myAnimeList}\n
📅 Year : ${movieData.year}\n
▶️ Status: ${status}\n
⭕️ Genre : ${movieData.genres.map(g => capitalize(g)).join(', ')}\n
🎭 Actors : ACTORS_LINKS\n
📜 Summary : \n${(movieData.summary.persian || movieData.summary.english).slice(0, 150)}...\n\n`;

        caption = caption.replace(/[()\[\]]/g, res => '\\' + res);
        caption = caption.replace('TRAILER', trailerLink);

        let actors = movieData.actorsAndCharacters.filter(item => !!item.staff);
        let uniqueActors = [];
        for (let i = 0; i < actors.length; i++) {
            if (!uniqueActors.find(u => u.staff.id === actors[i].staff.id)) {
                uniqueActors.push(actors[i]);
            }
        }
        let actorsLinks = uniqueActors
            .map(item => `[${capitalize(item.staff.name)}](t.me/${config.botId}?start=castInfo_staff_${item.staff.id})`)
            .join(', ');
        caption = caption.replace('ACTORS_LINKS', actorsLinks);

        if (movieData.relatedTitles && movieData.relatedTitles.length > 0) {
            caption += `🔗 Related: \n${movieData.relatedTitles.slice(0, 10).map(item => {
                let title = `${item.rawTitle} \\(${item.year}\\) \\(${capitalize(item.relation)}\\)`;
                return `\t\t\t🎬 [${title}](t.me/${config.botId}?start=movieID_${item._id})`;
            }).join('\n')}\n\n`;
        }

        let movieTitle = movieData.title || movieData.rawTitle;
        caption += `📥 [Download](t.me/${config.botId}?start=download_${movieID}_${movieData.type})\n`;
        if (movieData.type.includes('serial')) {
            caption += `⚡️ [Follow](t.me/${config.botId}?start=follow_serial_${movieID})\n`;
        }
        if (config.channel) {
            caption += `🆔 [Channel](t.me/${config.channel}) || `;
        }
        if (config.webUrl) {
            caption += `🌐 [Website](${config.webUrl}/${movieData.type}/${movieID}/${movieTitle.replace(/\s/g, '-') + '-' + movieData.year}) || `;
        }
        if (config.appDeepLink) {
            caption += `📱 [App](${config.appDeepLink}${movieData.type}/${movieID}/${movieData.year})\n`;
        }
        caption = caption.replace(/\s\|\|\s$/, '');

        caption += `\n🎭 [All Cast](t.me/${config.botId}?start=cast_options_${movieID})\n`;

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
    let dataLevel = data[1]?.toLowerCase() === "animeserial" ? "high" : "dlink";
    let movieData = await API.getMovieData(data[0], dataLevel, data[2]);
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

            await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, `\"${movieData.rawTitle}\" => Download Links`,
                Markup.inlineKeyboard(buttons, {columns: columns}),
            );

            return await sendGenerateDirectTorrentButtons(ctx, torrentLinks, data[0]);
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
            undefined, `\"${movieData.rawTitle}\" (S${data[2]}E${data[3]}) =\\> No Download Link Found!`);
    }

    let caption = `\"${movieData.rawTitle}\" (S${data[2]}E${data[3]}) =\\> Download Links\n\n`;
    if (movieData.apiIds?.gogoID) {
        let watchOnlineLinks = getAnimeWatchOnlineLink(movieData.apiIds.gogoID, Number(data[3]));
        for (let i = 0; i < watchOnlineLinks.length; i++) {
            caption += `\> ${i + 1}. Watch Online: ${watchOnlineLinks[i]}\n`;
        }
    }

    caption = caption.replace(/[()\[\]!.*|{}#+=_-]/g, res => '\\' + res);
    await ctx.telegram.editMessageText(
        (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
        undefined, caption,
        {
            reply_markup: Markup.inlineKeyboard(buttons, {columns: columns}).reply_markup,
            parse_mode: "MarkdownV2",
            link_preview_options: {
                is_disabled: true,
            },
        },
    );

    await moveToMainMenu(ctx);

    return await sendGenerateDirectTorrentButtons(ctx, torrentLinks, data[0]);
}

export async function handleFollowSerial(ctx, text = '') {
    try {
        if (!ctx.session.accessToken) {
            return await ctx.reply(`login to account first`);
        }

        let temp = (ctx.update.callback_query?.data || text || '').split("_");
        let movieId = temp.pop();
        if (!movieId) {
            return await ctx.reply(`Invalid MovieID`);
        }
        let isUnfollow = temp.pop().toLowerCase() === "unfollow";

        const {message_id} = await ctx.reply('⏳');

        let result = await API.followSerial(movieId, isUnfollow, ctx.session.accessToken);
        if (result.code !== 200) {
            let errorMessage = (result.code === 401 || result.code === 403)
                ? 'Login to account first'
                : `Server Error on following serial: ${result.errorMessage}`;
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, errorMessage);
        }

        let movieData = await API.getMovieData(movieId);
        let title = "";
        if (movieData) {
            title = `: ${movieData.rawTitle} | ${movieData.year}`;
        }

        let buttons = [
            Markup.button.callback(
                `${isUnfollow ? 'Follow' : 'UnFollow'}`,
                isUnfollow ? 'follow_serial_' + movieId : 'follow_serial_unfollow_' + movieId,
            ),
            Markup.button.callback(
                `INFO`,
                'movieID_' + movieId,
            ),
            Markup.button.callback(
                `⚡️ Followings List`,
                'followings_all',
            ),
            Markup.button.callback(
                `⚡️ Followings Updates`,
                'followings_all_updates',
            ),
        ];

        return await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
            undefined, `Successfully ${isUnfollow ? 'UnFollowed' : 'Followed'} ${title}`,
            Markup.inlineKeyboard(buttons, {columns: 2}), {columns: 2});

    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

export async function sendFollowingUpdates(ctx) {
    try {
        if (!ctx.session.accessToken) {
            return await ctx.reply(`login to account first`);
        }

        const {message_id} = await ctx.reply('⏳');

        let movies = [];
        let pageNumber = 1;
        for (let i = 0; i < 3; i++) {
            let result = await API.getFollowingSerials('info', pageNumber, ctx.session.accessToken);
            movies.push(...result);
            if (result.length === 0 || result.length % 12 !== 0) {
                break;
            }
        }

        if (movies.length === 0) {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, "Follow some series first!");
        }

        let caption = '';
        let counter = 0;
        for (let i = 0; i < movies.length; i++) {
            counter++;
            let latestData = movies[i].latestData;
            caption += `
${i + 1}. [${movies[i].rawTitle} | ${movies[i].year}](t.me/${config.botId}?start=movieID_${movies[i]._id})\n
Update: S${latestData.season}E${latestData.episode} --- ${latestData.quality}
Torrent: ${latestData.torrentLinks.toUpperCase() || '-'}
HardSub: ${latestData.hardSub.toUpperCase() || '-'}
WatchOnline: ${latestData.watchOnlineLink.toUpperCase() || '-'}\n`
            caption = caption.replace(/\n?[a-z]+:\s((s1e0 ---)|-)/gi, '');
            caption += '—————————————————————————';

            if (counter === 10 || i === movies.length - 1) {
                caption = caption.replace(/[!.*|{}#+>=_-]/g, res => '\\' + res);

                if (i === 9) {
                    await ctx.deleteMessage(message_id);
                }
                await ctx.telegram.sendMessage(
                    (ctx.update.callback_query || ctx.update).message.chat.id,
                    caption, {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {},
                    });
                caption = "";
                counter = 0;
            }
        }


    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

//----------------------------------------------------------------------------------
//----------------------------------------------------------------------------------

async function sendGenerateDirectTorrentButtons(ctx, torrentLinks, movieId) {
    let limitsResult = await TORRENT_API.getTorrentLimits();
    if (limitsResult.code === 200 && limitsResult.data.torrentDownloadDisabled) {
        //service is disabled
        return
    }

    let generateDirectButtons = torrentLinks
        .filter(l => l.type !== "magnet" && !l.localLink && (l.size <= limitsResult.data.downloadFileSizeLimitMb || !limitsResult.data.downloadFileSizeLimitMb))
        .map(l => {
            let linkId = addLinkToMap(l.link);
            return {
                // text: `⤵️GENERATE: ${l.info} \nSize: ${l.size}MB \nOk: ${l.okCount}, Bad:${l.badCount} \nLINK: ${decodeURIComponent(l.link)}`.replace(/[!.*|(){}#+>=_-]/g, res => '\\' + res),
                text: `⤵️${l.info} \nSize: ${l.size}MB \nOk: ${l.okCount}, Bad:${l.badCount}`.replace(/[!.*|(){}#+>=_-]/g, res => '\\' + res),
                link: `t.me/${config.botId}?start=generate_direct_${movieId}_${linkId}`,
            }
        });

    if (generateDirectButtons.length > 0) {
        let generateDirectCaption = "------ Generate Direct Link For Torrent ------\n\n".replace(/[!.*|{}#+>=_-]/g, res => '\\' + res);
        for (let i = 0; i < generateDirectButtons.length; i++) {
            generateDirectCaption += `${i + 1}\\. [${generateDirectButtons[i].text}](${generateDirectButtons[i].link})\n\n`
        }
        return await ctx.reply(generateDirectCaption, {parse_mode: 'MarkdownV2',});
    }
}

export function createMoviesDownloadLinksButtons(qualities) {
    let links = qualities.map(q => q.links).flat(1);
    let torrentLinks = qualities.map(q => q.torrentLinks).flat(1);

    let buttons = links
        .filter(l => !l.info.toLowerCase().includes('censored'))
        .map(l => Markup.button.url(
            `${l.info.replace(encodersRegex, '').replace(/(Hard|Soft)sub/i, 'subbed').replace(/\.+/g, '.')} - ${l.sourceName}`,
            l.link
        ));
    let torrentButtons = torrentLinks.filter(l => l.type !== "magnet").map(l => Markup.button.url(
        `[🔻Torrent]: ${l.info} - ${l.size}MB - ok:${l.okCount},bad:${l.badCount}`,
        l.link
    ));

    let torrentDirectButtons = torrentLinks.filter(l => l.localLink).map(l => Markup.button.url(
        `[⤵️✅Torrent:Direct]: ${l.info} - ${l.size}MB - expire:${l.localLinkExpire},ok:${l.okCount},bad:${l.badCount}`,
        l.localLink
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
        `${l.info.replace(encodersRegex, '').replace(/(Hard|Soft)sub/i, 'subbed').replace(/\.+/g, '.')} - ${l.sourceName}`,
        l.link
    ));
    let torrentButtons = torrentLinks.filter(l => l.type !== "magnet").map(l => Markup.button.url(
        `[🔻Torrent]: ${l.info} - ${l.size}MB - ok:${l.okCount},bad:${l.badCount}`,
        l.link
    ));

    let torrentDirectButtons = torrentLinks.filter(l => l.localLink).map(l => Markup.button.url(
        `[⤵️✅Torrent:Direct]: ${l.info} - ${l.size}MB - expire:${l.localLinkExpire},ok:${l.okCount},bad:${l.badCount}`,
        l.localLink
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
    let movieData = await API.getMovieData(movieID, 'info');
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
    let apps = await API.getApps();
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
*1. Inline search:*\n@${botId} [name\\_of\\_movie]
_Example: @${botId} jujutsu kaisen_\n
*2. Inline search with direct download:*\n@${botId} [name\\_of\\_movie] -download
_Example: @${botId} jujutsu kaisen -download_\n
*3. Inline search with seasons list:*\n@${botId} [name\\_of\\_movie] -season
_Example: @${botId} jujutsu kaisen -season_\n
*4. Inline search with season selection:*\n@${botId} [name\\_of\\_movie] -season [number]
_Example: @${botId} jujutsu kaisen -season 1_\n
*5. Inline search with season and episode selection:*\n@${botId} [name\\_of\\_movie] -season [number] episode [number]
_Example: @${botId} jujutsu kaisen -season 1 episode 5_\n
    `;
    text = text.replace(/[!.|{}#+>=\-\[\]]/g, res => '\\' + res);
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

export function moveToMainMenu(ctx) {
    ctx.session = {
        ...(ctx.session || {}),
        pageNumber: 1,
        sortBase: '',
    };
    return ctx.reply('What you wanna do now?', getMenuButtons());
}