import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, ArrowRight } from "lucide-react";

interface MoodCheckin {
  id: string;
  mood: string;
  created_at: string;
  profiles: {
    display_name: string;
  };
}

const MoodMatch = () => {
  const [matches, setMatches] = useState<MoodCheckin[]>([]);
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's latest mood
      const { data: userMood } = await supabase
        .from("mood_checkins")
        .select("mood")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!userMood) {
        navigate("/mood-checkin");
        return;
      }

      setCurrentMood(userMood.mood);

      // Get others with same mood
      const { data: matchesData, error } = await supabase
        .from("mood_checkins")
        .select(`
          id,
          mood,
          created_at,
          profiles (
            display_name
          )
        `)
        .eq("mood", userMood.mood)
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMatches(matchesData || []);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">✨</div>
          <p className="text-muted-foreground">Finding your mood matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-4">
      <div className="max-w-2xl mx-auto pt-12">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{currentMood && getMoodEmoji(currentMood)}</div>
          <h1 className="text-3xl font-bold mb-2">
            {matches.length} {matches.length === 1 ? "person" : "people"} feeling {currentMood}
          </h1>
          <p className="text-muted-foreground">Connect with others who understand</p>
        </div>

        {matches.length > 0 ? (
          <div className="space-y-4 mb-8">
            {matches.slice(0, 5).map((match, idx) => (
              <Card key={match.id} className="p-4 flex items-center gap-4 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  {getMoodEmoji(match.mood)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{match.profiles.display_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(match.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center mb-8">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No matches yet. Be the first to join the chat!
            </p>
          </Card>
        )}

        <Button
          onClick={() => navigate(`/chat/${currentMood}`)}
          className="w-full py-6 text-lg"
          size="lg"
        >
          Join {currentMood} Chat
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <Button
          onClick={() => navigate("/mood-checkin")}
          variant="outline"
          className="w-full mt-4"
        >
          Change Mood
        </Button>
      </div>
    </div>
  );
};

export default MoodMatch;