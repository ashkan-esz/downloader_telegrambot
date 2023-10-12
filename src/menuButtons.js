import {Markup} from "telegraf";
import {message} from "telegraf/filters";


export function getMenuButtons(){
    return Markup.keyboard([
        ['Search', 'button 2'], // Row1 with 2 buttons
        ['button 3', 'button 4'], // Row2 with 2 buttons
        ['button 5', 'button 6', 'button 7'] // Row3 with 3 buttons
    ])
        .persistent()
        .resize()
}

export function handleMenuButtons(bot){
    bot.hears('hi', (ctx) => ctx.reply('Hey there'));

    bot.on(message('text'), (ctx) => {
        // console.log(ctx);
        // console.log(ctx.message);
        return ctx.reply('Searching ' + ctx.message.text);
    });
}