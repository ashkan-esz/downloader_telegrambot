import config from "./config.js";
import {Markup, session, Telegraf} from "telegraf";
import * as Sentry from "@sentry/node";
import {ProfilingIntegration} from "@sentry/profiling-node";
import {getMenuButtons, handleMenuButtons, handleMovieData, handleMovieDownload, sendTrailer} from "./menuButtons.js";
import {saveError} from "./saveError.js";
import {sendMoviesToChannel} from "./channel.js";
import cron from "node-cron";
import {getMovieData, searchMovie} from "./api.js";
import {capitalize, encodersRegex} from "./utils.js";

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

bot.on('inline_query', async (ctx) => {
    const [query, se] = ctx.update.inline_query.query.split('-');
    const isComplex = se && !!se.match(/(s \d+(\se \d+)?)|d/i);
    if (!query || query.length < 3) {
        return;
    }

    let searchResult = await searchMovie(query, 'medium', 1);
    if (searchResult === 'error' || searchResult.length === 0) {
        return;
    }

    const buttons = async (item) => {
        if (isComplex) {
            let movieData = await getMovieData(item._id, 'dlink', item.type);
            if (movieData && movieData !== 'error') {
                if (item.type.includes('movie')) {
                    //movie links
                    let links = movieData.qualities.map(q => q.links).flat(1);
                    if (links.length > 0) {
                        let noCensoredLinks = links.filter(l => !l.info.toLowerCase().includes('censored'));

                        let buttons = noCensoredLinks.map(l => Markup.button.url(
                            `${l.info.replace(encodersRegex, '').replace(/(Hard|Soft)sub/i, 'subbed').replace(/\.+/g, '.')}`,
                            l.link
                        ));
                        return Markup.inlineKeyboard([...buttons], {columns: 2});
                    }
                } else {
                    //serial
                    if (movieData.seasons.length > 0) {
                        if (se === 'd') {
                            //choose season
                            let buttons = movieData.seasons.filter(s => s.episodes.find(e => e.links.length > 0))
                                .map(s => Markup.button.url(
                                    `Season ${s.seasonNumber} (Episodes: ${s.episodes.length})`,
                                    `t.me/${config.botId}?start=download_` + item._id + '_' + item.type + '_' + s.seasonNumber,
                                ));
                            if (buttons.length > 0) {
                                return Markup.inlineKeyboard([...buttons], {columns: 2});
                            }
                        }

                        let [_, season, episode] = se.split(/s |e /g);
                        let episodes = movieData.seasons.find(item => item.seasonNumber === Number(season))?.episodes
                            .filter(e => e.links.length > 0) || [];
                        if (episodes.length > 200) {
                            episodes = episodes.slice(episodes.length - 200);
                        }
                        if (episode === null || episode === undefined) {
                            //choose episode
                            if (episodes.length > 0) {
                                let buttons = episodes.map(e => Markup.button.url(
                                    `Episode ${e.episodeNumber} ${(e.title && e.title !== 'unknown' && !e.title.match(/episode \d/i)) ? `(${e.title})` : ''}`,
                                    `t.me/${config.botId}?start=download_` + item._id + '_' + item.type + '_' + season + '_' + e.episodeNumber,
                                ));
                                return Markup.inlineKeyboard([...buttons], {columns: 3});
                            }
                        } else {
                            //download links
                            let links = episodes.find(e => e.episodeNumber === Number(episode))?.links || [];
                            if (links.length > 0) {
                                let buttons = links.map(l => Markup.button.url(
                                    `${l.info.replace(encodersRegex, '').replace(/(Hard|Soft)sub/i, 'subbed').replace(/\.+/g, '.')}`,
                                    l.link
                                ));
                                return Markup.inlineKeyboard([...buttons], {columns: 2});
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
            message_text += `\n${se.replace(/\s/g, '').toUpperCase()}`;
        }

        results.push({
            type: 'article',
            id: searchResult[i]._id || searchResult[i].movieId || searchResult[i].movieID,
            title: `${searchResult[i].rawTitle} | ${capitalize(searchResult[i].type)} | ${searchResult[i].year}`,
            description: searchResult[i].summary?.persian?.slice(0, 50) || '',
            input_message_content: {
                message_text: message_text,
            },
            inline_query_id: searchResult[i]._id.toString(),
            ...btns,
        });
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

