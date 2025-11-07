import { Avatar } from "./Avatar";
import { OnlineIndicator } from "./OnlineIndicator";
import { formatDistanceToNow } from "date-fns";

interface ContactListItemProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  onClick: () => void;
}

export const ContactListItem = ({
  name,
  avatarUrl,
  lastMessage,
  lastMessageTime,
  unreadCount = 0,
  isOnline = false,
  onClick,
}: ContactListItemProps) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer border-b border-border"
    >
      <div className="relative">
        <Avatar src={avatarUrl} alt={name} size="lg" />
        <div className="absolute bottom-0 right-0">
          <OnlineIndicator isOnline={isOnline} size="sm" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold truncate">{name}</p>
          {lastMessageTime && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(lastMessageTime), { addSuffix: true })}
            </span>
          )}
        </div>
        {lastMessage && (
          <p className="text-sm text-muted-foreground truncate">{lastMessage}</p>
        )}
      </div>
      {unreadCount > 0 && (
        <div className="h-6 min-w-6 px-2 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
          {unreadCount}
        </div>
      )}
    </div>
  );
};
