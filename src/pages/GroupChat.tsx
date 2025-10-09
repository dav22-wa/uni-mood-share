import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, LogOut, X, Users, Bot, Reply, AlertTriangle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Message {
  id: string;
  message: string;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url?: string | null;
  };
  user_id: string;
  reply_to?: string | null;
}

interface UserWithMood {
  user_id: string;
  mood: string;
  profiles: {
    display_name: string;
    avatar_url?: string | null;
  } | null;
}

const GroupChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; message: string } | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserWithMood[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setCurrentUserId(user.id);
      
      // Check if user has checked in mood today
      const { data: moodData } = await supabase
        .from("mood_checkins")
        .select("mood")
        .eq("user_id", user.id)
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!moodData) {
        navigate("/mood-checkin");
        return;
      }

      await fetchActiveUsers();
      await fetchRoomAndMessages();
    };

    initialize();
    
    const subscription = subscribeToMessages();
    
    return () => {
      subscription();
    };
  }, []);

  const fetchActiveUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("mood_checkins")
        .select(`
          user_id,
          mood,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Remove duplicates, keep latest per user
      const uniqueUsers = new Map();
      data?.forEach(item => {
        if (item.profiles && !uniqueUsers.has(item.user_id)) {
          uniqueUsers.set(item.user_id, item);
        }
      });
      
      setActiveUsers(Array.from(uniqueUsers.values()));
    } catch (error) {
      console.error("Error fetching active users:", error);
    }
  };

  const fetchRoomAndMessages = async () => {
    try {
      // Get or create a general chat room
      let { data: room } = await supabase
        .from("mood_chat_rooms")
        .select("id")
        .eq("mood", "general" as any)
        .maybeSingle();

      if (!room) {
        // Create general room if it doesn't exist
        const { data: newRoom, error: createError } = await supabase
          .from("mood_chat_rooms")
          .insert({ mood: "general" as any })
          .select("id")
          .single();
        
        if (createError) {
          console.error("Error creating room:", createError);
          return;
        }
        room = newRoom;
      }

      setRoomId(room.id);

      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          id,
          message,
          created_at,
          user_id,
          reply_to,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel("group-chat-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        () => {
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
    if (!newMessage.trim() || loading || !roomId) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("chat_messages")
        .insert({
          room_id: roomId,
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

  const getMoodEmoji = (mood: string) => {
    const moodMap: Record<string, string> = {
      happy: "😊",
      stressed: "😰",
      lonely: "😔",
      excited: "🤩",
      tired: "😴",
    };
    return moodMap[mood] || "😊";
  };

  const handleUserClick = (userId: string) => {
    if (userId !== currentUserId) {
      navigate(`/chat/${userId}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-gradient-to-r from-primary to-secondary text-primary-foreground p-4 flex items-center gap-4 shadow-lg">
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            MoodLink Group Chat
          </h1>
          <p className="text-sm opacity-90">
            {activeUsers.length} users online • {messages.length} messages
          </p>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/ai-counselor")}
          className="text-primary-foreground hover:bg-primary-foreground/20"
          title="Talk to AI Counselor"
        >
          <Bot className="h-5 w-5" />
        </Button>
        
        <Sheet>
        <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Users className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Online Users ({activeUsers.length})</SheetTitle>
              <SheetDescription>
                Click on a user to start a private chat
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              {activeUsers.map((user) => (
                <button
                  key={user.user_id}
                  onClick={() => handleUserClick(user.user_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  disabled={user.user_id === currentUserId}
                >
                  <Avatar 
                    src={user.profiles?.avatar_url} 
                    alt={user.profiles?.display_name || "User"} 
                    size="md"
                  />
                  <div className="flex-1 text-left">
                    <p className="font-medium">
                      {user.profiles?.display_name || "Anonymous"}
                      {user.user_id === currentUserId && " (You)"}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <span>{getMoodEmoji(user.mood)}</span>
                      <span className="capitalize">{user.mood}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="text-primary-foreground hover:bg-primary-foreground/20"
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
            <div key={msg.id} className={`flex gap-3 ${msg.user_id === currentUserId ? "flex-row-reverse" : ""} mb-4`}>
              <div
                className={`max-w-[80%] rounded-2xl p-4 shadow-md ${
                  msg.user_id === currentUserId
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {msg.user_id !== currentUserId && msg.profiles && (
                  <p className="text-xs font-semibold mb-1 opacity-70">
                    {msg.profiles.display_name}
                  </p>
                )}
                {replyToMessage && (
                  <div className="mb-2 pb-2 border-b border-border/50 opacity-70">
                    <p className="text-xs font-semibold">
                      Replying to {replyToMessage.profiles?.display_name}
                    </p>
                    <p className="text-xs truncate">{replyToMessage.message}</p>
                  </div>
                )}
                <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                <div className="flex items-center gap-1 mt-2 justify-end">
                  <p className="text-xs opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleReply(msg.id, msg.message)}
                >
                  <Reply className="h-4 w-4" />
                </Button>
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
                {msg.user_id === currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteMessage(msg.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
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

export default GroupChat;
