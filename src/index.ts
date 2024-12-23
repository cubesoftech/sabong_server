import express, { Express, Request, Response } from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import partners from "./rest_api/partner";
import video from "./rest_api/video";
import axios from "axios";
import admin from "./rest_api/admin";
import { middleWareAuthorization, prisma } from "./utils";
import scheduleCreateGame from "./schedule";
import { GamesResultType } from "@prisma/client";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { spawn } from 'child_process';

dotenv.config();

const app: Express = express();
const server = http.createServer(app); // Create a http.Server instance
const port = process.env.PORT || 9001;

app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get('/stream2', (req, res) => {
  res.send(`
      <html>
          <body>
              <h1>Live Stream</h1>
              <video width="800" controls autoplay>
                  <source src="/
                  stream.m3u8" type="application/vnd.apple.mpegurl">
                  Your browser does not support the video tag.
              </video>
          </body>
      </html>
  `);
});

app.get('/stream', (req, res) => {
  // Set response headers for MP4 streaming
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Transfer-Encoding': 'chunked',
  });

  // Spawn FFmpeg process to capture and encode the screen
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'x11grab', // Use 'gdigrab' for Windows, 'x11grab' for Linux, 'avfoundation' for macOS
    '-i', ':1.0+0,0', // Input screen
    '-vf', 'scale=1280:720', // Resize to 720p
    '-vcodec', 'libx264', // Encode as H.264
    '-preset', 'ultrafast', // Minimize latency
    '-movflags', 'frag_keyframe+empty_moov', // Enable fragmented MP4 for streaming
    '-f', 'mp4', // Output format
    '-', // Stream to stdout
  ]);

  // Pipe FFmpeg's output to the HTTP response
  ffmpeg.stdout.pipe(res);

  // Log FFmpeg errors
  ffmpeg.stderr.on('data', (data) => {
    console.error(`FFmpeg error: ${data}`);
  });

  // Clean up on client disconnect
  req.on('close', () => {
    ffmpeg.kill('SIGINT');
  });
});


app.get("/live-video", async (req: Request, res: Response) => {
  const notallowedhtml = `<html><body><h1 style="color: red;">Not allowed to access this stream</h1></body></html>`;
  const referer = req.get("Referer");
  if (referer) {
    const cleanReferer = referer.replace("http://", "").replace("https://", "").split("/")[0];
    console.log("referer", cleanReferer);
    const isAllowed = await prisma.whiteListedDomain.findFirst({
      where: {
        domain: cleanReferer,
      },
    });
    console.log("isAllowed", isAllowed);
    if (!isAllowed) {
      return res.status(400).send(notallowedhtml);
    }
  }


  //get the index.html on root
  const indexHtmlPath = path.join(__dirname, "../index.html");
  fs.readFile(indexHtmlPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading index.html:", err);
      return res.status(500).send("Error reading index.html");
    }

    res.send(data);
  });
});

app.post("/webhook", async (req: Request, res: Response) => {
  const { data, type } = req.body as { data: string | { id: string, result: GamesResultType }, type: 'end' | 'start' };
  console.log(data, type);
  res.status(200).json(data);
});

app.get("/", (req: Request, res: Response) => {
  res.send(`executed successfully v4 `);
});

app.use("/admin", admin);

app.use(middleWareAuthorization);

app.use("/api/v1/", partners);


scheduleCreateGame();

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
