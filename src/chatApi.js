import config from "./config.js";
import axios from "axios";
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor';
import {saveError} from "./saveError.js";

const CHAT_API = setupCache(
    axios.create({
        baseURL: config.chatApiUrl,
        // baseURL: 'http://localhost:3002',
    }), {
        // storage: buildMemoryStorage(false, 5 * 60 * 1000, false),
    }
);
