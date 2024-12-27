# Base Image
FROM node:20-alpine

WORKDIR /usr/app
# install dependencies
COPY ./package.json ./
RUN yarn install
COPY ./ ./

# Default command
CMD ["npm","run", "dev"]