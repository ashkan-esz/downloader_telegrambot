import config from "./config.js";
import axios from "axios";

//todo : handle cache

const API = axios.create({
    baseURL: config.apiUrl,
    // baseURL: 'http://localhost:3000',
});

export async function searchMovie(title, page) {
    try {
        let result = await API.get(`/movies/searchMovie/low/${page}?title=${title}&noUserStats=true`);
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