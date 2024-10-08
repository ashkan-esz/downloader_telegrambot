import config from "../config.js";
import * as TORRENT_API from "../api/torrentApi.js";
import {saveError} from "../saveError.js";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import * as API from "../api.js";
import {getMenuButtons, moveToMainMenu} from "../menuButtons.js";
import {capitalize} from "../utils.js";

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

let linkMap = [{link: "link", id: 0}];
let idCounter = 0;
const _maxSize = 1000;


export function addLinkToMap(link) {
    let find = linkMap.find(l => l.link === link);
    if (find) {
        return find.id;
    }
    idCounter++
    linkMap.push({
        link: link,
        id: idCounter,
    });

    if (linkMap.length > _maxSize) {
        linkMap = linkMap.slice(linkMap.length - _maxSize)
    }

    return idCounter;
}

export function getLinkFromMap(id) {
    return linkMap.find(l => l.id === id)?.link;
}

//----------------------------------------------------------
//----------------------------------------------------------

export async function generateDirectLinkForTorrent(ctx, text) {
    if (!ctx.session.accessToken) {
        return await ctx.reply(`login to account first`);
    }

    let data = (ctx.update.callback_query?.data || text || '')
        .toLowerCase()
        .split('_').slice(2);// generate_direct_movieID_linkId

    if (data.length < 2) {
        return await ctx.reply(`Invalid MovieID`);
    }

    let movieId = data[0];
    let link = getLinkFromMap(Number(data[1]));
    if (!link) {
        return await ctx.reply(`Link not found, fetch links again`);
    }

    const {message_id} = await ctx.reply('⏳');

    let result = await TORRENT_API.downloadTorrentLink(ctx.session.accessToken, movieId, link);
    if (result.code !== 200) {
        return await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
            undefined, `Error: ${result.errorMessage}`);
    }

    let filename = "";
    if (result.data.message === 'already downloading') {
        filename = result.data?.downloadingFile?.name || "";
    }

    handleDownloadUpdate(ctx, message_id, link, filename).then();
}

async function handleDownloadUpdate(ctx, message_id, link, filename) {
    return new Promise(async (resolve, reject) => {
        try {
            let lastMessage = "";
            filename = filename || link.split('/').pop().replace(/\.torrent$/, '');
            let prevState = "";
            let prevDownloadedSize = 0;
            let counter = 0;

            while (true) {
                let findStatus = await TORRENT_API.getQueueLinkState(link, filename);
                if (findStatus.code !== 200) {
                    await ctx.reply(JSON.stringify(findStatus?.data, null, 4));
                    break;
                }

                let caption;
                if (!!findStatus.data.downloading?.[0]) {
                    prevState = "downloading";
                    let df = findStatus.data.downloading?.[0];
                    prevDownloadedSize = df.downloadedSize || 0;
                    caption = getCaptionForDownloadingFile(df);
                } else if (!!findStatus.data.queueItems?.[0]) {
                    prevState = "inQueue";
                    let qf = findStatus.data.queueItems?.[0];
                    qf.qIndex = findStatus.data.queueItemsIndex?.[0];
                    caption = getCaptionForQueueFile(qf);
                } else if (!!findStatus.data.localFiles?.[0]) {
                    caption = `TorrentLink: ${link}\n\n
DownloadLink: ${findStatus.data.localFiles?.[0].downloadLink}\n
Expires In: ${timeAgo.format(new Date(findStatus.data.localFiles?.[0].expireTime))}`;
                } else {
                    if (prevState || counter > 10) {
                        let message = prevDownloadedSize > 1024
                            ? `Download Ended for ${link}`
                            : `Looks like download failed, or file already exist for ${link}`;
                        await ctx.telegram.editMessageText(
                            (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                            undefined, message);
                        break;
                    } else {
                        caption = {
                            queueItems: findStatus?.data?.queueItems,
                            queueItemsIndex: findStatus?.data?.queueItemsIndex,
                            downloading: findStatus?.data?.downloading,
                            localFiles: findStatus?.data?.localFiles,
                        }
                        caption = JSON.stringify(caption, null, 4);
                    }
                }

                filename = findStatus.data.downloading?.[0]?.name || findStatus.data.queueItems?.[0]?.name || filename;
                counter++;
                if (lastMessage !== caption && caption) {
                    lastMessage = caption;
                    await ctx.telegram.editMessageText(
                        (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                        undefined, lastMessage);
                }
                await new Promise(resolve => setTimeout(resolve, 3 * 1000));
            }
            resolve();
        } catch (error) {
            saveError(error);
            reject(error);
        }
    })
}

//----------------------------------------------------------
//----------------------------------------------------------

function getCaptionForQueueFile(qf, compact = false) {
    if (compact) {
        return `
Name: ${qf.name || '??'}
State: ${qf.state || `Queue Index: ${qf.qIndex}`}
Torrent: ${qf.torrentLink}
Elapsed: ${timeAgo.format(new Date(qf.enqueueTime))}
TitleId: ${qf.titleId} -- Type: ${qf.titleType}
`
    }

    return `
Name: ${qf.name || '??'}\n
State: ${qf.state || `Queue Index: ${qf.qIndex}`}\n
Torrent: ${qf.torrentLink}\n
Elapsed: ${timeAgo.format(new Date(qf.enqueueTime))}\n
TitleId: ${qf.titleId} -- Type: ${qf.titleType}
`;
}

function getCaptionForDownloadingFile(df, compact = false) {
    let size = (df.size / (1024 * 1024)).toFixed(0);
    let download = (df.downloadedSize / (1024 * 1024)).toFixed(0);
    let percent = ((df.downloadedSize / df.size) * 100).toFixed(1);

    if (compact) {
        return `
Name: ${df.name}
State: ${df.state}
Torrent: ${df.torrentUrl}
Elapsed: ${timeAgo.format(new Date(df.startTime))}
Progress: ${download}MB / ${size}MB ---> ${percent}%
`;
    }

    return `
Name: ${df.name}\n
State: ${df.state}\n
Torrent: ${df.torrentUrl}\n
Elapsed: ${timeAgo.format(new Date(df.startTime))}\n
Progress: ${download}MB / ${size}MB ---> ${percent}%
`;
}

//----------------------------------------------------------
//----------------------------------------------------------

export async function sendTorrentDownloads(ctx) {
    try {
        if (!ctx.session.accessToken) {
            return await ctx.reply(`login to account first`);
        }

        let result = await TORRENT_API.getMyDownloads(ctx.session.accessToken);
        if (result.code !== 200) {
            return await ctx.reply(`Error: ${result.errorMessage}`);
        }

        let caption = '';
        if (result.data?.downloading?.length > 0) {
            for (let i = 0; i < result.data.downloading.length; i++) {
                let temp = getCaptionForDownloadingFile(result.data.downloading[i], true);
                caption += temp + "\n--------------------------\n";
            }
        }

        if (caption !== "") {
            await ctx.reply(caption);
            caption = '';
        }

        if (result.data?.queueItems?.length > 0) {
            for (let i = 0; i < result.data.queueItems.length; i++) {
                let qf = result.data.queueItems[i];
                qf.qIndex = result.data.queueItemsIndex?.[i];
                let temp = getCaptionForQueueFile(qf, true);
                caption += temp + "\n--------------------------\n";
            }
        }
        if (caption !== "") {
            await ctx.reply(caption);
        } else {
            await ctx.reply("No Active Download!");
        }
    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

export async function sendTorrentUsage(ctx) {
    try {
        if (!ctx.session.accessToken) {
            return await ctx.reply(`login to account first`);
        }

        let limitsResult = await TORRENT_API.getTorrentLimits();
        if (limitsResult.code !== 200) {
            return await ctx.reply(`Error: ${limitsResult.errorMessage}`);
        }

        let result = await TORRENT_API.getMyTorrentUsage(ctx.session.accessToken);
        if (result.code !== 200) {
            return await ctx.reply(`Error: ${result.errorMessage}`);
        }

        let caption = `
Torrent-Leach: ${result.data.torrentLeachGb.toFixed(1)}GB / ${result.data.leachLimit}GB        
Torrent-Search: ${result.data.torrentSearch} / ${result.data.searchLimit}
First-Use: ${timeAgo.format(new Date(result.data.firstUseAt))}\n        
File-Size-Limit: ${limitsResult.data.downloadFileSizeLimitMb}MB
File-Expire: ${limitsResult.data.torrentFilesExpireHour} Hour
Parallel-Limit: ${limitsResult.data.torrentUserEnqueueLimit}\n
Download-Service: ${limitsResult.data.torrentFilesServingDisabled ? '📛' : '✅'}
TorrentLeach-Service: ${limitsResult.data.torrentDownloadDisabled ? '📛' : '✅'}
`;

        await ctx.reply(caption);
    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

//----------------------------------------------------------
//----------------------------------------------------------

export async function handleTorrentSearch(ctx, text, addToDb = false) {
    if (!ctx.session) {
        ctx.session = {
            ...(ctx.session || {}),
            pageNumber: 1,
            sortBase: '',
        };
    }
    if (!ctx.session.accessToken) {
        return await ctx.reply(`login to account first`);
    }

    const name = (text || ctx.update.callback_query?.data || ctx.update?.message?.text || '')
        .replace(/^searchTorrent_/i, "").replace(/_/g, " ");

    const replyMessage = addToDb
        ? `Adding \"${name}\" to database`
        : `Searching \"${name}\" in torrent`;
    const {message_id} = await ctx.reply(replyMessage);
    let lastMessageId = message_id;

    let searchResult = await API.searchTorrentByName(ctx.session.accessToken, name, addToDb);
    if (!searchResult || searchResult === 'error') {
        return ctx.reply(`Server error on searching \"${name}\"`, getMenuButtons());
    }
    if (searchResult.length === 0 && !addToDb) {
        const replyMessage = `No result for \"${name}\"`;
        return ctx.reply(replyMessage, getMenuButtons());
    }

    if (!addToDb) {
        let caption = "------------ Search Result ------------\n";
        for (let i = 0; i < searchResult.length; i++) {
            caption += `
${i + 1}. Title: [${searchResult[i].title}](t.me/${config.botId}?start=searchTorrent_${searchResult[i].title.trim().replace(/\s+/g, '_')})
Sources: ${searchResult[i].sources.map(item => capitalize(item)).join(', ')}
Links Found: ${searchResult[i].links.length}\n\n`;
        }
        caption = caption.replace(/[!.*|{}#+>=_-]/g, res => '\\' + res);

        await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, lastMessageId,
            undefined, caption,
            {
                parse_mode: "MarkdownV2",
                link_preview_options: {
                    is_disabled: true,
                }
            });
    } else {
        // let caption = `Added to database: \n ${JSON.stringify(searchResult, null, 8)}`;
        let caption = `\"${name}\" Added to database`;
        await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, lastMessageId,
            undefined, caption,
            {
                link_preview_options: {
                    is_disabled: true,
                }
            });
    }

    await moveToMainMenu(ctx);
}
