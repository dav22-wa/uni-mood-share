import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Search, Loader2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { OnlineIndicator } from "@/components/OnlineIndicator";
import { usePresence } from "@/hooks/usePresence";

interface User {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [existingContacts, setExistingContacts] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { isUserOnline } = usePresence("contacts-presence");

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);
      await fetchExistingContacts(user.id);
      await fetchUsers();
    };

    initialize();
  }, [navigate]);

  const fetchExistingContacts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("contact_id")
        .eq("user_id", userId);

      if (error) throw error;
      setExistingContacts(new Set(data.map((c) => c.contact_id)));
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, email")
        .neq("id", currentUserId || "");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addContact = async (contactId: string) => {
    if (!currentUserId) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("contacts")
        .insert({ user_id: currentUserId, contact_id: contactId });

      if (error) throw error;

      setExistingContacts((prev) => new Set([...prev, contactId]));
      
      toast({
        title: "Contact added",
        description: "You can now start messaging",
      });
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

  const filteredUsers = users.filter(
    (user) =>
      user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h1 className="text-xl font-bold flex-1">Add Contacts</h1>
      </div>

      <div className="p-4 border-b bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No users found</h2>
            <p className="text-muted-foreground">Try a different search</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isContact = existingContacts.has(user.id);
            
            return (
              <div
                key={user.id}
                className="flex items-center gap-3 p-4 border-b border-border"
              >
                <div className="relative">
                  <Avatar src={user.avatar_url} alt={user.display_name} size="lg" />
                  <div className="absolute bottom-0 right-0">
                    <OnlineIndicator isOnline={isUserOnline(user.id)} size="sm" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user.display_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                {isContact ? (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/chat/${user.id}`)}
                  >
                    Message
                  </Button>
                ) : (
                  <Button
                    onClick={() => addContact(user.id)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Contacts;
