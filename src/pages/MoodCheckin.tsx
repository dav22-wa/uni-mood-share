import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const moods = [
  { name: "happy", emoji: "😊", color: "bg-[hsl(var(--mood-happy))]" },
  { name: "stressed", emoji: "😰", color: "bg-[hsl(var(--mood-stressed))]" },
  { name: "lonely", emoji: "😔", color: "bg-[hsl(var(--mood-lonely))]" },
  { name: "excited", emoji: "🤩", color: "bg-[hsl(var(--mood-excited))]" },
  { name: "tired", emoji: "😴", color: "bg-[hsl(var(--mood-tired))]" },
];

const MoodCheckin = () => {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!selectedMood) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("mood_checkins")
        .insert({ user_id: user.id, mood: selectedMood as any });

      if (error) throw error;

      toast({
        title: "Mood recorded!",
        description: "Finding others who feel the same...",
      });

      navigate("/group-chat");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-4">
      <div className="max-w-2xl mx-auto pt-12">
        <h1 className="text-3xl font-bold text-center mb-2">How are you feeling today?</h1>
        <p className="text-center text-muted-foreground mb-12">
          Select your current mood to connect with others
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {moods.map((mood) => (
            <button
              key={mood.name}
              onClick={() => setSelectedMood(mood.name)}
              className={`${mood.color} rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all duration-200 ${
                selectedMood === mood.name
                  ? "scale-105 shadow-xl ring-4 ring-primary"
                  : "hover:scale-105 shadow-lg"
              }`}
            >
              <span className="text-6xl">{mood.emoji}</span>
              <span className="text-lg font-semibold capitalize text-white">
                {mood.name}
              </span>
            </button>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!selectedMood || loading}
          className="w-full max-w-md mx-auto block py-6 text-lg"
          size="lg"
        >
          {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
};

export default MoodCheckin;