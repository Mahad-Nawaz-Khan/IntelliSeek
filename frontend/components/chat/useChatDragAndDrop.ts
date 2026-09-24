"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";

function hasDraggedFiles(event: DragEvent<HTMLDivElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function useChatDragAndDrop(
  demo: boolean,
  onDropFiles: (files: File[]) => void,
) {
  const [isChatFileDragging, setIsChatFileDragging] = useState(false);
  const chatDragDepthRef = useRef(0);

  const handleChatDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    chatDragDepthRef.current += 1;
    setIsChatFileDragging(true);
  }, []);

  const handleChatDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsChatFileDragging(true);
  }, []);

  const handleChatDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    chatDragDepthRef.current = Math.max(0, chatDragDepthRef.current - 1);
    if (chatDragDepthRef.current === 0) setIsChatFileDragging(false);
  }, []);

  const handleChatDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    chatDragDepthRef.current = 0;
    setIsChatFileDragging(false);
    onDropFiles(Array.from(event.dataTransfer.files));
  }, [onDropFiles]);

  return {
    isChatFileDragging,
    dragProps: demo
      ? {}
      : {
          onDragEnter: handleChatDragEnter,
          onDragOver: handleChatDragOver,
          onDragLeave: handleChatDragLeave,
          onDrop: handleChatDrop,
        },
  };
}
