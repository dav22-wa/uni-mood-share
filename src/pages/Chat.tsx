import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, AlertTriangle, ArrowLeft } from "lucide-react";
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
}

const Chat = () => {
  const { mood } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
        });

      if (error) throw error;
      setNewMessage("");
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.user_id === currentUserId ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                msg.user_id === currentUserId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="text-xs font-semibold mb-1">
                {msg.profiles.display_name}
              </p>
              <p className="break-words">{msg.message}</p>
              <p className="text-xs mt-2 opacity-70">
                {new Date(msg.created_at).toLocaleTimeString()}
              </p>
            </div>
            {msg.user_id !== currentUserId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setReportingMessage(msg.id)}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-card border-t">
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