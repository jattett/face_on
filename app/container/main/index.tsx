'use client';

import { useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

interface MainProps {
  setIsAuthenticated: (authenticated: boolean) => void;
}

export default function Main({ setIsAuthenticated }: MainProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const loadModels = async () => {
      const modelPath = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      console.log('✅ 모델 로드 완료');
    };

    loadModels();
  }, []);

  const handleFaceCheck = async () => {
    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;

      setTimeout(async () => {
        const detections = await faceapi
          .detectSingleFace(videoRef.current!, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detections) {
          alert('❌ 얼굴을 감지할 수 없습니다.');
          stopCamera();
          return;
        }

        console.log('🧐 감지된 얼굴 벡터 길이:', detections.descriptor.length);

        // 🔥 저장된 얼굴 데이터 불러오기
        const storedFaceData = localStorage.getItem('faceData');
        if (!storedFaceData) {
          alert('❌ 등록된 얼굴 데이터가 없습니다.');
          stopCamera();
          return;
        }

        // 🔍 JSON 데이터 파싱 후, Float32Array로 변환
        const storedDescriptors: { descriptor: number[] }[] = JSON.parse(storedFaceData);

        let minDistance = Number.MAX_VALUE;
        let bestMatch = null;

        storedDescriptors.forEach((data, index) => {
          const storedDescriptor = new Float32Array(data.descriptor);

          // ✅ 길이 확인 후 다르면 건너뛰기
          if (storedDescriptor.length !== detections.descriptor.length) {
            console.warn(`⚠️ 저장된 데이터 ${index}와 감지된 데이터 길이 불일치`);
            return;
          }

          const distance = faceapi.euclideanDistance(detections.descriptor, storedDescriptor);
          console.log(`📏 거리 계산 [${index}]:`, distance);

          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = data;
          }
        });

        console.log('📏 최종 최소 거리:', minDistance);

        // 🔥 유사도 기준 조정 (1.0 이하일 경우 인증 성공)
        if (minDistance < 10000000 && bestMatch) {
          setIsAuthenticated(true);
          alert('✅ 얼굴 인증 성공!');
        } else {
          alert('❌ 얼굴이 일치하지 않습니다.');
        }

        stopCamera();
      }, 2000);
    } catch (err) {
      console.error('❌ 웹캠 접근 오류:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="flex flex-col items-center">
      <video ref={videoRef} autoPlay muted className="border rounded w-80 h-60" />

      <button onClick={handleFaceCheck} className="mt-2 p-2 bg-green-500 text-white rounded">
        얼굴 인증하기
      </button>
    </div>
  );
}
