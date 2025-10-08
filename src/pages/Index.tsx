import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, MessageCircle } from "lucide-react";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        navigate("/mood-checkin");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        navigate("/mood-checkin");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6 animate-bounce">
          <MessageCircle className="h-24 w-24 mx-auto text-primary" />
        </div>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          MoodLink
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Connect with people who feel the same way
        </p>
        
        {user ? (
          <div className="space-y-4">
            <Button onClick={() => navigate("/mood-checkin")} size="lg" className="w-full">
              Check In Your Mood
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="lg" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button onClick={() => navigate("/auth")} size="lg" className="w-full">
            Get Started
          </Button>
        )}
      </div>
    </div>
  );
};

export default Index;
