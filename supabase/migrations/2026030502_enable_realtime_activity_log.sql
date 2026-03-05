-- Enable Supabase Realtime on activity_log for live dashboard activity feed
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
