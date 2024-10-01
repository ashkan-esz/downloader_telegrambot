import config from "../config.js";
import axios from "axios";
import {saveError} from "../saveError.js";
import {handleError} from "../api.js";

const CHAT_API = axios.create({
    baseURL: config.chatApiUrl,
    // baseURL: 'http://localhost:3002',
});

//------------------------------
//------------------------------

export async function createAccount(data) {
    try {
        let result = await CHAT_API.post(`v1/user/signup`, data);
        return result.data;
    } catch (error) {
        return error.response?.data || handleError(error, false);
    }
}
