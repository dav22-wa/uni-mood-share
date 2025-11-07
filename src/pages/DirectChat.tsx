import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, ArrowLeft, X } from "lucide-react";
import { MessageBubble } from "@/components/MessageBubble";
import { Avatar } from "@/components/Avatar";
import { ImagePicker } from "@/components/ImagePicker";

interface Message {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  image_url?: string | null;
  reply_to?: string | null;
}

const DirectChat = () => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [contactProfile, setContactProfile] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; message: string } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
    };

    initialize();
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId || !contactId) return;

    fetchContactProfile();
    fetchMessages();

    const subscription = subscribeToMessages();
    return () => {
      subscription();
    };
  }, [contactId, currentUserId]);

  const fetchContactProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", contactId)
        .single();

      if (error) throw error;
      setContactProfile(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${currentUserId})`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      setTimeout(() => scrollToBottom(), 100);
      
      // Mark messages as read
      if (data && data.length > 0) {
        await markMessagesAsRead(data);
      }
    } catch (error: any) {
      console.error("Error fetching messages:", error);
    }
  };

  const markMessagesAsRead = async (msgs: Message[]) => {
    const unreadMessages = msgs.filter(msg => msg.receiver_id === currentUserId);
    
    for (const msg of unreadMessages) {
      try {
        await supabase
          .from("read_receipts")
          .upsert({ message_id: msg.id, user_id: currentUserId });
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`direct-messages-${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
        },
        () => {
          fetchMessages();
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

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImagePreview = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || loading) return;

    setLoading(true);
    try {
      let imageUrl = null;

      // Upload image if present
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("chat-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: currentUserId,
          receiver_id: contactId,
          message: newMessage.trim() || "(Image)",
          image_url: imageUrl,
          reply_to: replyingTo?.id || null,
        });

      if (error) throw error;
      
      setNewMessage("");
      setReplyingTo(null);
      clearImagePreview();
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

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("direct_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      toast({
        title: "Message deleted",
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

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/messages")}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {contactProfile && (
          <>
            <Avatar
              src={contactProfile.avatar_url}
              alt={contactProfile.display_name}
              size="md"
            />
            <div className="flex-1">
              <h1 className="font-bold">{contactProfile.display_name}</h1>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => {
          const replyToMessage = msg.reply_to
            ? messages.find((m) => m.id === msg.reply_to)
            : null;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              replyToMessage={
                replyToMessage
                  ? {
                      id: replyToMessage.id,
                      message: replyToMessage.message,
                      sender: { display_name: contactProfile?.display_name || "User" },
                    }
                  : null
              }
              isOwn={msg.sender_id === currentUserId}
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
        {imagePreview && (
          <div className="mb-2">
            <ImagePicker
              onImageSelect={handleImageSelect}
              preview={imagePreview}
              onClearPreview={clearImagePreview}
            />
          </div>
        )}
        <div className="flex gap-2">
          <ImagePicker onImageSelect={handleImageSelect} />
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || (!newMessage.trim() && !imageFile)}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DirectChat;
