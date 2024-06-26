import config from "./config.js";
import axios from "axios";
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor';
import {saveError} from "./saveError.js";

const API = setupCache(
    axios.create({
        baseURL: config.apiUrl,
        // baseURL: 'http://localhost:3000',
    }), {
        storage: buildMemoryStorage(false, 5 * 60 * 1000, false),
    }
);

export async function searchMovie(title, dataLevel, page) {
    try {
        let result = await API.get(
            `/movies/searchMovie/${dataLevel}/${page}?title=${title}&noUserStats=true`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        handleError(error);
        return 'error';
    }
}

export async function getMovieData(movieId, dataLevel = 'high', season = '') {
    try {
        let seasonFilter = season ? `&seasons=${season}` : '';
        let result = await API.get(
            `/movies/searchByID/${movieId}/${dataLevel}?noUserStats=true&embedRelatedTitles=true&embedStaffAndCharacter=true${seasonFilter}`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        handleError(error, false);
        return 'error';
    }
}

export async function getSortedMovies(sortBase, dataLevel, page) {
    try {
        //sortBase:: animeTopComingSoon |
        let types = 'serial-movie-anime_serial-anime_movie';
        let result = await API.get(
            `/movies/sortedMovies/${sortBase}/${types}/${dataLevel}/0-10/0-10/${page}?embedStaffAndCharacter=true&noUserStats=true`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        handleError(error);
        return 'error';
    }
}

export async function getNewsAndUpdates(apiName = 'news', dataLevel = 'info', page = 1) {
    try {
        //requestType: requestType | news | updates
        let types = 'serial-movie-anime_serial-anime_movie';
        let result = await API.get(
            `movies/${apiName}/${types}/${dataLevel}/0-10/0-10/${page}?embedStaffAndCharacter=true&noUserStats=true`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            }
        );
        return result.data.data;
    } catch (error) {
        handleError(error);
        return 'error';
    }
}

export async function getChannelNewsAndUpdates(requestType = 'newsAndUpdates', dataLevel = 'info') {
    try {
        //requestType: requestType | news | updates
        let types = 'serial-movie-anime_serial-anime_movie';
        let result = await API.get(
            `/movies/bots/${config.serverBotToken}/${requestType}/${types}/${dataLevel}/${config.minIMDBRate}-10/${config.minMALRate}-10?dontUpdateServerDate=false&embedStaffAndCharacter=true&noUserStats=true`, {
                cache: false,
            }
        );
        return result.data.data;
    } catch (error) {
        handleError(error);
        return 'error';
    }
}

export async function getApps() {
    try {
        let result = await API.get('utils/getApps', {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            }
        );
        return result.data.data;
    } catch (error) {
       return  handleError(error);
    }
}

function handleError(error, isResultArray = true) {
    if (error.response?.status === 404) {
        return isResultArray ? [] : null;
    }
    if (error.response?.status === 502 || error.response?.status === 522) {
        console.log(error.toString());
        saveError(error, true);
    } else {
        saveError(error);
    }
    return 'error';
}