import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, CheckCheck, Reply, Trash2, AlertTriangle } from "lucide-react";

interface MessageBubbleProps {
  message: {
    id: string;
    message: string;
    created_at: string;
    sender_id: string;
    image_url?: string | null;
    reply_to?: string | null;
  };
  replyToMessage?: {
    id: string;
    message: string;
    sender: {
      display_name: string;
    };
  } | null;
  isOwn: boolean;
  isRead?: boolean;
  onReport?: (id: string) => void;
  onReply?: (id: string, message: string) => void;
  onDelete?: (id: string) => void;
}

export const MessageBubble = ({
  message,
  replyToMessage,
  isOwn,
  isRead = false,
  onReport,
  onReply,
  onDelete,
}: MessageBubbleProps) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl p-4 ${
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {replyToMessage && (
          <div className="mb-2 pb-2 border-b border-border/50 opacity-70">
            <p className="text-xs font-semibold">
              Replying to {replyToMessage.sender.display_name}
            </p>
            <p className="text-xs truncate">{replyToMessage.message}</p>
          </div>
        )}
        {message.image_url && !imageError && (
          <img
            src={message.image_url}
            alt="Shared image"
            className="rounded-lg mb-2 max-w-full"
            onError={() => setImageError(true)}
          />
        )}
        <p className="break-words">{message.message}</p>
        <div className="flex items-center gap-1 mt-2 justify-end">
          <p className="text-xs opacity-70">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {isOwn && (
            <span className="text-xs opacity-70">
              {isRead ? (
                <CheckCheck className="h-4 w-4 inline" />
              ) : (
                <Check className="h-4 w-4 inline" />
              )}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {onReply && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onReply(message.id, message.message)}
          >
            <Reply className="h-4 w-4" />
          </Button>
        )}
        {!isOwn && onReport && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onReport(message.id)}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
        )}
        {isOwn && onDelete && (
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
    </div>
  );
};
