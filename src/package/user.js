import config from "../config.js";
import * as API from "../api.js";
import * as CHAT_API from "../api/chatApi.js";
import {saveError} from "../saveError.js";


export async function loginToAccount(ctx) {
    try {
        if (ctx.session.accessToken) {
            await ctx.reply(`NOTE: currently login as << ${ctx.session.username} >>\ncontinue if you want to login again`);
        }
        await ctx.reply("Send username and password in below format");
        await ctx.reply("username: user \npassword: password");
    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

export async function createUserAccount(ctx) {
    try {
        // if (ctx.session.accessToken) {
        //     await ctx.reply(`NOTE: currently login as << ${ctx.session.username} >>\nLogOut before creating account`);
        // }
        await ctx.reply("Send username and password in below format");
        await ctx.reply("username: user \npassword: password \nemail: test-mail@gmail.com");
    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}

export async function handleUserAccountLogin(ctx) {
    try {
        let temp = ctx.message.text.split(/(username\s?:)|(password\s?:)/gi).filter(Boolean).map(item => item.trim());
        let user = temp[1] || '';
        let pass = temp[3] || '';
        if (!user || !pass) {
            return await ctx.reply("Invalid username, password format");
        }

        let errors = [];
        if (user.length < 6) {
            errors.push("Username Length Must Be More Than 6");
        } else if (user.length > 50) {
            errors.push("Username Length Must Be Less Than 50");
        }
        if (!user.match(/^[a-z|\d_-]+$/i)) {
            errors.push("Only a-z, 0-9, and underscores are allowed for username");
        }

        if (pass.length < 8) {
            errors.push("Password Length Must Be More Than 8");
        } else if (pass.length > 50) {
            errors.push("Password Length Must Be Less Than 50");
        }
        if (user === pass) {
            errors.push("Username and Password cannot be equal");
        }
        if (errors.length > 0) {
            return await ctx.reply(errors.join('\n'));
        }

        let result = await API.loginToUserAccount({
            username_email: user,
            password: pass,
            botId: config.serverBotToken,
            chatId: ctx.update.message.chat.id.toString(),
            botUsername: ctx.update.message.chat.username,
        });
        if (result.code !== 200) {
            return await ctx.reply(`Error: ${result.errorMessage}`);
        }
        if (!ctx.session) {
            ctx.session = {
                ...(ctx.session || {}),
                pageNumber: 1,
                sortBase: '',
                accessToken: result.accessToken,
                username: result.username,
                notification: result.notification,
            }
        } else {
            ctx.session.accessToken = result.accessToken;
            ctx.session.username = result.username;
            ctx.session.notification = result.notification;
        }
        await ctx.reply(`Successfully login as << ${result.username} >>`);

    } catch (error) {
        saveError(error);
    }
}

export async function handleUserSignup(ctx) {
    try {
        let temp = ctx.message.text.split(/(username\s?:)|(password\s?:)|(email\s?:)/gi).filter(Boolean).map(item => item.trim());
        let user = temp[1] || '';
        let pass = temp[3] || '';
        let email = temp[5] || '';
        if (!user || !pass || !email) {
            return await ctx.reply("Invalid username, password, email format");
        }

        let errors = [];
        if (user.length < 6) {
            errors.push("Username Length Must Be More Than 6");
        } else if (user.length > 50) {
            errors.push("Username Length Must Be Less Than 50");
        }
        if (!user.match(/^[a-z|\d_-]+$/i)) {
            errors.push("Only a-z, 0-9, and underscores are allowed for username");
        }

        if (pass.length < 8) {
            errors.push("Password Length Must Be More Than 8");
        } else if (pass.length > 50) {
            errors.push("Password Length Must Be Less Than 50");
        }
        if (user === pass) {
            errors.push("Username and Password cannot be equal");
        }
        if (errors.length > 0) {
            return await ctx.reply(errors.join('\n'));
        }

        let result = await CHAT_API.createAccount({
            username: user,
            password: pass,
            email: email,
            confirmPassword: pass,
            deviceInfo: {
                "appName": config.botId,
                "appVersion": "1.0.0",
                "os": "UnKnown",
                "deviceModel": "Unknown"
            },
            // botId: config.serverBotToken,
            // chatId: ctx.update.message.chat.id.toString(),
            // botUsername: ctx.update.message.chat.username,
        });
        if (result.code !== 200 && result.code !== 201) {
            return await ctx.reply(`Error: ${result.errorMessage}`);
        }
        await ctx.reply(`Successfully Created account as << ${result.data.username} >>\nTrying to login to account`);

        //try to logIn by api.login
        let loginResult = await API.loginToUserAccount({
            username_email: user,
            password: pass,
            botId: config.serverBotToken,
            chatId: ctx.update.message.chat.id.toString(),
            botUsername: ctx.update.message.chat.username,
        });
        if (loginResult.code !== 200) {
            return await ctx.reply(`Error: ${loginResult.errorMessage}`);
        }
        if (!ctx.session) {
            ctx.session = {
                ...(ctx.session || {}),
                pageNumber: 1,
                sortBase: '',
                accessToken: loginResult.accessToken,
                username: loginResult.username,
                notification: loginResult.notification,
            }
        } else {
            ctx.session.accessToken = loginResult.accessToken;
            ctx.session.username = loginResult.username;
            ctx.session.notification = loginResult.notification;
        }
        await ctx.reply(`Successfully login as << ${loginResult.username} >>`);
    } catch (error) {
        saveError(error);
    }
}

export async function toggleAccountNotification(ctx) {
    try {
        if (!ctx.session.accessToken) {
            return await ctx.reply(`login to account first`);
        }

        let result = await API.changeAccountNotificationFlag(!ctx.session.notification, ctx.session.accessToken);
        if (result.code !== 200) {
            return await ctx.reply(`Error: ${result.errorMessage}`);
        }
        ctx.session.notification = result.notification;
        await ctx.reply(`Account notification is now ${result.notification ? 'enabled' : 'disabled'}`);
    } catch (error) {
        saveError(error);
        await ctx.reply(`Error: ${error.toString()}`);
    }
}