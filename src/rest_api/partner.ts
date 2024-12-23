
import express from 'express';
import { Request, Response } from 'express';
import { getPartnerFromToken, prisma } from '../utils';

const router = express.Router();

router.get("/balance", async (req: Request, res: Response) => {
    try {
        const partner = await getPartnerFromToken(req);
        const balances = await prisma.partnerBalance.findMany({
            where: {
                partnersId: partner.id
            },
            select: {
                balance: true,
                country: {
                    select: {
                        currency_symbol: true,
                        name: true
                    }
                }
            }
        });
        return res.status(200).json({ status: true, data: balances });
    } catch (error: any) {
        return res.status(403).json({ status: false, message: error?.message });
    }
});

router.get("/credits_log", async (req: Request, res: Response) => {
    try {
        const partner = await getPartnerFromToken(req);

        const { page, limit } = req.query;

        const logs = await prisma.partnerBalanceLog.findMany({
            where: {
                partnersId: partner.id
            },
            select: {
                amount: true,
                country: {
                    select: {
                        currency_symbol: true,
                    }
                },
                created_at: true,
                type: true
            },
            orderBy: {
                created_at: 'desc'
            },
            take: Number(limit),
            skip: (Number(page) - 1) * Number(limit),
        });

        return res.status(200).json({ status: true, data: logs });

    } catch (error: any) {
        return res.status(403).json({ status: false, message: error?.message });
    }
})

router.post("/balance", async (req: Request, res: Response) => {
    try {
        const partner = await getPartnerFromToken(req);
        const { amount, currency_symbol, type } = req.body;
        const typesArray = ['ADD', 'SUBTRACT'];
        if (!typesArray.includes(type)) {
            return res.status(403).json({ status: false, message: "type must be ADD or SUBTRACT" });
        }
        // if amount is less than 0 then return error
        if (amount < 0) {
            return res.status(403).json({ status: false, message: "Amount must be greater than 0" });
        }

        const balance = await prisma.partnerBalance.findFirst({
            where: {
                partnersId: partner.id,
                country: {
                    currency_symbol: currency_symbol
                }
            }
        });

        if (!balance) {
            return res.status(403).json({ status: false, message: "Country not found" });
        }
        let newBalance = balance.balance;

        if (type === 'SUBTRACT') {
            newBalance = balance.balance - amount;
        }

        if (type === 'ADD') {
            newBalance = balance.balance + amount;
        }

        await prisma.partnerBalance.update({
            where: {
                id: balance.id
            },
            data: {
                balance: newBalance
            }
        });

        await prisma.partnerBalanceLog.create({
            data: {
                amount,
                partnersId: partner.id,
                countryId: balance.countryId,
                type: type
            }
        });

        return res.status(200).json({ status: true, data: { balance: newBalance, symbol: currency_symbol } });
    } catch (error: any) {
        return res.status(403).json({ status: false, message: error?.message });
    }
})

router.get('/game', async (req: Request, res: Response) => {
    try {
        const game = await prisma.gamesRecord.findFirst({
            where: {
                status: "PENDING",
            },
            select: {
                gameId: true
            }
        });
        return res.status(200).json({ status: true, data: game });
    } catch (error: any) {
        return res.status(403).json({ status: false, message: error?.message });
    }
})

router.get('/history_game', async (req: Request, res: Response) => {
    try {
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
                updated_at: true,
                gameNumber: true,
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