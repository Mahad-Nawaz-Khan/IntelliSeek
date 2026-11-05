-- ============================================================
-- Migration 002: Precision Retrieval Upgrade
-- Adds document_keyphrases, micro_chunks, fulltext search, and RPC functions.
-- ============================================================

-- 1. Keyphrases Table (Part A1)
create table if not exists public.document_keyphrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  phrase text not null check (length(trim(phrase)) > 0 and length(phrase) <= 80),
  score numeric not null default 0 check (score >= 0),
  source text not null default 'frequency'
    check (source in ('definition', 'capitalized', 'acronym', 'frequency')),
  created_at timestamptz not null default now(),
  unique (document_id, phrase)
);

create index if not exists document_keyphrases_user_id_idx
  on public.document_keyphrases(user_id);
create index if not exists document_keyphrases_document_id_idx
  on public.document_keyphrases(document_id);
create index if not exists document_keyphrases_phrase_lower_idx
  on public.document_keyphrases(lower(phrase));

alter table public.document_keyphrases enable row level security;

drop policy if exists "document_keyphrases_select_own" on public.document_keyphrases;
create policy "document_keyphrases_select_own"
  on public.document_keyphrases for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.documents
      where documents.id = document_keyphrases.document_id
        and documents.source_scope = 'knowledge_base'
    )
  );

drop policy if exists "document_keyphrases_service_manage_all" on public.document_keyphrases;
create policy "document_keyphrases_service_manage_all"
  on public.document_keyphrases for all to service_role
  using (true) with check (true);

-- 2. Micro-Chunks Table (Part B1)
create table if not exists public.micro_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  parent_chunk_id uuid references public.chunks(id) on delete cascade,
  text_content text not null check (length(trim(text_content)) > 0),
  chunk_index integer not null check (chunk_index >= 0),
  embedding extensions.vector(1024),
  created_at timestamptz not null default now()
);

create index if not exists micro_chunks_document_id_idx on public.micro_chunks(document_id);
create index if not exists micro_chunks_parent_chunk_id_idx on public.micro_chunks(parent_chunk_id);
create index if not exists micro_chunks_embedding_hnsw_idx on public.micro_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.micro_chunks enable row level security;

drop policy if exists "micro_chunks_select_own" on public.micro_chunks;
create policy "micro_chunks_select_own"
  on public.micro_chunks for select to authenticated
  using (
    exists (
      select 1 from public.documents
      where documents.id = micro_chunks.document_id
        and (documents.user_id = auth.uid() or documents.source_scope = 'knowledge_base')
    )
  );

drop policy if exists "micro_chunks_service_manage_all" on public.micro_chunks;
create policy "micro_chunks_service_manage_all"
  on public.micro_chunks for all to service_role
  using (true) with check (true);

-- 3. Full-Text Search on Chunks (Part B4)
alter table public.chunks add column if not exists search_vector tsvector;

create or replace function chunks_update_search_vector()
returns trigger as $$
begin
  NEW.search_vector := to_tsvector('english', NEW.text_content);
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists chunks_search_vector_trigger on public.chunks;
create trigger chunks_search_vector_trigger
  before insert or update of text_content on public.chunks
  for each row execute function chunks_update_search_vector();

update public.chunks set search_vector = to_tsvector('english', text_content)
where search_vector is null;

create index if not exists chunks_search_vector_gin_idx
  on public.chunks using gin (search_vector);

-- 4. RPC Functions: match_user_micro_chunks and fulltext_search_chunks
create or replace function public.match_user_micro_chunks(
  query_embedding extensions.vector(1024),
  match_user_id uuid,
  match_count int default 10,
  match_document_ids uuid[] default null
)
returns table (
  micro_chunk_id uuid,
  parent_chunk_id uuid,
  document_id uuid,
  filename text,
  micro_text text,
  parent_text text,
  chunk_index integer,
  similarity float
)
language sql stable
set search_path = public, extensions, pg_temp
as $$
  select
    mc.id as micro_chunk_id,
    mc.parent_chunk_id,
    mc.document_id,
    d.filename,
    mc.text_content as micro_text,
    c.text_content as parent_text,
    c.chunk_index,
    1 - (mc.embedding <=> query_embedding) as similarity
  from public.micro_chunks mc
  join public.chunks c on c.id = mc.parent_chunk_id
  join public.documents d on d.id = mc.document_id
  where (d.user_id = match_user_id or d.source_scope = 'knowledge_base')
    and d.processing_status = 'indexed'
    and mc.embedding is not null
    and (match_document_ids is null or mc.document_id = any(match_document_ids))
  order by mc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 200);
$$;

create or replace function public.fulltext_search_chunks(
  search_query text,
  match_user_id uuid,
  match_count int default 10,
  match_document_ids uuid[] default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  filename text,
  text_content text,
  chunk_index integer,
  rank float
)
language sql stable
set search_path = public, extensions, pg_temp
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.filename,
    c.text_content,
    c.chunk_index,
    ts_rank_cd(c.search_vector, websearch_to_tsquery('english', search_query)) as rank
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where (d.user_id = match_user_id or d.source_scope = 'knowledge_base')
    and d.processing_status = 'indexed'
    and c.search_vector @@ websearch_to_tsquery('english', search_query)
    and (match_document_ids is null or c.document_id = any(match_document_ids))
  order by rank desc
  limit least(greatest(match_count, 1), 50);
$$;

