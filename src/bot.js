import config from "./config.js";
import {Markup, session, Telegraf} from "telegraf";
import * as Sentry from "@sentry/node";
import {ProfilingIntegration} from "@sentry/profiling-node";
import {
    createEpisodesButtons, createMoviesDownloadLinksButtons, createSeasonButtons,
    createSerialsDownloadLinkButtons,
    getMenuButtons, handleCastOptions, handleFollowSerial,
    handleMenuButtons,
    handleMovieData,
    handleMovieDownload, sendCastCredits, sendCastInfo, sendCastList,
    sendTrailer
} from "./menuButtons.js";
import {saveError} from "./saveError.js";
import {getAnimeWatchOnlineLink, sendMoviesToChannel, sleep} from "./channel.js";
import cron from "node-cron";
import {getMovieData, searchMovie} from "./api.js";
import {capitalize} from "./utils.js";
import {Mongo} from "@telegraf/session/mongodb";

if (!config.botToken) {
    throw new Error('"BOT_TOKEN" env var is required!');
}

if (config.nodeEnv !== 'dev') {
    await sleep(config.initialSleepMinute * 60 * 1000);
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

const store = Mongo({
    url: config.mongodbUrl,
    // database: "downloader",
    collection: "downloader-bot-context",
});

const bot = new Telegraf(config.botToken);
bot.use(session({store: store}));

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
    const userId = ctx.message?.from?.id ||
        (ctx.update.callback_query || ctx.update)?.message?.chat?.id ||
        ctx.update.callback_query?.from?.id ||
        ctx.update.inline_query?.from?.id ||
        ctx.update.chosen_inline_result?.from?.id;

    if (ctx.update.chosen_inline_result || ctx.update.callback_query?.from) {
        return await next();
    }

    try {
        let chatMember = await ctx.telegram.getChatMember('@' + config.channel, userId);
        if (chatMember.status === 'left' || chatMember.status === 'kicked') {
            await ctx.reply(`Please join our channel to use this bot: https://t.me/${config.channel}`);
            return;
        }
    } catch (error) {
        if (error.response?.error_code !== 403) {
            saveError(error);
        }
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
    } else if (text.startsWith('follow_serial')) {
        return handleFollowSerial(ctx, text);
    } else if (text.startsWith('cast_options')) {
        return handleCastOptions(ctx, text);
    } else if (text.match(/cast_(actors|directors|writers|others)_/)) {
        return sendCastList(ctx, text);
    } else if (text.match(/castID_(staff|character)_/)) {
        return sendCastCredits(ctx, text);
    } else if (text.match(/castInfo_(staff|character)_/)) {
        return sendCastInfo(ctx, text);
    }
});

bot.start(async (ctx) => {
    ctx.session = {
        ...(ctx.session || {}),
        pageNumber: 1,
        sortBase: '',
    };
    ctx.reply('Welcome', getMenuButtons());
});

bot.on('inline_query', async (ctx) => {
    let [query, se] = ctx.update.inline_query.query.toLowerCase().split('-');
    se = se?.trim() || "";
    const isComplex = se && !!se.match(/(s \d+(\se \d+)?)|(download?)|(season)/i);
    if (!query || query.length < 3) {
        return;
    }

    let searchResult = await searchMovie(query, 'medium', 1);
    if (searchResult === 'error' || searchResult.length === 0) {
        return;
    }

    const buttons = async (item) => {
        if (isComplex) {
            let dataLevel = item.type === "anime_serial" ? "high" : "dlink";
            let movieData = await getMovieData(item._id, dataLevel, item.type);
            if (movieData && movieData !== 'error') {
                item.movieData = movieData;
                if (item.type.includes('movie')) {
                    //movie links
                    let {buttons, columns} = createMoviesDownloadLinksButtons(movieData.qualities);
                    if (buttons.length > 0) {
                        return Markup.inlineKeyboard(buttons, {columns: columns});
                    }
                } else {
                    //serial
                    if (movieData.seasons.length > 0) {
                        if (se === 'download' || se === "season") {
                            //choose season
                            let {buttons, columns} = createSeasonButtons(movieData.seasons, item._id, item.type);
                            if (buttons.length > 0) {
                                return Markup.inlineKeyboard([...buttons], {columns: columns});
                            }
                        }

                        let [season, episode] = se.split(/season\s|(-)?episode\s/).filter(Boolean);
                        item.season = season;
                        item.episode = episode;

                        if (episode === null || episode === undefined) {
                            //choose episode
                            let {
                                buttons,
                                episodes,
                                columns
                            } = createEpisodesButtons(movieData.seasons, item._id, movieData.type, Number(season));
                            if (episodes.length > 0) {
                                return Markup.inlineKeyboard([...buttons], {columns: columns});
                            }
                        } else {
                            //download links
                            let {
                                buttons,
                                columns
                            } = createSerialsDownloadLinkButtons(movieData.seasons, Number(season), Number(episode));

                            if (buttons.length > 0) {
                                return Markup.inlineKeyboard(buttons, {columns: columns});
                            }
                        }
                    }
                }
            }

        }
        return Markup.inlineKeyboard([
            Markup.button.url("Info", `t.me/${config.botId}?start=movieID_${item._id}`),
            Markup.button.url("Download", `t.me/${config.botId}?start=download_${item._id}_${item.type}`),
        ]);
    };

    let results = [];
    for (let i = 0; i < searchResult.length; i++) {
        let btns = await buttons(searchResult[i]);
        let message_text = `${searchResult[i].rawTitle} | ${capitalize(searchResult[i].type)} | ${searchResult[i].year}`;
        if (isComplex && searchResult[i].type.includes('serial')) {
            message_text += `\n${se.replace('season', 'S').replace('episode', 'E').replace(/\s/g, '').toUpperCase()}\n`;
            if (searchResult[i].movieData?.apiIds && searchResult[i].episode) {
                let watchOnlineLinks = getAnimeWatchOnlineLink(searchResult[i].movieData.apiIds.gogoID, Number(searchResult[i].episode));
                for (let i = 0; i < watchOnlineLinks.length; i++) {
                    message_text += `${i + 1}. Watch Online: ${watchOnlineLinks[i]}\n`;
                }
            }
        }

        try {
            results.push({
                type: 'article',
                id: searchResult[i]._id || searchResult[i].movieId || searchResult[i].movieID,
                title: `${searchResult[i].rawTitle} | ${capitalize(searchResult[i].type)} | ${searchResult[i].year}`,
                description: searchResult[i].summary?.persian?.slice(0, 100) || searchResult[i].summary?.english?.slice(0, 100) || '',
                input_message_content: {
                    message_text: message_text,
                },
                thumbnail_url: searchResult[i].posters[0]?.url,
                photo_width: 30,
                photo_height: 30,
                inline_query_id: searchResult[i]._id.toString(),
                ...btns,
            });
        } catch (error) {
            saveError(error);
        }
    }

    ctx.answerInlineQuery(results, {cache_time: 0});
});

cron.schedule('*/5 * * * *', () => {
    sendMoviesToChannel(bot);
});

handleMenuButtons(bot);

await bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

