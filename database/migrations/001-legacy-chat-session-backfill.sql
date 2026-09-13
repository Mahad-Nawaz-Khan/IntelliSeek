-- One-time backfill: give chat_history rows a chat session.
--
-- Run this ONLY on databases created before chat sessions existed (rows in
-- public.chat_history with a null chat_session_id). Fresh deployments get the
-- column populated by the application and must skip this file. schema.sql no
-- longer contains this block: re-running a data backfill inside the main
-- schema risked creating a second session per history row whenever the
-- link-up query failed to match.

insert into public.chat_sessions (id, user_id, title, title_status, created_at, updated_at)
select
  gen_random_uuid(),
  chat_history.user_id,
  left(regexp_replace(chat_history.question, '\s+', ' ', 'g'), 80),
  'fallback',
  chat_history.created_at,
  chat_history.created_at
from public.chat_history
where chat_history.chat_session_id is null
  and chat_history.user_id is not null;

update public.chat_history
set chat_session_id = legacy_sessions.id
from (
  select distinct on (chat_history.id)
    chat_history.id as history_id,
    chat_sessions.id
  from public.chat_history
  join public.chat_sessions
    on chat_sessions.user_id = chat_history.user_id
   and chat_sessions.created_at = chat_history.created_at
   and chat_sessions.title = left(regexp_replace(chat_history.question, '\s+', ' ', 'g'), 80)
  where chat_history.chat_session_id is null
  order by chat_history.id, chat_sessions.id
) as legacy_sessions
where chat_history.id = legacy_sessions.history_id;
