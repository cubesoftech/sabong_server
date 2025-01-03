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

// Function to handle streaming and restreaming
const streamAndRestream = (inputUrl: string, referer: string, userAgent: string, outputUrl: string) => {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-headers', `Referer: ${referer}\r\nUser-Agent: ${userAgent}\r\n`,
      '-i', inputUrl, // Input URL
      '-c:v', 'libx264', // Use the x264 codec for video
      '-c:a', 'aac', // Use AAC codec for audio
      '-preset', 'ultrafast', // Faster encoding
      '-tune', 'zerolatency', // Tune for zerolatency
      '-g', '50', // Keyframe interval (adjust based on your frame rate)
      '-crf', '23', // Constant Rate Factor for quality control
      '-maxrate', '1000k', // Maximum bitrate
      '-bufsize', '1000k', // Buffer size
      '-f', 'flv', // Output format for streaming platforms
      outputUrl, // Output URL for the streaming platform
    ]);

    ffmpeg.stderr.on('data', (data) => {
      console.error(`ffmpeg error: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      console.log(`ffmpeg process closed with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });
  });
};

const runTask = async () => {
  const inputUrl = 'https://ac05.blodiab.com/sgmc/live.m3u8';
  const referer = 'https://ac05.blodiab.com/';
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const outputUrl = 'rtmp://128.199.144.123:1935/live/1234'; // Replace with your RTMP server URL

  try {
    await streamAndRestream(inputUrl, referer, userAgent, outputUrl);
  } catch (error) {
    //run the task again if it fails but sleep for 5 seconds
    console.error(`Error: ${error}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    runTask();
  }
}

const runTask2 = async () => {
  const inputUrl = 'https://ac05.blodiab.com/sgmc/live.m3u8';
  const referer = 'https://ac05.blodiab.com/';
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const outputUrl = 'rtmp://64.227.109.141:1935/live/1234'; // Replace with your RTMP server URL

  try {
    await streamAndRestream(inputUrl, referer, userAgent, outputUrl);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    runTask2();
  } catch (error) {
    //run the task again if it fails but sleep for 5 seconds
    console.error(`Error: ${error}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    runTask2();
  }
}

runTask2();
// runTask();

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});