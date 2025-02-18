'use client';

import { useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

// 얼굴 데이터 로컬 스토리지 저장 (최대 30개 유지)
const saveFaceDataToLocalStorage = (descriptor: Float32Array) => {
  const storedData = localStorage.getItem('faceData');
  const faceList = storedData ? JSON.parse(storedData) : [];

  // 최대 30개 유지: 초과 시 오래된 데이터 삭제
  if (faceList.length >= 30) {
    faceList.shift(); // 가장 오래된 데이터 제거
    console.log('🗑️ 오래된 데이터 삭제');
  }

  faceList.push({ descriptor: Array.from(descriptor), timestamp: Date.now() });
  localStorage.setItem('faceData', JSON.stringify(faceList));
  console.log('✅ 얼굴 데이터가 LocalStorage에 저장되었습니다!');
};

export default function FaceRecognition() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        console.log('✅ 모델 로드 완료');
      } catch (error) {
        console.error('❌ 모델 로드 실패:', error);
      }
    };
    loadModels();
  }, []);

  const handleFaceRegister = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      console.log('✅ 웹캠 실행 성공');

      videoRef.current.onloadedmetadata = () => {
        console.log('📸 비디오 로딩 완료, 얼굴 감지 시작...');
        detectFace();
      };
    } catch (err) {
      console.error('❌ 웹캠 접근 오류:', err);
    }
  };

  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const displaySize = {
      width: video.videoWidth,
      height: video.videoHeight,
    };

    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        console.log('🧐 얼굴 감지됨:', detections.descriptor);

        saveFaceDataToLocalStorage(detections.descriptor);
        console.log('✅ 저장 완료!');
      }
      stopCamera();
    }, 200);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      console.log('📴 웹캠 종료');
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      <video ref={videoRef} autoPlay muted className="border rounded w-80 h-60" />
      <canvas ref={canvasRef} className="absolute top-0 w-80 h-60" />
      <button onClick={handleFaceRegister} className="mt-2 p-2 bg-blue-500 text-white rounded">
        얼굴 등록하기
      </button>
    </div>
  );
}
