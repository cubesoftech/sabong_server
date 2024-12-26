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
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app: Express = express();
const server = http.createServer(app); // Create a http.Server instance
const port = process.env.PORT || 9001;

app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get('/restream', (req, res) => {


  // Set response headers for video streaming
  res.setHeader('Content-Type', 'video/mp4'); // Adjust the content type if needed (e.g., application/x-mpegURL for HLS)
  res.setHeader('Transfer-Encoding', 'chunked');

  const playback = "https://ac02.blodiab.com/sgmc/live.m3u8";
  const referer = "https://blodiab.com/"
  // Use FFmpeg to process and stream the video
  ffmpeg()
    .input(playback)
    .inputOptions([
      `-headers`, `Referer: ${referer}\r\n`
    ])
    .outputOptions([
      '-preset ultrafast',
      '-movflags frag_keyframe+empty_moov',
    ])
    .outputFormat('mp4')
    .pipe(res, { end: true });
});

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

// Endpoint to serve the stream
app.get('/stream3', (req, res) => {
  // URL to be streamed
  const url = 'https://ac05.blodiab.com/sgmc/live.m3u8';
  const referer = 'https://ac05.blodiab.com/';
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  // Spawn yt-dlp to fetch the stream and pass it to ffmpeg for processing
  const ytDlp = spawn('yt-dlp', [
    '-f', 'best',
    url,
    '--referer', referer,
    '--user-agent', userAgent,
    '--hls-prefer-ffmpeg', // Prefer ffmpeg for HLS
    '--output', '-',
  ]);

  // Spawn ffmpeg to handle the stream and send it to the response
  const ffmpeg = spawn('ffmpeg', [
    '-i', 'pipe:0', // Input from yt-dlp
    '-c:v', 'libx264', // Use the x264 codec for video
    '-c:a', 'aac', // Use AAC codec for audio
    '-preset', 'ultrafast', // Faster encoding
    '-f', 'mp4', // Output format
    '-movflags', 'frag_keyframe+empty_moov', // Enable fragmented MP4 for streaming
    '-bufsize', '500k', // Adjust the buffer size for better performance
    'pipe:1', // Output to stdout
  ]);

  // Pipe yt-dlp output to ffmpeg
  ytDlp.stdout.pipe(ffmpeg.stdin);

  // Set response headers to stream video
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Pipe ffmpeg output to the response
  ffmpeg.stdout.pipe(res);

  // Handle errors for yt-dlp and ffmpeg
  ytDlp.stderr.on('data', (data) => {
    console.error(`yt-dlp error: ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`ffmpeg error: ${data}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`ffmpeg process closed with code ${code}`);
  });

  ytDlp.on('close', (code) => {
    console.log(`yt-dlp process closed with code ${code}`);
  });
});


app.use("/admin", admin);

app.use(middleWareAuthorization);

app.use("/api/v1/", partners);


scheduleCreateGame();

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
