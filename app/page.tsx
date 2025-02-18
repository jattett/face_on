'use client';

import { useState } from 'react';
import FaceRecognition from './components/FaceRecognition';
import Main from './container/main';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div
      className="flex grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20"
      style={{ backgroundColor: isAuthenticated ? '#4CAF50' : 'white' }}
    >
      {/* 얼굴 등록 컴포넌트 */}
      <FaceRecognition />

      {/* 얼굴 인증 컴포넌트 */}
      <Main setIsAuthenticated={setIsAuthenticated} />
    </div>
  );
}
