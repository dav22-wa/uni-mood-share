import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceState {
  [key: string]: {
    user_id: string;
    online_at: string;
  }[];
}

export const usePresence = (channelName: string) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const presenceChannel = supabase.channel(channelName, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state: PresenceState = presenceChannel.presenceState();
          const users = new Set<string>();
          
          Object.keys(state).forEach((key) => {
            state[key].forEach((presence) => {
              users.add(presence.user_id);
            });
          });
          
          setOnlineUsers(users);
          console.log('Online users synced:', Array.from(users));
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('User joined:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('User left:', key, leftPresences);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
            console.log('Presence tracked for user:', user.id);
          }
        });

      setChannel(presenceChannel);
    };

    setupPresence();

    return () => {
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
    };
  }, [channelName]);

  const isUserOnline = (userId: string) => {
    return onlineUsers.has(userId);
  };

  return { onlineUsers, isUserOnline };
};
