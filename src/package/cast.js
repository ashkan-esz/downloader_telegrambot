import config from "../config.js";
import {Markup} from "telegraf";
import * as API from "../api.js";
import {capitalize} from "../utils.js";
import {saveError} from "../saveError.js";
import {getMenuButtons, homeBtn} from "../menuButtons.js";

export async function handleStaffAndCharacterSearch(ctx, type) {
    if (!ctx.session) {
        ctx.session = {
            ...(ctx.session || {}),
            pageNumber: 1,
            sortBase: '',
        };
    }

    let name = ctx.update?.message?.text;

    const replyMessage = `Searching \"${name}\"`;
    const {message_id} = await ctx.reply(replyMessage);
    let lastMessageId = message_id;

    let searchResult = await API.searchCast(type, name, 'high', 1);
    if (searchResult === 'error') {
        return ctx.reply(`Server error on searching \"${name}\"`, getMenuButtons());
    }
    if (searchResult.length === 0) {
        const replyMessage = `No result for \"${name}\"`;
        return ctx.reply(replyMessage, getMenuButtons());
    }

    let buttons = searchResult.map(item => (
        [Markup.button.callback(
            `${item.rawName || capitalize(item.name)} | ${item.gender}`,
            'castInfo_' + type + '_' + (item._id || item.id)
        )]
    ));

    if (lastMessageId) {
        await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, lastMessageId,
            undefined, `Choose one of the options:`,
            {
                reply_markup: {
                    inline_keyboard: [...buttons, homeBtn],
                }
            });
        ctx.session.lastMessageId = lastMessageId;
    } else {
        let {message_id} = await ctx.reply(`Choose one of the options:`,
            Markup.inlineKeyboard([...buttons, homeBtn]).resize());
        ctx.session.lastMessageId = message_id;
    }
}

export async function handleCastOptions(ctx, text = '') {
    try {
        let temp = (ctx.update.callback_query?.data || text || '').split("_");
        let movieId = temp.pop();
        if (!movieId) {
            return await ctx.reply(`Invalid MovieID`, getMenuButtons());
        }

        const {message_id} = await ctx.reply('⏳');

        let result = await API.getMovieData(movieId, 'info');
        if (result === 'error') {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, 'Server Error on fetching Movie data');
        } else if (!result) {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, 'Movie data not found!');
        }

        let title = `: ${result.rawTitle} | ${result.year}`;

        let buttons = [
            Markup.button.callback(
                '🎭 Actors And Characters',
                'cast_actors_' + movieId,
            ),
            Markup.button.callback(
                `⚡ Directors`,
                'cast_directors_' + movieId,
            ),
            Markup.button.callback(
                `⚡ Writers`,
                'cast_writers_' + movieId,
            ),
            Markup.button.callback(
                `⚡ Others`,
                'cast_others_' + movieId,
            ),
        ];

        return await ctx.telegram.editMessageText(
            (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
            undefined, `Cast options for ${title}`,
            Markup.inlineKeyboard(buttons, {columns: 2}), {columns: 2});

    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

export async function sendCastList(ctx, text = '') {
    try {
        const temp = (ctx.update.callback_query?.data || text || '').split("_");
        const movieId = temp.pop();
        const type = temp.pop();
        if (!movieId) {
            return await ctx.reply(`Invalid MovieID`);
        }

        const {message_id} = await ctx.reply('⏳');

        let result = await API.getMovieData(movieId, 'info');
        if (result === 'error') {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, 'Server Error on fetching Movie data');
        } else if (!result) {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, 'Movie data not found!');
        }

        let title = `< ${result.rawTitle} | ${result.year} >`;
        let header = `${capitalize(type)} of ${title}\n`;
        let caption = header;
        let resultArray = type === "actors"
            ? result.actorsAndCharacters
            : result.staff[type] || [];

        for (let i = 0; i < resultArray.length; i++) {
            let position = resultArray[i].actorPositions.join(', ');
            let characterRole = resultArray[i].characterRole;
            let staff = resultArray[i].staff;
            let character = resultArray[i].character;

            caption += `
${i + 1}. 
Cast: [${capitalize(staff?.name || '') || '-'}](t.me/${config.botId}?start=castID_staff_${staff?.id})${(position && position !== 'Actor') ? `\nRole: _${position}_` : ''}
${character ? `Character: [${capitalize(character.name) || '-'}](t.me/${config.botId}?start=castID_character_${character?.id})` : 'Character: -'}
${(character || characterRole || type === 'actors') ? `Character Role: _${characterRole || '-'}_` : ''}
`.replace(/\n\n/, '\n').trim();

            caption += '—————————————————————————';
        }

        if (caption === header) {
            caption += "Nothing found!";
        }

        caption = caption.replace(/[!.*|{}#+>=-]/g, res => '\\' + res).trim();
        await ctx.deleteMessage(message_id);
        return await ctx.telegram.sendMessage(
            (ctx.update.callback_query || ctx.update).message.chat.id,
            caption, {parse_mode: 'MarkdownV2',});
    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

export async function sendCastCredits(ctx, text = '') {
    try {
        const temp = (text || ctx.update.callback_query?.data || '').split("_");
        const castId = temp.pop();
        const type = temp.pop();
        if (!castId) {
            return await ctx.reply(`Invalid castID`);
        }

        const {message_id} = await ctx.reply('⏳');

        let credits = [];
        for (let i = 1; i <= 2; i++) {
            let result = await API.getCastCredits(type, castId, i);
            if (result === 'error') {
                // return await ctx.telegram.editMessageText(
                //     (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                //     undefined, 'Server Error on fetching Movie data');
                break;
            } else if (!result || result.length === 0) {
                break;
            }
            credits = [...credits, ...result];
            if (result.length % 12 !== 0) {
                break;
            }
        }

        if (credits.length === 0) {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, 'Movie data not found!');
        }

        let header = `Credits:\n`;
        let caption = header;

        for (let i = 0; i < credits.length; i++) {
            let position = credits[i].actorPositions.join(', ');
            let characterRole = credits[i].characterRole;
            let staff = credits[i].staff;
            let character = credits[i].character;
            let movie = credits[i].movie;

            caption += `
${i + 1}. 
${(position && position !== 'Actor') ? `\nRole: _${position}_` : ''}
${staff ? `Staff: [${capitalize(staff.name) || '-'}](t.me/${config.botId}?start=castID_staff_${staff?.id})` : 'Staff: -'}
${character ? `Character: [${capitalize(character.name) || '-'}](t.me/${config.botId}?start=castID_character_${character?.id})` : 'Character: -'}
${(character || characterRole || type === 'actors') ? `Character Role: _${characterRole || '-'}_` : ''}
Movie: [${movie?.rawTitle} | ${capitalize(movie?.type || '')}](t.me/${config.botId}?start=movieID_${movie?._id || movie?.movieId})
`.replace(/\n\n/g, '\n').trim();

            caption += '—————————————————————————';
        }

        if (caption === header) {
            caption += "Nothing found!";
        }

        caption = caption.replace(/[!.*|{}#+>=-]/g, res => '\\' + res).trim();
        await ctx.deleteMessage(message_id);
        return await ctx.telegram.sendMessage(
            (ctx.update.callback_query || ctx.update).message.chat.id,
            caption, {parse_mode: 'MarkdownV2',});
    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

export async function sendCastInfo(ctx, text = '') {
    try {
        const temp = (ctx.update.callback_query?.data || text || '').split("_");
        const castId = temp.pop();
        const type = temp.pop();
        if (!castId) {
            return await ctx.reply(`Invalid castID`);
        }

        const {message_id} = await ctx.reply('⏳');

        let castData = await API.searchCastById(type, castId);
        if (castData === 'error') {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, 'Server Error on fetching data');
        } else if (!castData) {
            return await ctx.telegram.editMessageText(
                (ctx.update.callback_query || ctx.update).message.chat.id, message_id,
                undefined, 'data not found!');
        }

        let caption = `
🎬 ${castData.rawName}
⭕️ Gender : ${castData.gender || '-'}\n
📅 Age : ${castData.age || '-'}\n
🎂 Birthday : ${castData.birthday || '-'}\n
☠️ Deathday : ${castData.deathday || '-'}\n
🇺🇳 Country: ${castData.country || '-'}\n
👁 Eye Color: ${castData.eyeColor || '-'}\n
▶️ Hair Color: ${castData.hairColor || '-'}\n
▶️ Height: ${castData.height || '-'}\n
▶️ Weight: ${castData.weight || '-'}\n
📜 About : ${castData.about || '-'}\n\n`;

        caption = caption.replace(/[()\[\]]/g, res => '\\' + res);
        caption = caption.replace(/[!.*|{}#+>=-]/g, res => '\\' + res).trim();

        let replied = false;
        if (castData.imageData?.url || castData.imageData?.originalUrl) {
            try {
                await ctx.replyWithPhoto(castData.imageData.url, {
                    caption: caption,
                    parse_mode: 'MarkdownV2',
                });
                replied = true;
            } catch (error) {
                if (castData.imageData?.originalUrl) {
                    await ctx.replyWithPhoto(castData.imageData.originalUrl, {
                        caption: caption,
                        parse_mode: 'MarkdownV2',
                    });
                    replied = true;
                }
            }
        }

        if (!replied) {
            await ctx.deleteMessage(message_id);
            await ctx.telegram.sendMessage(
                (ctx.update.callback_query || ctx.update).message.chat.id,
                caption, {parse_mode: 'MarkdownV2',});
        }

        await sendCastCredits(ctx, `castID_${type}_${castData.id}`);

    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}
