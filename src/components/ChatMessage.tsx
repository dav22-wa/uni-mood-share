import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Reply, Trash2 } from "lucide-react";

interface ChatMessageProps {
  message: {
    id: string;
    message: string;
    created_at: string;
    user_id: string;
    reply_to?: string | null;
    profiles: {
      display_name: string;
    };
  };
  replyToMessage?: {
    id: string;
    message: string;
    profiles: {
      display_name: string;
    };
  } | null;
  isOwn: boolean;
  onReport: (id: string) => void;
  onReply: (id: string, message: string) => void;
  onDelete: (id: string) => void;
}

export const ChatMessage = ({
  message,
  replyToMessage,
  isOwn,
  onReport,
  onReply,
  onDelete,
}: ChatMessageProps) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const messageRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart !== null) {
      const distance = e.targetTouches[0].clientX - touchStart;
      setOffset(Math.max(0, Math.min(distance, 100)));
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchEnd - touchStart;
    const isSwipe = distance > minSwipeDistance;

    if (isSwipe) {
      onReply(message.id, message.message);
    }

    setOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  useEffect(() => {
    if (offset === 0) return;

    const timeout = setTimeout(() => {
      setOffset(0);
    }, 300);

    return () => clearTimeout(timeout);
  }, [offset]);

  return (
    <div
      ref={messageRef}
      className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${isOwn ? -offset : offset}px)`,
        transition: touchStart ? "none" : "transform 0.3s ease",
      }}
    >
      <div
        className={`max-w-[80%] rounded-2xl p-4 ${
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {replyToMessage && (
          <div className="mb-2 pb-2 border-b border-border/50 opacity-70">
            <p className="text-xs font-semibold">
              Replying to {replyToMessage.profiles.display_name}
            </p>
            <p className="text-xs truncate">{replyToMessage.message}</p>
          </div>
        )}
        <p className="text-xs font-semibold mb-1">
          {message.profiles.display_name}
        </p>
        <p className="break-words">{message.message}</p>
        <p className="text-xs mt-2 opacity-70">
          {new Date(message.created_at).toLocaleTimeString()}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {!isOwn && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onReport(message.id)}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
        )}
        {isOwn && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {offset > minSwipeDistance && (
        <div className={`absolute ${isOwn ? "right-0" : "left-0"} top-1/2 -translate-y-1/2`}>
          <Reply className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};
