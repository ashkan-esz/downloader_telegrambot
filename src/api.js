import config from "./config.js";
import axios from "axios";
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor';

const API = setupCache(
    axios.create({
        baseURL: config.apiUrl,
        // baseURL: 'http://localhost:3000',
    }), {
        storage: buildMemoryStorage(false, 5 * 60 * 1000, false),
    }
);

export async function searchMovie(title, page) {
    try {
        let result = await API.get(
            `/movies/searchMovie/low/${page}?title=${title}&noUserStats=true`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        // saveError(error);
        // console.log(error.response);
        if (error.response?.status === 404) {
            return [];
        }
        return 'error';
    }
}

export async function getMovieData(movieId, dataLevel = 'high') {
    try {
        let result = await API.get(
            `/movies/searchByID/${movieId}/${dataLevel}?noUserStats=true&embedRelatedTitles=true&embedStaffAndCharacter=true`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        // saveError(error);
        // console.log(error.response);
        if (error.response?.status === 404) {
            return null;
        }
        return 'error';
    }
}