FROM node:18-slim
RUN apt-get update && apt-get install -y curl
WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
COPY appium-script.js ./

RUN yarn
CMD ["node", "appium-script.js"]
