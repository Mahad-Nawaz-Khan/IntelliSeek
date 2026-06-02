create extension if not exists "pgcrypto";
create extension if not exists vector with schema extensions;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  filename text not null check (length(trim(filename)) > 0),
  file_type text not null check (file_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pdf', 'docx', 'txt', 'md', 'pptx')),
  file_size bigint not null check (file_size >= 0),
  storage_path text not null check (length(trim(storage_path)) > 0),
  source_scope text not null default 'personal' check (source_scope in ('personal', 'knowledge_base')),
  processing_status text not null default 'uploaded' check (processing_status in ('uploaded', 'queued', 'processing', 'indexed', 'failed')),
  processing_error text,
  indexed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  text_content text not null check (length(trim(text_content)) > 0),
  chunk_index integer not null check (chunk_index >= 0),
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  chat_session_id uuid,
  question text not null check (length(trim(question)) > 0),
  answer text not null check (length(trim(answer)) > 0),
  sources_cited jsonb not null default '[]'::jsonb check (jsonb_typeof(sources_cited) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  title_status text not null default 'pending' check (title_status in ('pending', 'generated', 'fallback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_history add column if not exists chat_session_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_history_chat_session_id_fkey'
      and conrelid = 'public.chat_history'::regclass
  ) then
    alter table public.chat_history
      add constraint chat_history_chat_session_id_fkey
      foreign key (chat_session_id) references public.chat_sessions(id) on delete cascade;
  end if;
end $$;

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

create table if not exists public.document_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  topic text not null check (length(trim(topic)) > 0 and length(topic) <= 80),
  frequency integer not null default 1 check (frequency > 0),
  score numeric not null default 0 check (score >= 0),
  source_chunk_id uuid references public.chunks(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, topic)
);

alter table public.documents drop constraint if exists documents_user_id_fkey;
alter table public.documents add column if not exists source_scope text not null default 'personal';
alter table public.documents add column if not exists processing_status text not null default 'uploaded';
alter table public.documents add column if not exists processing_error text;
alter table public.documents add column if not exists indexed_at timestamptz;
alter table public.documents drop constraint if exists documents_processing_status_check;
alter table public.documents add constraint documents_processing_status_check check (processing_status in ('uploaded', 'queued', 'processing', 'indexed', 'failed'));
alter table public.documents drop constraint if exists documents_source_scope_check;
alter table public.documents add constraint documents_source_scope_check check (source_scope in ('personal', 'knowledge_base'));

create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_source_scope_idx on public.documents(source_scope);
create index if not exists documents_processing_status_idx on public.documents(processing_status);
create index if not exists chunks_document_id_idx on public.chunks(document_id);
create index if not exists chunks_embedding_hnsw_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists chat_history_user_id_idx on public.chat_history(user_id);
create index if not exists chat_sessions_user_updated_idx on public.chat_sessions(user_id, updated_at desc);
create index if not exists chat_history_user_session_created_idx on public.chat_history(user_id, chat_session_id, created_at);
create index if not exists document_topics_user_id_idx on public.document_topics(user_id);
create index if not exists document_topics_document_id_idx on public.document_topics(document_id);
create index if not exists document_topics_topic_lower_idx on public.document_topics(lower(topic));
create index if not exists document_topics_user_score_idx on public.document_topics(user_id, score desc);

create or replace function public.match_user_chunks(
  query_embedding extensions.vector(1024),
  match_user_id uuid,
  match_count int default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  filename text,
  text_content text,
  chunk_index integer,
  similarity float
)
language sql
stable
as $$
  select
    chunks.id as chunk_id,
    chunks.document_id,
    documents.filename,
    chunks.text_content,
    chunks.chunk_index,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.chunks
  join public.documents on documents.id = chunks.document_id
  where (documents.user_id = match_user_id or documents.source_scope = 'knowledge_base')
    and chunks.embedding is not null
  order by chunks.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_history enable row level security;
alter table public.document_topics enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using (auth.uid() = user_id or source_scope = 'knowledge_base');

drop policy if exists "documents_service_manage_all" on public.documents;
create policy "documents_service_manage_all"
  on public.documents for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
  on public.documents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chunks_select_own_document" on public.chunks;
create policy "chunks_select_own_document"
  on public.chunks for select
  to authenticated
  using (
    exists (
      select 1
      from public.documents
      where documents.id = chunks.document_id
        and (documents.user_id = auth.uid() or documents.source_scope = 'knowledge_base')
    )
  );

drop policy if exists "chunks_service_manage_all" on public.chunks;
create policy "chunks_service_manage_all"
  on public.chunks for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "chunks_insert_own_document" on public.chunks;
create policy "chunks_insert_own_document"
  on public.chunks for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.documents
      where documents.id = chunks.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "chunks_update_own_document" on public.chunks;
create policy "chunks_update_own_document"
  on public.chunks for update
  to authenticated
  using (
    exists (
      select 1
      from public.documents
      where documents.id = chunks.document_id
        and documents.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.documents
      where documents.id = chunks.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "chunks_delete_own_document" on public.chunks;
create policy "chunks_delete_own_document"
  on public.chunks for delete
  to authenticated
  using (
    exists (
      select 1
      from public.documents
      where documents.id = chunks.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "document_topics_select_own" on public.document_topics;
create policy "document_topics_select_own"
  on public.document_topics for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.documents
      where documents.id = document_topics.document_id
        and documents.source_scope = 'knowledge_base'
    )
  );

drop policy if exists "document_topics_service_manage_all" on public.document_topics;
create policy "document_topics_service_manage_all"
  on public.document_topics for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "document_topics_insert_own_document" on public.document_topics;
create policy "document_topics_insert_own_document"
  on public.document_topics for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.documents
      where documents.id = document_topics.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "document_topics_update_own_document" on public.document_topics;
create policy "document_topics_update_own_document"
  on public.document_topics for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.documents
      where documents.id = document_topics.document_id
        and documents.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.documents
      where documents.id = document_topics.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "document_topics_delete_own_document" on public.document_topics;
create policy "document_topics_delete_own_document"
  on public.document_topics for delete
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.documents
      where documents.id = document_topics.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "chat_history_select_own" on public.chat_history;

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own"
  on public.chat_sessions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own"
  on public.chat_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own"
  on public.chat_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own"
  on public.chat_sessions for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chat_sessions_service_manage_all" on public.chat_sessions;
create policy "chat_sessions_service_manage_all"
  on public.chat_sessions for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "chat_history_select_own" on public.chat_history;
create policy "chat_history_select_own"
  on public.chat_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chat_history_insert_own" on public.chat_history;
create policy "chat_history_insert_own"
  on public.chat_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "chat_history_update_own" on public.chat_history;
create policy "chat_history_update_own"
  on public.chat_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chat_history_delete_own" on public.chat_history;
create policy "chat_history_delete_own"
  on public.chat_history for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academic-documents',
  'academic-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/markdown'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "academic_documents_authenticated_upload" on storage.objects;
create policy "academic_documents_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'academic-documents'
    and owner = auth.uid()
  );

drop policy if exists "academic_documents_demo_upload" on storage.objects;
create policy "academic_documents_demo_upload"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'academic-documents'
    and (storage.foldername(name))[1] = '00000000-0000-4000-8000-000000000001'
  );

drop policy if exists "academic_documents_authenticated_read" on storage.objects;
create policy "academic_documents_authenticated_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'academic-documents'
    and owner = auth.uid()
  );

-- If public PDF rendering is required later, make that decision explicit before changing bucket.public or adding public read policies.
-- Verification: confirm public.documents, public.chunks, public.chat_history exist and have RLS enabled.
-- Verification: confirm public.chunks.document_id cascades to public.documents.id.
-- Verification: confirm public.chunks.embedding is extensions.vector(1024) for pgvector search.
-- Verification: confirm storage bucket academic-documents exists with PDF, DOCX, TXT, and PPTX MIME types only.
