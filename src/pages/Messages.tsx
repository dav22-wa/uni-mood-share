import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogOut, UserPlus, User as UserIcon, Search } from "lucide-react";
import { ContactListItem } from "@/components/ContactListItem";
import { Avatar } from "@/components/Avatar";
import { usePresence } from "@/hooks/usePresence";

interface Contact {
  id: string;
  contact_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

const Messages = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();
  const { isUserOnline } = usePresence("messages-presence");

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUser(user);
      await fetchContacts();
    };

    initialize();
  }, [navigate]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, contact_id, created_at");

      if (error) throw error;

      // Fetch profile data for each contact
      const contactsWithProfiles = await Promise.all(
        (data || []).map(async (contact) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", contact.contact_id)
            .single();

          return {
            ...contact,
            profiles: profile || { display_name: "Unknown", avatar_url: null },
          };
        })
      );

      setContacts(contactsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.profiles.display_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-4 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="text-sm opacity-90">{contacts.length} contacts</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/profile")}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <UserIcon className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/contacts")}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <UserPlus className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-4 border-b bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No contacts yet</h2>
            <p className="text-muted-foreground mb-4">
              Add contacts to start messaging
            </p>
            <Button onClick={() => navigate("/contacts")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contacts
            </Button>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <ContactListItem
              key={contact.id}
              id={contact.contact_id}
              name={contact.profiles.display_name}
              avatarUrl={contact.profiles.avatar_url}
              isOnline={isUserOnline(contact.contact_id)}
              onClick={() => navigate(`/chat/${contact.contact_id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Messages;
