import express, { Express, Request, Response } from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
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

app.get('/stream4', (req: Request, res: Response) => {
  // URL to be streamed
  const url = 'https://ac05.blodiab.com/sgmc/live.m3u8';
  const referer = 'https://ac05.blodiab.com/';
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  // Spawn ffmpeg to handle the stream and send it to the response
  const ffmpeg = spawn('ffmpeg', [
    '-headers', `Referer: ${referer}\r\nUser-Agent: ${userAgent}\r\n`,
    '-i', url, // Input URL
    '-c:v', 'libx264', // Use the x264 codec for video
    '-c:a', 'aac', // Use AAC codec for audio
    '-preset', 'ultrafast', // Faster encoding
    '-tune', 'zerolatency', // Tune for zerolatency
    '-f', 'mp4', // Output format
    '-movflags', 'frag_keyframe+empty_moov', // Enable fragmented MP4 for streaming
    '-bufsize', '5k', // Adjust the buffer size for better performance
    'pipe:1', // Output to stdout
  ]);

  // Set response headers to stream video
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Pipe ffmpeg output to the response
  ffmpeg.stdout.pipe(res);

  // Handle errors for ffmpeg
  ffmpeg.stderr.on('data', (data) => {
    console.error(`ffmpeg error: ${data}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`ffmpeg process closed with code ${code}`);
  });

  // Clean up on client disconnect
  req.on('close', () => {
    ffmpeg.kill('SIGINT');
  });
});

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
