'use client';

import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

interface MainProps {
  setIsAuthenticated: (authenticated: boolean) => void;
}

// ✅ 코사인 유사도 계산 함수 (벡터 비교)
const cosineSimilarity = (vecA: Float32Array, vecB: Float32Array) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
};

export default function Main({ setIsAuthenticated }: MainProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const handleFaceCheck = async () => {
    console.log('🔵 handleFaceCheck() 실행됨');

    if (!videoRef.current) {
      console.log('❌ videoRef 없음');
      return;
    }
    if (isDetecting) {
      console.log('❌ 이미 감지 중');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      console.log('✅ 웹캠 실행 성공');

      setTimeout(() => startFaceDetection(), 1000);
    } catch (err) {
      console.error('❌ 웹캠 접근 오류:', err);
    }
  };

  const startFaceDetection = () => {
    console.log('🚀 얼굴 감지 시작 (5초 동안 데이터 수집)!');
    if (!videoRef.current || !canvasRef.current) return;

    setIsDetecting(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ✅ 캔버스 크기 설정
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    faceapi.matchDimensions(canvas, { width: video.videoWidth, height: video.videoHeight });

    const options = new faceapi.SsdMobilenetv1Options({
      minConfidence: 0.1,
      maxResults: 1,
    });

    let collectedDescriptors: Float32Array[] = [];
    const detectionInterval = 200;
    const totalTime = 5000;
    let elapsedTime = 0;

    const intervalId = setInterval(async () => {
      const detections = await faceapi.detectSingleFace(video, options).withFaceLandmarks().withFaceDescriptor();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections) {
        console.log(`🧐 얼굴 감지됨 (${elapsedTime / 1000}s):`, detections);
        collectedDescriptors.push(detections.descriptor);
        drawFaceBox(ctx, detections);
      } else {
        console.log('❌ 얼굴 감지 실패 - 조명 또는 거리 확인');
      }

      elapsedTime += detectionInterval;
      if (elapsedTime >= totalTime) {
        clearInterval(intervalId);
        finalizeFaceDetection(collectedDescriptors);
      }
    }, detectionInterval);
  };

  const finalizeFaceDetection = (collectedDescriptors: Float32Array[]) => {
    console.log('📊 얼굴 데이터 수집 완료:', collectedDescriptors.length, '개의 데이터');

    if (collectedDescriptors.length === 0) {
      console.log('❌ 얼굴 감지 데이터 없음, 인증 실패');
      alert('❌ 얼굴을 감지할 수 없습니다.');
      setIsDetecting(false);
      return;
    }

    // ✅ 얼굴 데이터 평균화
    const vectorLength = collectedDescriptors[0].length;
    const averagedDescriptor = new Float32Array(vectorLength).fill(0);

    collectedDescriptors.forEach((descriptor) => {
      for (let i = 0; i < vectorLength; i++) {
        averagedDescriptor[i] += descriptor[i];
      }
    });

    for (let i = 0; i < vectorLength; i++) {
      averagedDescriptor[i] /= collectedDescriptors.length;
    }

    console.log('✅ 얼굴 데이터 평균화 완료:', averagedDescriptor);
    authenticateWithStoredData(averagedDescriptor);
  };

  const authenticateWithStoredData = (averagedDescriptor: Float32Array) => {
    const storedFaceData = localStorage.getItem('faceData');
    if (!storedFaceData) {
      console.log('❌ 등록된 얼굴 데이터 없음');
      alert('❌ 등록된 얼굴 데이터가 없습니다.');
      setIsDetecting(false);
      return;
    }

    const storedDescriptors: { descriptor: number[] }[] = JSON.parse(storedFaceData);
    let maxSimilarity = -1;
    const similarityList: { index: number; similarity: number }[] = [];

    console.log(`🧐 인증 시작! 저장된 얼굴 데이터 개수: ${storedDescriptors.length}`);

    storedDescriptors.forEach((data, index) => {
      const storedDescriptor = new Float32Array(data.descriptor);
      const similarity = cosineSimilarity(averagedDescriptor, storedDescriptor);
      similarityList.push({ index, similarity });

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    });

    similarityList.sort((a, b) => b.similarity - a.similarity);
    console.log('📊 유사도 분석 결과:', similarityList);
    console.log('📏 최종 최대 유사도:', maxSimilarity);

    if (maxSimilarity >= 0.99999) {
      setIsAuthenticated(true);
      console.log('✅ 얼굴 인증 성공!');
      alert(`✅ 얼굴 인증 성공! (최대 유사도: ${(maxSimilarity * 100).toFixed(2)}%)`);
    } else {
      console.log('❌ 얼굴이 일치하지 않습니다.');
      alert(`❌ 얼굴이 일치하지 않습니다. (최대 유사도: ${(maxSimilarity * 100).toFixed(2)}%)`);
    }

    setIsDetecting(false);
  };

  const drawFaceBox = (
    ctx: CanvasRenderingContext2D,
    detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
  ) => {
    const { x, y, width, height } = detections.detection.box;
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'red';
    ctx.font = '14px Arial';
    ctx.fillText(`X: ${Math.round(x)}, Y: ${Math.round(y)}`, x, y - 10);
  };

  return (
    <div className="relative flex flex-col items-center">
      <video ref={videoRef} autoPlay muted className="border rounded w-80 h-60" />
      <canvas ref={canvasRef} className="absolute top-0 w-80 h-60" />
      <button onClick={handleFaceCheck} className="mt-2 p-2 bg-green-500 text-white rounded">
        얼굴 인증하기
      </button>
    </div>
  );
}
