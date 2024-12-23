import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export const middleWareAuthorization = async (req: any, res: any, next: any) => {
    try {
        if (!req.headers.authorization) {
            return res.status(403).json({ message: 'You are not allowed to access this site' });
        }
        const partner = await getPartnerFromToken(req);
        next();
    } catch (error: any) {
        return res.status(403).json({ message: error.message });
    }
}
export const extractToken = (req: any) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    const bearer = authHeader?.split(" ")[0];
    if (bearer !== "Bearer") {
        throw new Error("Invalid token");
    }
    if (!token) {
        throw new Error("Secret not found");
    }
    return token;
}

export const getPartnerFromToken = async (req: any) => {
    const token = extractToken(req);
    const partner = await prisma.partners.findUniqueOrThrow({
        where: {
            key: token
        }
    });
    return partner;
}

export const keyGenerator = () => {
    // I want the key to be 20 characters long
    const key = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return key;
}