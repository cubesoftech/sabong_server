
import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
    //if the console logs open close the browser and open it again
    //get first the referer
    const referer = req.get("Referer");
    console.log("referer", referer);
    const path = "https://mmm777.live/cube/swc.html";

    const iframe = `<iframe src="${path}" width="600px" height="400px" frameborder="0" scrolling="no" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>`;

    try {
        res.send(iframe);
    } catch (error) {
        console.error("Error fetching video stream:", error);
        res.status(500).send("Error fetching video stream");
    }
});



export default router;