
import axios from "axios";
import { prisma } from "../utils/index"


const scheduleCreateGame = async () => {
    const isAnyOpenGame = await prisma.gamesRecord.findFirst({
        where: {
            status: "PENDING"
        }
    });

    if (isAnyOpenGame) {
        return setTimeout(() => {
            scheduleCreateGame();
        }, 1000 * 6);
    }

    let promises: any = []

    const latestgame = await prisma.gamesRecord.findFirst({
        orderBy: {
            created_at: 'desc'
        }
    });

    await prisma.gamesRecord.create({
        data: {
            status: "PENDING",
            gameId: Math.floor(Math.random() * 10000000000).toString(),
            gameNumber: Number(latestgame?.gameNumber) + 1 || 1
        }
    }).then((game) => {
        prisma.partners.findMany()
            .then((partners) => {
                partners.forEach((partner) => {
                    const { name, key, webhook } = partner;
                    if (!webhook) {
                        return;
                    }
                    promises.push(axios.post(webhook, { type: "start", data: game.gameId, gameNumber: game.gameNumber }, {
                        timeout: 1000 * 5
                    }));
                })
            });
    });

    if (promises.length > 0) {
        await Promise.allSettled(promises)
            .then((response) => {
                console.log(response);
            })
            .catch((error) => {
                console.log(error?.message, error?.response?.data);
            });
    }


    setTimeout(() => {
        scheduleCreateGame();
    }, 1000 * 2);
}

export default scheduleCreateGame;