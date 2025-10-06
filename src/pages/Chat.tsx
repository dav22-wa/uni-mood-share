import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, ArrowLeft, LogOut, X } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  message: string;
  created_at: string;
  profiles: {
    display_name: string;
  };
  user_id: string;
  reply_to?: string | null;
}

const Chat = () => {
  const { mood } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; message: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      await fetchRoomAndMessages();
      subscribeToMessages();
    };

    initialize();
  }, [mood]);

  const fetchRoomAndMessages = async () => {
    try {
      const { data: room } = await supabase
        .from("mood_chat_rooms")
        .select("id")
        .eq("mood", mood as any)
        .single();

      if (!room) return;

      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          id,
          message,
          created_at,
          user_id,
          reply_to,
          profiles (
            display_name
          )
        `)
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      scrollToBottom();
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          fetchRoomAndMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: room } = await supabase
        .from("mood_chat_rooms")
        .select("id")
        .eq("mood", mood as any)
        .single();

      if (!room) throw new Error("Room not found");

      const { error } = await supabase
        .from("chat_messages")
        .insert({
          room_id: room.id,
          user_id: user.id,
          message: newMessage.trim(),
          reply_to: replyingTo?.id || null,
        });

      if (error) throw error;
      setNewMessage("");
      setReplyingTo(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const reportMessage = async () => {
    if (!reportingMessage) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("reported_messages")
        .insert({
          message_id: reportingMessage,
          reporter_id: user.id,
          reason: "Inappropriate content",
        });

      if (error) throw error;

      toast({
        title: "Message reported",
        description: "Thank you for keeping our community safe",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReportingMessage(null);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      toast({
        title: "Message deleted",
        description: "Your message has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReply = (messageId: string, messageText: string) => {
    setReplyingTo({ id: messageId, message: messageText });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getMoodEmoji = (mood?: string) => {
    const moodMap: Record<string, string> = {
      happy: "😊",
      stressed: "😰",
      lonely: "😔",
      excited: "🤩",
      tired: "😴",
    };
    return moodMap[mood || ""] || "😊";
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-card border-b p-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/mood-match")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-3xl">{getMoodEmoji(mood)}</span>
            {mood} chat
          </h1>
          <p className="text-sm text-muted-foreground">
            {messages.length} messages
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const replyToMessage = msg.reply_to
            ? messages.find((m) => m.id === msg.reply_to)
            : null;
          
          return (
            <ChatMessage
              key={msg.id}
              message={msg}
              replyToMessage={replyToMessage}
              isOwn={msg.user_id === currentUserId}
              onReport={setReportingMessage}
              onReply={handleReply}
              onDelete={deleteMessage}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-card border-t">
        {replyingTo && (
          <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">Replying to</p>
              <p className="text-xs truncate">{replyingTo.message}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <AlertDialog open={!!reportingMessage} onOpenChange={() => setReportingMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will flag the message for review by moderators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reportMessage}>Report</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Chat;