# stage 1
FROM node:18.16.0-alpine AS build

ENV NODE_ENV=production

WORKDIR /usr/app

COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# stage 2
FROM alpine
RUN apk add --no-cache --update nodejs npm
COPY --from=build /usr/app /

ENV NODE_ENV=production

CMD [ "node", "src/bot.js"]