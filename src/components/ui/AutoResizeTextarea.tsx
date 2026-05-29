import React, { useEffect, useRef } from 'react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

export function AutoResizeTextarea({ value, onChange, className, style, ...props }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to allow shrinking if text is deleted
      textarea.style.height = 'auto';
      // Set new height based on scrollHeight
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className={className}
      style={{
        ...style,
        overflow: 'hidden',
        resize: 'none',
        minHeight: '40px',
      }}
      {...props}
    />
  );
}
