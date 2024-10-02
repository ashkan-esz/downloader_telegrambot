import config from "../config.js";
import axios from "axios";
import {saveError} from "../saveError.js";
import {handleError} from "../api.js";
import {buildMemoryStorage, setupCache} from "axios-cache-interceptor";

const Torrent_API = setupCache(axios.create({
        baseURL: config.torrentApiUrl,
        // baseURL: 'http://localhost:3003',
    }), {
        storage: buildMemoryStorage(false, 2 * 60 * 1000, false),
    }
);

//------------------------------
//------------------------------

export async function downloadTorrentLink(accessToken, movieId, link, size) {
    try {
        let result = await Torrent_API.put(`v1/torrent/download/${movieId}?link=${link}&size=${size}`, null, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                isBotRequest: true,
            }
        });
        return result.data;
    } catch (error) {
        return error.response?.data || handleError(error, false);
    }
}

export async function getMyTorrentUsage(accessToken) {
    try {
        let result = await Torrent_API.get(`v1/torrent/my_usage`, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                isBotRequest: true,
            },
            cache: false,
        });
        return result.data;
    } catch (error) {
        return error.response?.data || handleError(error, false);
    }
}

export async function getMyDownloads(accessToken) {
    try {
        let result = await Torrent_API.get(`v1/torrent/my_downloads`, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                isBotRequest: true,
            },
            cache: false,
        });
        return result.data;
    } catch (error) {
        return error.response.data || handleError(error, false);
    }
}

export async function getQueueLinkState(link, filename) {
    try {
        let result = await Torrent_API.get(`v1/torrent/queue_link_state?link=${link}&filename=${filename}`, {
            headers: {
                isBotRequest: true,
            },
            cache: false,
        });
        return result.data;
    } catch (error) {
        return error.response?.data || handleError(error, false);
    }
}

export async function getTorrentLimits() {
    try {
        let result = await Torrent_API.get(`v1/torrent/limits`, {
            headers: {
                isBotRequest: true,
            },
            cache: {
                ttl: 5 * 60 * 1000, //5 min
            },
        });
        return result.data;
    } catch (error) {
        return error.response?.data || handleError(error, false);
    }
}