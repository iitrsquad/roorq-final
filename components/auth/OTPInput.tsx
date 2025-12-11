'use client';

import React, { useRef, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  value: string[];
  onChange: (otp: string[]) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

export default function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && !disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const focusNext = (index: number) => {
    if (index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const focusPrev = (index: number) => {
    if (index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return;

    const newOtp = [...value];
    // Take the last character if user types in a field that already has a value
    const char = val.substring(val.length - 1);
    newOtp[index] = char;
    onChange(newOtp);

    if (char) {
      const combined = newOtp.join('');
      if (combined.length === length && !newOtp.includes('')) {
        onComplete?.(combined);
        // Don't focus next if completed to avoid jumping out or weird behavior? 
        // Usually we want to stay on the last one or blur. 
        // But if we are editing, auto-advance is good.
        if (index < length - 1) focusNext(index);
        else inputRefs.current[index]?.blur(); 
      } else {
        focusNext(index);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!value[index]) {
        focusPrev(index);
      } else {
        const newOtp = [...value];
        newOtp[index] = '';
        onChange(newOtp);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPrev(index);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNext(index);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    
    if (!pastedData) return;

    const newOtp = [...value];
    pastedData.split('').forEach((char, i) => {
      if (i < length) newOtp[i] = char;
    });
    onChange(newOtp);

    const combined = newOtp.join('');
    if (combined.length === length && !newOtp.includes('')) {
      onComplete?.(combined);
      inputRefs.current[length - 1]?.focus();
      inputRefs.current[length - 1]?.blur();
    } else {
      const nextEmptyIndex = newOtp.findIndex(val => !val);
      if (nextEmptyIndex !== -1 && inputRefs.current[nextEmptyIndex]) {
        inputRefs.current[nextEmptyIndex]?.focus();
      }
    }
  };

  return (
    <div 
      className={`flex gap-2 md:gap-3 justify-center ${error ? 'animate-shake' : ''}`}
      role="group" 
      aria-label="OTP Input"
    >
      {Array.from({ length }).map((_: unknown, index: number) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          className={`
            w-12 h-12 md:w-14 md:h-14
            border-2 rounded-lg
            text-center text-2xl md:text-3xl font-bold
            outline-none transition-all duration-150
            ${error 
              ? 'border-red-500 text-red-500 bg-red-50' 
              : 'border-gray-200 bg-white text-black focus:border-black focus:shadow-sm'
            }
            ${value[index] && !error ? 'border-gray-400' : ''}
            disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
          `}
        />
      ))}
    </div>
  );
}

