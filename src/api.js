import config from "./config.js";
import axios from "axios";
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor';
import {saveError} from "./saveError.js";

const API = setupCache(
    axios.create({
        baseURL: config.apiUrl,
        // baseURL: 'http://localhost:3000',
    }), {
        storage: buildMemoryStorage(false, 3 * 60 * 1000, false),
    }
);

// ------------------------------------------------------
// ------------------------------------------------------

export async function loginToUserAccount(data) {
    try {
        let result = await API.post(`/bots/login`, data);
        return result.data;
    } catch (error) {
        return error.response.data || handleError(error, false);
    }
}

export async function changeAccountNotificationFlag(notificationEnable, accessToken) {
    try {
        let result = await API.put(`/bots/${config.serverBotToken}/notification/${notificationEnable}`, null, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                isBotRequest: true,
            }
        });
        return result.data;
    } catch (error) {
        return error.response.data || handleError(error, false);
    }
}

// ------------------------------------------------------
// ------------------------------------------------------

export async function followSerial(movieId, remove, accessToken) {
    try {
        let result = await API.put(`/movies/addUserStats/follow_movie/${movieId}?remove=${remove}`, null, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                isBotRequest: true,
            }
        });
        return result.data;
    } catch (error) {
        return error.response.data || handleError(error, false);
    }
}

export async function getFollowingSerials(dataLevel, page, accessToken) {
    try {
        let result = await API.get(`/movies/userStatsList/follow_movie/${dataLevel}/${page}`, {
            params: {
                embedStaffAndCharacter: true,
            },
            headers: {
                authorization: `Bearer ${accessToken}`,
                isBotRequest: true,
            },
            cache: false,
        });
        return result.data.data;
    } catch (error) {
        return handleError(error, true);
    }
}

// ------------------------------------------------------
// ------------------------------------------------------

export async function searchCast(type, name, dataLevel = "low", page = 1) {
    try {
        let searchType = type === "staff" ? "searchStaff" : "searchCharacter";
        let result = await API.get(
            `/movies/${searchType}/${dataLevel}/${page}`, {
                params: {
                    name: name,
                    noUserStats: true,
                },
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        return handleError(error, true);
    }
}

export async function searchCastById(type, id) {
    try {
        let result = await API.get(
            `/movies/${type}/searchById/${id}?noUserStats=true`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        return handleError(error, false);
    }
}

export async function getCastCredits(type, id, page) {
    try {
        let result = await API.get(
            `/movies/${type}/credits/${id}/${page}?noUserStats=true`, {
                cache: {
                    ttl: 5 * 60 * 1000 //5 minute
                }
            });
        return result.data.data;
    } catch (error) {
        return handleError(error, false);
    }
}

// ------------------------------------------------------
// ------------------------------------------------------

export async function searchMovie(title, dataLevel, page) {
    try {
        let result = await API.get(
            `/movies/searchMovie/${dataLevel}/${page}?title=${title}&noUserStats=true`, {
                cache: {
                    ttl: 2 * 60 * 1000 //2 minute
                }
            });
        return result.data.data;
    } catch (error) {
        return handleError(error, true);
    }
}

export async function getMovieData(movieId, dataLevel = 'high', season = '') {
    try {
        let seasonFilter = season ? `&seasons=${season}` : '';
        let result = await API.get(
            `/movies/searchByID/${movieId}/${dataLevel}?noUserStats=true&embedRelatedTitles=true&embedStaffAndCharacter=true${seasonFilter}`, {
                cache: {
                    ttl: season !== ''
                        ? 1 * 60 * 1000 //1 minute
                        : 3 * 60 * 1000 //3 minute
                }
            });
        return result.data.data;
    } catch (error) {
        return handleError(error, false);
    }
}

export async function getSortedMovies(sortBase, dataLevel, page) {
    try {
        //sortBase:: animeTopComingSoon |
        let types = 'serial-movie-anime_serial-anime_movie';
        let result = await API.get(
            `/movies/sortedMovies/${sortBase}/${types}/${dataLevel}/0-10/0-10/${page}?embedStaffAndCharacter=true&noUserStats=true`, {
                cache: {
                    ttl: 2 * 60 * 1000 //2 minute
                }
            });
        return result.data.data;
    } catch (error) {
        return handleError(error, true);
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
        return handleError(error, true);
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
        return handleError(error, true);
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
        return handleError(error, true);
    }
}

export function handleError(error, isResultArray = true) {
    if (error.response?.status === 404) {
        return isResultArray ? [] : null;
    }
    if (error.response?.status !== 521) {
        if (error.response?.status === 502 || error.response?.status === 522) {
            console.log(error.toString());
            saveError(error, true);
        } else {
            saveError(error);
        }
    }
    return 'error';
}