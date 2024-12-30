

import './index.css';

console.log('👋 This message is being logged by "renderer.js", included via webpack');

import { ipcRenderer } from 'electron';
import fs from 'fs';
import hbjs from 'handbrake-js';
import path from 'path';
import os from 'os';

let mediaRecorder;
let recordedChunks = [];
let currentVideoStream;
let combinedStream;

// Buttons
const videoElement = document.getElementById('screen');
const cameraElement = document.getElementById('camera');

const startBtn = document.getElementById('startBtn');
const cameraBtn = document.getElementById('cameraBtn');

var cameraOn = false;
var isRecording = false;

startBtn.onclick = e => {
  startRecording();
  startBtn.innerText = 'Recording';
};

cameraBtn.onclick = e => {
  cameraOn = !cameraOn;
  cameraBtn.innerText = 'Camera ' + ((cameraOn) ? 'On' : 'Off');
  switchVideoStream();
};

const stopBtn = document.getElementById('stopBtn');

stopBtn.onclick = e => {
  stopRecording();
  startBtn.innerText = 'Start';
};

const videoSelectBtn = document.getElementById('videoSelectBtn');
videoSelectBtn.onclick = getVideoSources;

const screenSelectMenu = document.getElementById('screenSelect');
const audioSelectMenu = document.getElementById('audioSelect');
const cameraSelectMenu = document.getElementById('cameraSelect');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('App loaded. Starting screen capture...');
  getVideoSources();
});

async function getVideoSources() {
  const inputSources = await ipcRenderer.invoke('getSources')
  screenSelectMenu.innerHTML = '';
  inputSources.forEach(source => {
    const element = document.createElement("option")
    element.value = source.id
    element.innerHTML = source.name
    screenSelectMenu.appendChild(element)
  });
  await listMicrophones();
  await listCamera();
  await selectDefaultValues();
}

async function selectDefaultValues() {
  selectScreen(screenSelectMenu.options[screenSelectMenu.selectedIndex].value);
  selectCamera();
}

screenSelectMenu.addEventListener('change', (event) => {
  const selectedValue = event.target.value; // Get the selected value
  selectScreen(selectedValue); // Call the custom method with the value
  switchVideoStream();
});

cameraSelectMenu.addEventListener('change', (event) => {
  selectCamera(); // Call the custom method with the value
});

async function selectScreen(selectedSource) {
  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSource,
      },
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  // Preview the source in a video element
  videoElement.srcObject = stream;
  videoElement.play();
}

async function selectCamera() {
  try {
    const cameraStream = await getCameraStream();
    cameraElement.srcObject = cameraStream;
    cameraElement.play();
    console.log('Camera stream captured:', cameraStream);
  } catch (err) {
    console.error('Error capturing camera:', err);
  }
}

async function getMicrophoneAudioStream() {
  try {
    const audioDevice = audioSelectMenu.options[audioSelectMenu.selectedIndex].value
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: audioDevice ? { exact: audioDevice } : undefined },
    });
    console.log('Microphone audio stream captured:', audioStream);
    return audioStream;
  } catch (err) {
    console.error('Error capturing microphone audio:', err);
    return null;
  }
}

async function getCameraStream() {
  try {
    const cameraDevice = cameraSelectMenu.options[cameraSelectMenu.selectedIndex].value
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraDevice ? { exact: cameraDevice } : undefined,
        width: { exact: 1280 },
        height: { exact: 720 },
        frameRate: { ideal: 30 }
      },
    });
    console.log('Camera stream captured:', cameraStream);
    return cameraStream;
  } catch (err) {
    console.error('Camera stream:', err);
    return null;
  }
}

async function getScreenStream() {
  try {
    const screenId = screenSelectMenu.options[screenSelectMenu.selectedIndex].value
    const screenStream = await navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenId,
            minWidth: 1280,
            maxWidth: 1280,
            minHeight: 720,
            maxHeight: 720,
            maxFrameRate: 60
          }
        }
      });
    return screenStream;
  } catch (err) {
    console.error('Screen stream:', err);
    return null;
  }
}

async function listMicrophones() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const microphones = devices.filter(device => device.kind === 'audioinput');

  audioSelectMenu.innerHTML = ''; // Clear existing options
  microphones.forEach(microphone => {
    const option = document.createElement('option');
    option.value = microphone.deviceId;
    option.textContent = microphone.label || `Microphone ${audioSelectMenu.length + 1}`;
    audioSelectMenu.appendChild(option);
  });
}


async function listCamera() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(device => device.kind === 'videoinput');

  cameraSelectMenu.innerHTML = ''; // Clear existing options
  cameras.forEach(camera => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.textContent = camera.label || `Camera ${cameraSelectMenu.length + 1}`;
    cameraSelectMenu.appendChild(option);
  });
}


async function startRecording() {
  isRecording = true;
  // Create a Stream
  const audioStream = await getMicrophoneAudioStream();
  const videoStream = await getScreenStream();

  // Preview the source in a video element
  videoElement.srcObject = videoStream;
  await videoElement.play();

  if (!audioStream) {
    console.error('Microphone audio stream not available');
    return;
  }

  currentVideoStream = videoStream;
  combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioStream.getAudioTracks(),
  ]);

  startMediaRecorder();
}

function startMediaRecorder() {
  if (!isRecording) {
    return;
  }
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/x-matroska' });
  mediaRecorder.ondataavailable = onDataAvailable;
  mediaRecorder.start();
}

async function switchVideoStream() {
  let newVideoStream;
  if (cameraOn) {
    newVideoStream = await getCameraStream();
  } else {
    newVideoStream = await getScreenStream();
  }

  if (newVideoStream && isRecording) {
    // Stop the current video track
    currentVideoStream.getVideoTracks()[0].stop();

    // Replace the video track in the combined stream
    const newVideoTrack = newVideoStream.getVideoTracks()[0];
    mediaRecorder.stop();

    combinedStream.removeTrack(currentVideoStream.getVideoTracks()[0]);
    combinedStream.addTrack(newVideoTrack);
    if (cameraOn) {
      videoElement.srcObject = newVideoStream;
      await videoElement.play();
    }
    currentVideoStream = newVideoStream;
    startMediaRecorder();
  }

}

function onDataAvailable(e) {
  recordedChunks.push(e.data);
}


async function stopRecording() {
  if (!mediaRecorder) {
    console.error("No active media recorder found");
    return;
  }
  mediaRecorder.stop();
  isRecording = false;
  const blob = new Blob(recordedChunks, {
    type: 'video/webm; codecs=vp9'
  });

  const buffer = Buffer.from(await blob.arrayBuffer());
  recordedChunks = []

  const { canceled, filePath } = await ipcRenderer.invoke('showSaveDialog')
  if (canceled) return

  if (filePath) {
    compress(filePath, buffer)
      .then(outputPath => {
        console.log('Compressed file saved to:', outputPath);
      })
      .catch(err => {
        console.error('Failed to compress video:', err);
      });
  }
}

async function compress(outputPath, inputBuffer) {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `temp_video_${Date.now()}.mp4`);
  await fs.promises.writeFile(tempFile, inputBuffer);

  const handbrakePath = await ipcRenderer.invoke('getHhandbrakePath');
  console.log('HandBrake Path:', handbrakePath);

  return new Promise((resolve, reject) => {

    // Use HandBrake.js to compress the video
    hbjs.spawn({
      input: tempFile,
      output: outputPath,
      preset: 'Fast 720p30',
    }, {
      HandbrakeCLI: handbrakePath,
    })
      .on('progress', progress => {
        console.log(`Percent complete: ${progress.percentComplete}, ETA: ${progress.eta}`);
      })
      .on('end', () => {
        console.log('Compression complete! Output:', outputPath);
        fs.promises.unlink(tempFile).then(() => {
          resolve(outputPath);
        }).catch(err => {
          console.error('Error deleting temporary file:', err);
          resolve(outputPath);
        });
      })
      .on('error', err => {
        console.error('Error during compression:', err);
        fs.promises.unlink(tempFile).catch(cleanErr => {
          console.error('Error cleaning up temporary file:', cleanErr);
        });
        reject(err);
      });
  });
}