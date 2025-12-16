/**
 * 老虎机加载动画组件
 *
 * V1.4.0 - AI智能砍价系统
 *
 * 功能:
 * - 显示老虎机样式的加载动画
 * - 显示加载提示文字
 * - 显示进度条
 */

'use client';

import { useEffect, useState } from 'react';

interface SlotMachineAnimationProps {
  /**
   * 总加载时间（毫秒）
   * 默认 2500ms（2.5秒）
   */
  duration?: number;
}

const SLOT_SYMBOLS = ['🎰', '💰', '🎁', '🎉', '✨', '💫', '🌟', '⭐'];

const LOADING_STEPS = [
  '正在评估你的真诚度...',
  '计算专属折扣...',
  '生成优惠券...',
];

export default function SlotMachineAnimation({
  duration = 2500,
}: SlotMachineAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [slotSymbols, setSlotSymbols] = useState(['🎰', '🎰', '🎰']);

  useEffect(() => {
    // 进度条动画
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2; // 每50ms增加2%（总计2.5秒）
      });
    }, 50);

    // 步骤切换
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, duration / LOADING_STEPS.length);

    // 老虎机滚动效果
    const slotInterval = setInterval(() => {
      setSlotSymbols([
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      ]);
    }, 100); // 每100ms切换一次符号

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearInterval(slotInterval);
    };
  }, [duration]);

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-8">
      {/* 老虎机符号 */}
      <div className="flex gap-4">
        {slotSymbols.map((symbol, index) => (
          <div
            key={index}
            className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-lg"
          >
            <span className="text-4xl animate-bounce">{symbol}</span>
          </div>
        ))}
      </div>

      {/* 加载提示 */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150"></div>
        </div>
        <p className="text-lg font-medium text-gray-700 animate-pulse">
          AI 正在分析中...
        </p>
      </div>

      {/* 进度条 */}
      <div className="w-full max-w-md">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-blue-600 transition-all duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 text-center mt-2">
          {progress}%
        </p>
      </div>

      {/* 当前步骤 */}
      <div className="flex flex-col items-center space-y-2">
        {LOADING_STEPS.map((step, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 text-sm transition-all duration-300 ${
              index === currentStep
                ? 'text-primary font-medium scale-110'
                : 'text-gray-400'
            }`}
          >
            {index === currentStep ? (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : index < currentStep ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-current"></div>
            )}
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
