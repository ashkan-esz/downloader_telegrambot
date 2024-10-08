import config from "./config.js";
import {getChannelNewsAndUpdates} from "./api.js";
import {capitalize} from "./utils.js";
import {saveError} from "./saveError.js";

export const torrentSourcesNames = Object.freeze([
    'tokyotosho', 'shanaproject', 'nyaa', 'eztv',
]);

export async function sendMoviesToChannel(bot) {
    let imdbLimit = Math.max(config.minIMDBRate + 0.6, 8.5);
    let malLimit = Math.max(config.minMALRate + 0.6, 8.5);
    while (true) {
        let movies = [];
        let retryCounter = 0;
        while (retryCounter < 3) {
            movies = await getChannelNewsAndUpdates();
            if (movies && movies !== 'error') {
                for (let i = 0; i < movies.length; i++) {
                    if (
                        (movies[i].rating.imdb >= imdbLimit || movies[i].rating.myAnimeList >= malLimit) ||
                        movies[i].sources.find(s => !torrentSourcesNames.includes(s.sourceName))
                    ) {
                        await sendMovieDataToChannel(bot, movies[i]);
                        await sleep(1000);
                    }
                }
                break;
            } else if (movies === 'error') {
                retryCounter++;
                await sleep(61 * 1000);
            }
        }
        if (movies.length === 0 || retryCounter === 3) {
            break;
        }
    }
}

async function sendMovieDataToChannel(bot, movieData) {
    try {
        let movieID = movieData._id || movieData.movieID;
        let updateReason = movieData.latestData.updateReason; //'season' | 'episode' | 'quality'

        if (movieData.type.includes('movie') &&
            updateReason === 'quality' &&
            (
                Number(movieData.year) < (new Date().getFullYear()) ||
                !movieData.latestData.quality.match(/(1080p\.(x265|10bit))|(2160p)/i) ||
                (Date.now() - new Date(movieData.insert_date).getTime()) < 2 * 60 * 60 * 1000 //2 hour
            )) {
            return;
        }
        if (movieData.type.includes('serial') &&
            updateReason === 'quality' &&
            !movieData.latestData.quality.match(/(1080p\.(x265|10bit))|(2160p)/i)) {
            return;
        }

        const newReleaseOrSeason = movieData.update_date === 0 || updateReason === 'season';
        const quality = movieData.latestData.quality.split(' - ')[0];
        let update = quality;
        let status = capitalize(movieData.status);
        if (movieData.type.includes('serial')) {
            let latestSeason = movieData.latestData.season;
            let latestEpisode = movieData.latestData.episode;
            update = `S${latestSeason}E${latestEpisode}: ${quality}`;

            if (movieData.latestData.torrentLinks) {
                let [_, torrentSeason, torrentEpisode] = movieData.latestData.torrentLinks.split(/[se]/gi).map(item => Number(item));
                if (latestSeason < torrentSeason || (latestSeason === torrentSeason && latestEpisode < torrentEpisode)) {
                    latestSeason = torrentSeason;
                    latestEpisode = torrentEpisode;
                    update = movieData.latestData.torrentLinks.toUpperCase() + " (Torrent)";
                }
            }
            update = update.replace(/[()\[\]]/g, res => '\\' + res);
            update = `[${update}](t.me/${config.botId}?start=download_${movieID}_${movieData.type}_${latestSeason}_${latestEpisode})`;

            // if (movieData.status === "running") {
            //     let latestSe = movieData.seasonEpisode.pop();
            //     if (latestSe) {
            //         if (latestSe && latestSeason === latestSe.seasonNumber && latestEpisode === latestSe.episodes) {
            //             status += " (waiting for new season)";
            //         } else {
            //             latestSe = movieData.seasonEpisode.pop();
            //             if (latestSe && latestSeason === latestSe.seasonNumber && latestEpisode === latestSe.episodes) {
            //                 status += " (waiting for new season)";
            //             }
            //         }
            //     }
            // }
        }

        let caption = '';
        if (!newReleaseOrSeason) {
            caption = `
🎬 ${movieData.rawTitle}\n
🔹 Type : ${capitalize(movieData.type)}\n
🎖 IMDB: ${movieData.rating.imdb} |Ⓜ️Meta: ${movieData.rating.metacritic} |🍅RT: ${movieData.rating.rottenTomatoes} | MAL: ${movieData.rating.myAnimeList}\n
🖥 Update: UPDATE\n
▶️ Status: ${status}\n\n`;
        } else {
            caption = `
🎬 ${movieData.rawTitle}\n
🔹 Type : ${capitalize(movieData.type)}\n
🎖 IMDB: ${movieData.rating.imdb} |Ⓜ️Meta: ${movieData.rating.metacritic} |🍅RT: ${movieData.rating.rottenTomatoes} | MAL: ${movieData.rating.myAnimeList}\n
🖥 Update: UPDATE\n
📅 Year : ${movieData.year}\n
▶️ Status: ${status}\n
⭕️ Genre : ${movieData.genres.slice(0, 6).map(g => capitalize(g)).join(', ')}\n
🎭 Actors : ACTORS_LINKS\n
📜 Summary : \n${(movieData.summary.persian || movieData.summary.english).slice(0, 150)}...\n\n`;
        }

        caption = caption.replace(/[()\[\]]/g, res => '\\' + res);
        caption = caption.replace("UPDATE", update);

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

        if (movieData.relatedTitles && movieData.relatedTitles.length > 0 && newReleaseOrSeason) {
            caption += `🔗 Related: \n${movieData.relatedTitles.slice(0, 10).map(item => {
                let title = `${item.rawTitle} \\(${item.year}\\) \\(${capitalize(item.relation)}\\)`;
                return `\t\t\t🎬 [${title}](t.me/${config.botId}?start=movieID_${item._id})`;
            }).join('\n')}\n\n`;
        }

        // if (newReleaseOrSeason) {
        //     caption += `📥 [Download](t.me/${config.botId}?start=download_${movieID}_${movieData.type})\n`;
        // } else {
        caption += `📥 [Info](t.me/${config.botId}?start=movieID_${movieID}_${movieData.type})`;
        caption += ` || [Download](t.me/${config.botId}?start=download_${movieID}_${movieData.type})\n`;
        // }
        if (movieData.type.includes('serial')) {
            caption += `⚡️ [Follow](t.me/${config.botId}?start=follow_serial_${movieID})\n`;
        }
        if (config.channel) {
            caption += `🆔 [Channel](t.me/${config.channel}) || `;
        }
        if (config.webUrl) {
            let movieTitle = movieData.title || movieData.rawTitle;
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
                await bot.telegram.sendPhoto('@' + config.channel, movieData.posters[i].url, {
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
            await bot.telegram.sendMessage('@' + config.channel, caption, {parse_mode: 'MarkdownV2',});
        }

        if ((movieData.update_date === 0 || updateReason === 'season') && movieData.trailers) {
            for (let i = 0; i < movieData.trailers.length; i++) {
                try {
                    await bot.telegram.sendVideo('@' + config.channel, movieData.trailers[i].url);
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
        }
    } catch (error) {
        if (error.message && error.message.includes('Too Many Requests')) {
            let sleepAmount = Number(error.message.match(/\d+$/g).pop());
            await sleep((sleepAmount + 1) && 1000);
            return await sendMovieDataToChannel(bot, movieData);
        }
        saveError(error);
    }
}

export async function sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

export function getAnimeWatchOnlineLink(gogoID, episodeNumber) {
    return [
        // `https://marinn.me/watch/${gogoID}-episode-${episodeNumber}`,
        `https://ryuk.to/watch/${gogoID}-episode-${episodeNumber}`,
        `https://anitaku.so/${gogoID}-episode-${episodeNumber}`,
    ]
}