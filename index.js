// server.js
const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');

const CAMERA_RTSP_URL = 'rtsp://admin:admin@192.168.0.2:1935';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  const ffmpeg = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-i', CAMERA_RTSP_URL,
    '-f', 'image2pipe',
    '-qscale', '5',
    '-vf', 'fps=10',
    '-update', '1',
    '-vcodec', 'mjpeg',
    'pipe:1',
  ]);

  ffmpeg.stdout.on('data', (chunk) => {
    // Parse and send complete JPEG frames
    const start = chunk.indexOf(Buffer.from([0xFF, 0xD8])); // JPEG start
    const end = chunk.indexOf(Buffer.from([0xFF, 0xD9]));   // JPEG end

    if (start !== -1 && end !== -1 && end > start) {
      const frame = chunk.slice(start, end + 2);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(frame);
      }
    }
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`ffmpeg stderr: ${data}`);
  });

  ffmpeg.on('close', () => {
    console.log('FFmpeg closed');
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    ffmpeg.kill('SIGINT');
  });
});

server.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
