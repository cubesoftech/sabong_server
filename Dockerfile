# Base Image
FROM node:20-alpine

WORKDIR /usr/app
# install dependencies
COPY ./package.json ./
RUN yarn install
RUN npx prisma generate
COPY ./ ./

# Default command
CMD ["npm","run", "dev"]