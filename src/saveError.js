import config from "./config.js";
import * as Sentry from "@sentry/node";

export async function saveError(error, dontPrint = false) {
    if (config.nodeEnv === 'production') {
        if (error.isAxiosError || error.isAxiosError2 || error.name === "AxiosError") {
            if (!error.url && error.config?.url) {
                error.url = error.config.url;
                error.url2 = error.config.url;
            }
            Sentry.withScope(function (scope) {
                scope.setExtra('axiosErrorData', error);
                scope.setTag("axiosError", "axiosError");
                Sentry.captureException(error);
            });
        } else {
            Sentry.captureException(error);
        }
        if (config.printErrors === 'true' && !dontPrint) {
            console.trace();
            console.log(error);
            console.log();
        }
    } else {
        console.trace();
        console.log(error);
        console.log();
    }
}
