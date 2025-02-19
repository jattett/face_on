'use client';

import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

// 얼굴 데이터 로컬 스토리지 저장 (최대 30개 유지)
const saveFaceDataToLocalStorage = (descriptor: Float32Array) => {
  const storedData = localStorage.getItem('faceData');
  const faceList = storedData ? JSON.parse(storedData) : [];

  if (faceList.length >= 30) {
    faceList.shift(); // 가장 오래된 데이터 삭제
    console.log('🗑️ 오래된 데이터 삭제');
  }

  faceList.push({ descriptor: Array.from(descriptor), timestamp: Date.now() });
  localStorage.setItem('faceData', JSON.stringify(faceList));

  console.log('✅ 얼굴 데이터 저장 완료:', faceList);
};

export default function FaceRecognition() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedData, setCapturedData] = useState<Float32Array | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('📥 모델 로드 시작...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }, // 📌 해상도를 높여 얼굴 감지 성능 향상
      });

      videoRef.current.srcObject = stream;
      console.log('✅ 웹캠 실행 성공');

      videoRef.current.onloadedmetadata = () => {
        console.log(`🎥 비디오 해상도: ${videoRef.current?.videoWidth} x ${videoRef.current?.videoHeight}`);
        detectFace();
      };
    } catch (err) {
      console.error('❌ 웹캠 접근 오류:', err);
    }
  };

  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current || isDetecting) return;
    setIsDetecting(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    faceapi.matchDimensions(canvas, { width: video.videoWidth, height: video.videoHeight });

    console.log('🚀 얼굴 감지 시작...');
    const options = new faceapi.SsdMobilenetv1Options({
      minConfidence: 0.05,
      maxResults: 1,
    });

    const detectionResults: Float32Array[] = [];
    const detectionInterval = 200; // 200ms마다 감지
    const totalTime = 5000; // 5초 동안 감지
    let elapsedTime = 0;

    const intervalId = setInterval(async () => {
      const detections = await faceapi.detectSingleFace(video, options).withFaceLandmarks().withFaceDescriptor();

      if (detections) {
        console.log(`🧐 얼굴 감지됨: ${elapsedTime / 1000}s`, detections);
        detectionResults.push(detections.descriptor);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawDetailedFaceInfo(ctx, detections);
      } else {
        console.log('❌ 얼굴 감지 실패 - 조명을 밝게 하고, 얼굴을 카메라 중앙에 위치시키세요.');
      }

      elapsedTime += detectionInterval;
      if (elapsedTime >= totalTime) {
        clearInterval(intervalId); // 5초 후 감지 종료
        processAndSaveFaceData(detectionResults);
        stopCamera();
        setIsDetecting(false);
      }
    }, detectionInterval);
  };

  const processAndSaveFaceData = (detectionResults: Float32Array[]) => {
    if (detectionResults.length === 0) {
      console.log('❌ 얼굴 감지 데이터 없음, 저장하지 않음');
      return;
    }

    // ✅ 여러 개의 감지 데이터를 평균값으로 변환하여 저장 (더 정확한 데이터 확보)
    const numVectors = detectionResults.length;
    const vectorLength = detectionResults[0].length;
    const averagedDescriptor = new Float32Array(vectorLength).fill(0);

    detectionResults.forEach((descriptor) => {
      for (let i = 0; i < vectorLength; i++) {
        averagedDescriptor[i] += descriptor[i];
      }
    });

    for (let i = 0; i < vectorLength; i++) {
      averagedDescriptor[i] /= numVectors;
    }

    console.log('✅ 얼굴 데이터 평균화 완료:', averagedDescriptor);
    setCapturedData(averagedDescriptor);
  };

  const handleSaveFaceData = () => {
    if (capturedData) {
      saveFaceDataToLocalStorage(capturedData);
      console.log('💾 사용자에 의해 얼굴 데이터가 저장되었습니다!');
    } else {
      console.log('❌ 저장할 얼굴 데이터가 없습니다.');
    }
  };

  const drawDetailedFaceInfo = (
    ctx: CanvasRenderingContext2D,
    detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
  ) => {
    const { detection, landmarks } = detections;
    const { x, y, width, height } = detection.box;

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = 'red';
    ctx.font = '14px Arial';
    ctx.fillText(`X: ${Math.round(x)}, Y: ${Math.round(y)}`, x, y - 10);

    landmarks.positions.forEach((point, index) => {
      ctx.fillStyle = 'blue';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`${index}`, point.x + 2, point.y - 2);
    });

    console.log('📌 얼굴 감지 좌표:', { x, y, width, height });
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
        얼굴 감지 시작
      </button>
      <button onClick={handleSaveFaceData} className="mt-2 p-2 bg-green-500 text-white rounded">
        얼굴 데이터 저장하기
      </button>
    </div>
  );
}
