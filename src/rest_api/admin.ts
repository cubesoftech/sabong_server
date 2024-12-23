

//the route for this file is /admin

import express from 'express';
import { Request, Response } from 'express';
import { extractToken, keyGenerator, prisma } from '../utils';
import { GamesResultType } from '@prisma/client';
import axios from 'axios';

const router = express.Router();


router.post("/create_partner", async (req: Request, res: Response) => {
    try {
        const token = extractToken(req);
        const legitToken = process.env.APP_SECRET_KEY
        if (token !== legitToken) {
            return res.status(403).json({ message: 'You are not allowed to access this site' });
        }
        const { name, webhook } = req.body as { name: string, webhook: string | null }
        const key = keyGenerator();
        const allCurrency = await prisma.country.findMany({
            select: {
                id: true
            }
        })
        const data = await prisma.partners.create({
            data: {
                name: name,
                webhook,
                key,
                balances: {
                    createMany: {
                        data: allCurrency.map((currency) => {
                            return {
                                countryId: currency.id,
                                balance: 0
                            }
                        })
                    }
                }
            }
        });
        return res.status(200).json({ status: true, data });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(403).json({ message: 'Partner already exists' });
        }
        return res.status(403).json({ message: error.message });
    }
});

router.post("/end_game", async (req: Request, res: Response) => {
    try {
        const token = extractToken(req);
        const legitToken = process.env.APP_SECRET_KEY
        if (token !== legitToken) {
            return res.status(403).json({ message: 'You are not allowed to access this site' });
        }
        let { gameId, result } = req.body as { gameId: string, result: GamesResultType }
        //sometimes gameId is a number make sure it is a string
        gameId = gameId.toString();
        if (!["wala", "meron", "draw", "cancel"].includes(result)) {
            return res.status(403).json({ message: 'Invalid result' });
        }
        const game = await prisma.gamesRecord.findFirst({
            where: {
                gameId,
                status: "PENDING",
            }
        });
        if (!game) {
            return res.status(403).json({ message: 'Game not found' });
        }
        const { created_at } = game
        //game must be atleast 1 minute old
        if (new Date().getTime() - new Date(created_at).getTime() < 1000 * 60) {
            return res.status(403).json({ message: 'Game must be atleast 1 minute old before it can be ended' });
        }

        await prisma.gamesRecord.update({
            where: {
                id: game.id
            },
            data: {
                status: "COMPLETED",
                result: result
            }
        });

        let promises: any = []

        prisma.partners.findMany()
            .then((partners) => {
                partners.forEach((partner) => {
                    const { name, key, webhook } = partner;
                    if (!webhook) {
                        return;
                    }
                    promises.push(axios.post(webhook, { type: "end", data: { id: gameId, result: result, gameNumber: game.gameNumber } }, {
                        timeout: 1000 * 5
                    }));
                })
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

        return res.status(200).json({ status: true });
    } catch (error: any) {
        return res.status(403).json({ message: error.message });
    }
})


router.get('/history_game', async (req: Request, res: Response) => {
    try {
        const token = extractToken(req);
        const legitToken = process.env.APP_SECRET_KEY
        if (token !== legitToken) {
            return res.status(403).json({ message: 'You are not allowed to access this site' });
        }
        let { limit, page } = req.query as { page: string | undefined, limit: string | undefined }

        if (!limit) {
            limit = "10";
        }

        if (!page) {
            page = "1";
        }

        if (Number(limit) > 100) {
            return res.status(403).json({ message: 'Limit is too high' });
        }

        const games = await prisma.gamesRecord.findMany({
            select: {
                gameId: true,
                status: true,
                result: true,
                created_at: true,
                updated_at: true
            },
            orderBy: {
                created_at: 'desc'
            },
            take: Number(limit),
            skip: (Number(page) - 1) * Number(limit),
        });

        return res.status(200).json({ status: true, data: games });
    } catch (error: any) {
        return res.status(403).json({ message: error.message });
    }
});

export default router;