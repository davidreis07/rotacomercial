-- Fundacao server-side para sincronizacao offline-first.
-- Migration aditiva: preserva RLS e os dados existentes.

-- A migration depende de chaves UUID para permitir criacao offline. Como o
-- schema historico ainda nao possui baseline no repositorio, aborta antes de
-- qualquer alteracao caso o banco real seja diferente.
do $$
declare
  invalid_column text;
begin
  select format('%I.%I', expected.table_name, expected.column_name)
  into invalid_column
  from (values
    ('clientes', 'id'),
    ('clientes', 'user_id'),
    ('visitas', 'id'),
    ('visitas', 'user_id'),
    ('visitas', 'cliente_id'),
    ('planejamento', 'id'),
    ('planejamento', 'user_id'),
    ('planejamento', 'cliente_id')
  ) as expected(table_name, column_name)
  left join information_schema.columns as columns
    on columns.table_schema = 'public'
   and columns.table_name = expected.table_name
   and columns.column_name = expected.column_name
   and columns.data_type = 'uuid'
  where columns.column_name is null
  limit 1;

  if invalid_column is not null then
    raise exception 'sync foundation requires UUID column: %', invalid_column;
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.clientes
  add column if not exists updated_at timestamptz,
  add column if not exists version bigint;

alter table public.visitas
  add column if not exists updated_at timestamptz,
  add column if not exists version bigint,
  add column if not exists planejamento_id uuid;

alter table public.planejamento
  add column if not exists updated_at timestamptz,
  add column if not exists version bigint;

update public.clientes
set updated_at = coalesce(updated_at, created_at, now()),
    version = coalesce(version, 1)
where updated_at is null or version is null;

update public.visitas
set updated_at = coalesce(updated_at, created_at, now()),
    version = coalesce(version, 1)
where updated_at is null or version is null;

update public.planejamento
set updated_at = coalesce(updated_at, created_at, now()),
    version = coalesce(version, 1)
where updated_at is null or version is null;

alter table public.clientes
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column version set default 1,
  alter column version set not null;

alter table public.visitas
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column version set default 1,
  alter column version set not null;

alter table public.planejamento
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column version set default 1,
  alter column version set not null;

create or replace function private.set_sync_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists clientes_set_sync_version on public.clientes;
create trigger clientes_set_sync_version
before update on public.clientes
for each row execute function private.set_sync_version();

drop trigger if exists visitas_set_sync_version on public.visitas;
create trigger visitas_set_sync_version
before update on public.visitas
for each row execute function private.set_sync_version();

drop trigger if exists planejamento_set_sync_version on public.planejamento;
create trigger planejamento_set_sync_version
before update on public.planejamento
for each row execute function private.set_sync_version();

-- Falha de forma segura antes das constraints se houver legado invalido.
do $$
begin
  if exists (
    select 1
    from public.planejamento
    group by user_id, data, ordem
    having count(*) > 1
  ) then
    raise exception 'planejamento possui ordens duplicadas por usuario/data';
  end if;

  if exists (
    select 1
    from public.planejamento
    where ordem < 1
       or status not in ('planejado', 'visitado', 'cancelado')
  ) then
    raise exception 'planejamento possui ordem ou status invalido';
  end if;

  if exists (
    select 1
    from public.clientes
    where (latitude is null) <> (longitude is null)
       or latitude not between -90 and 90
       or longitude not between -180 and 180
  ) then
    raise exception 'clientes possui coordenadas incompletas ou invalidas';
  end if;
end;
$$;

alter table public.clientes
  drop constraint if exists clientes_localizacao_completa_check,
  add constraint clientes_localizacao_completa_check check (
    (latitude is null and longitude is null)
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  );

alter table public.planejamento
  drop constraint if exists planejamento_ordem_positiva_check,
  add constraint planejamento_ordem_positiva_check check (ordem >= 1),
  drop constraint if exists planejamento_status_check,
  add constraint planejamento_status_check check (
    status in ('planejado', 'visitado', 'cancelado')
  );

alter table public.clientes
  drop constraint if exists clientes_user_id_id_key,
  add constraint clientes_user_id_id_key unique (user_id, id);

alter table public.planejamento
  drop constraint if exists planejamento_user_id_id_key,
  add constraint planejamento_user_id_id_key unique (user_id, id),
  drop constraint if exists planejamento_user_data_ordem_key,
  add constraint planejamento_user_data_ordem_key
    unique (user_id, data, ordem) deferrable initially deferred;

alter table public.visitas
  drop constraint if exists visitas_user_cliente_fkey,
  add constraint visitas_user_cliente_fkey
    foreign key (user_id, cliente_id)
    references public.clientes (user_id, id) not valid,
  drop constraint if exists visitas_user_planejamento_fkey,
  add constraint visitas_user_planejamento_fkey
    foreign key (user_id, planejamento_id)
    references public.planejamento (user_id, id) not valid;

alter table public.planejamento
  drop constraint if exists planejamento_user_cliente_fkey,
  add constraint planejamento_user_cliente_fkey
    foreign key (user_id, cliente_id)
    references public.clientes (user_id, id) not valid;

create table if not exists public.sync_changes (
  cursor bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('cliente', 'visita', 'planejamento')),
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'delete')),
  entity_version bigint,
  changed_at timestamptz not null default now()
);

create index if not exists sync_changes_user_cursor_idx
  on public.sync_changes (user_id, cursor);

alter table public.sync_changes enable row level security;
drop policy if exists sync_changes_select_own on public.sync_changes;
create policy sync_changes_select_own
on public.sync_changes
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.sync_changes from anon, authenticated;
grant select on public.sync_changes to authenticated;

create or replace function private.record_sync_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  entity_name text;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  entity_name := case tg_table_name
    when 'clientes' then 'cliente'
    when 'visitas' then 'visita'
    when 'planejamento' then 'planejamento'
  end;

  insert into public.sync_changes (
    user_id, entity_type, entity_id, operation, entity_version
  ) values (
    (row_data ->> 'user_id')::uuid,
    entity_name,
    (row_data ->> 'id')::uuid,
    case when tg_op = 'DELETE' then 'delete' else 'upsert' end,
    case
      when tg_op = 'DELETE' then null
      else (row_data ->> 'version')::bigint
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists clientes_record_sync_change on public.clientes;
create trigger clientes_record_sync_change
after insert or update or delete on public.clientes
for each row execute function private.record_sync_change();

drop trigger if exists visitas_record_sync_change on public.visitas;
create trigger visitas_record_sync_change
after insert or update or delete on public.visitas
for each row execute function private.record_sync_change();

drop trigger if exists planejamento_record_sync_change on public.planejamento;
create trigger planejamento_record_sync_change
after insert or update or delete on public.planejamento
for each row execute function private.record_sync_change();

create table if not exists private.processed_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  operation_type text not null,
  request_hash text not null,
  response jsonb,
  processed_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

create table if not exists public.rota_estado (
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  version bigint not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, data)
);

insert into public.rota_estado (user_id, data)
select distinct user_id, data
from public.planejamento
on conflict (user_id, data) do nothing;

alter table public.rota_estado enable row level security;
drop policy if exists rota_estado_select_own on public.rota_estado;
create policy rota_estado_select_own
on public.rota_estado
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.rota_estado from anon, authenticated;
grant select on public.rota_estado to authenticated;

create or replace function private.bump_rota_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  route_date date;
begin
  owner_id := coalesce(new.user_id, old.user_id);
  route_date := coalesce(new.data, old.data);

  insert into public.rota_estado (user_id, data, version, updated_at)
  values (owner_id, route_date, 1, clock_timestamp())
  on conflict (user_id, data) do update
    set version = public.rota_estado.version + 1,
        updated_at = excluded.updated_at;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists planejamento_bump_rota_version on public.planejamento;
create trigger planejamento_bump_rota_version
after insert or update or delete on public.planejamento
for each row execute function private.bump_rota_version();

create or replace function public.registrar_visita_e_concluir_planejamento(
  p_operation_id uuid,
  p_visita_id uuid,
  p_cliente_id uuid,
  p_visitado_em timestamptz,
  p_resultado text default null,
  p_necessidade text default null,
  p_observacoes text default null,
  p_planejamento_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_fingerprint text;
  previous private.processed_operations%rowtype;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  request_fingerprint := md5(jsonb_build_object(
    'visita_id', p_visita_id,
    'cliente_id', p_cliente_id,
    'visitado_em', p_visitado_em,
    'resultado', p_resultado,
    'necessidade', p_necessidade,
    'observacoes', p_observacoes,
    'planejamento_id', p_planejamento_id
  )::text);

  insert into private.processed_operations (
    user_id, operation_id, operation_type, request_hash
  ) values (
    current_user_id, p_operation_id, 'registrar_visita', request_fingerprint
  )
  on conflict (user_id, operation_id) do nothing;

  if not found then
    select * into previous
    from private.processed_operations
    where user_id = current_user_id
      and operation_id = p_operation_id;

    if previous.operation_type <> 'registrar_visita'
       or previous.request_hash <> request_fingerprint then
      raise exception 'operation_id already used with another request'
        using errcode = '22023';
    end if;

    return previous.response;
  end if;

  if not exists (
    select 1 from public.clientes
    where id = p_cliente_id and user_id = current_user_id
  ) then
    raise exception 'cliente not found' using errcode = 'P0002';
  end if;

  if p_planejamento_id is not null then
    if not exists (
      select 1 from public.planejamento
      where id = p_planejamento_id
        and user_id = current_user_id
        and cliente_id = p_cliente_id
    ) then
      raise exception 'planejamento not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.visitas (
    id, user_id, cliente_id, planejamento_id, visitado_em,
    resultado, necessidade, observacoes
  ) values (
    p_visita_id, current_user_id, p_cliente_id, p_planejamento_id,
    p_visitado_em, p_resultado, p_necessidade, p_observacoes
  );

  if p_planejamento_id is not null then
    update public.planejamento
    set status = 'visitado'
    where id = p_planejamento_id
      and user_id = current_user_id;
  end if;

  result := jsonb_build_object(
    'visita_id', p_visita_id,
    'planejamento_id', p_planejamento_id,
    'planejamento_status', case
      when p_planejamento_id is null then null
      else 'visitado'
    end
  );

  update private.processed_operations
  set response = result
  where user_id = current_user_id
    and operation_id = p_operation_id;

  return result;
end;
$$;

create or replace function public.reordenar_rota(
  p_operation_id uuid,
  p_data date,
  p_expected_version bigint,
  p_ordered_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_version bigint;
  request_fingerprint text;
  previous private.processed_operations%rowtype;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  request_fingerprint := md5(jsonb_build_object(
    'data', p_data,
    'expected_version', p_expected_version,
    'ordered_ids', p_ordered_ids
  )::text);

  insert into private.processed_operations (
    user_id, operation_id, operation_type, request_hash
  ) values (
    current_user_id, p_operation_id, 'reordenar_rota', request_fingerprint
  )
  on conflict (user_id, operation_id) do nothing;

  if not found then
    select * into previous
    from private.processed_operations
    where user_id = current_user_id
      and operation_id = p_operation_id;

    if previous.operation_type <> 'reordenar_rota'
       or previous.request_hash <> request_fingerprint then
      raise exception 'operation_id already used with another request'
        using errcode = '22023';
    end if;

    return previous.response;
  end if;

  insert into public.rota_estado (user_id, data)
  values (current_user_id, p_data)
  on conflict (user_id, data) do nothing;

  select version into current_version
  from public.rota_estado
  where user_id = current_user_id and data = p_data
  for update;

  if current_version <> p_expected_version then
    raise exception 'route version conflict' using errcode = '40001';
  end if;

  if cardinality(p_ordered_ids) <> (
      select count(*) from public.planejamento
      where user_id = current_user_id and data = p_data
    )
    or cardinality(p_ordered_ids) <> (
      select count(distinct route_id)
      from unnest(p_ordered_ids) as ordered_route(route_id)
    )
    or exists (
      select 1
      from unnest(p_ordered_ids) as ordered_route(route_id)
      where not exists (
        select 1 from public.planejamento
        where id = route_id
          and user_id = current_user_id
          and data = p_data
      )
    ) then
    raise exception 'ordered_ids must contain the complete route exactly once'
      using errcode = '22023';
  end if;

  set constraints planejamento_user_data_ordem_key deferred;

  update public.planejamento as planejamento
  set ordem = array_position(p_ordered_ids, planejamento.id)
  where planejamento.user_id = current_user_id
    and planejamento.data = p_data;

  select version into current_version
  from public.rota_estado
  where user_id = current_user_id and data = p_data;

  result := jsonb_build_object(
    'data', p_data,
    'version', current_version,
    'ordered_ids', p_ordered_ids
  );

  update private.processed_operations
  set response = result
  where user_id = current_user_id
    and operation_id = p_operation_id;

  return result;
end;
$$;

create or replace function public.remover_planejamento(
  p_operation_id uuid,
  p_planejamento_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  route_date date;
  removed_order integer;
  current_version bigint;
  request_fingerprint text;
  previous private.processed_operations%rowtype;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  request_fingerprint := md5(jsonb_build_object(
    'planejamento_id', p_planejamento_id,
    'expected_version', p_expected_version
  )::text);

  insert into private.processed_operations (
    user_id, operation_id, operation_type, request_hash
  ) values (
    current_user_id, p_operation_id, 'remover_planejamento', request_fingerprint
  )
  on conflict (user_id, operation_id) do nothing;

  if not found then
    select * into previous
    from private.processed_operations
    where user_id = current_user_id
      and operation_id = p_operation_id;

    if previous.operation_type <> 'remover_planejamento'
       or previous.request_hash <> request_fingerprint then
      raise exception 'operation_id already used with another request'
        using errcode = '22023';
    end if;

    return previous.response;
  end if;

  select data, ordem into route_date, removed_order
  from public.planejamento
  where id = p_planejamento_id
    and user_id = current_user_id
  for update;

  if not found then
    raise exception 'planejamento not found' using errcode = 'P0002';
  end if;

  select version into current_version
  from public.rota_estado
  where user_id = current_user_id and data = route_date
  for update;

  if current_version <> p_expected_version then
    raise exception 'route version conflict' using errcode = '40001';
  end if;

  set constraints planejamento_user_data_ordem_key deferred;

  delete from public.planejamento
  where id = p_planejamento_id
    and user_id = current_user_id;

  update public.planejamento
  set ordem = ordem - 1
  where user_id = current_user_id
    and data = route_date
    and ordem > removed_order;

  select version into current_version
  from public.rota_estado
  where user_id = current_user_id and data = route_date;

  result := jsonb_build_object(
    'planejamento_id', p_planejamento_id,
    'data', route_date,
    'version', current_version
  );

  update private.processed_operations
  set response = result
  where user_id = current_user_id
    and operation_id = p_operation_id;

  return result;
end;
$$;

revoke all on function public.registrar_visita_e_concluir_planejamento(
  uuid, uuid, uuid, timestamptz, text, text, text, uuid
) from public, anon;
grant execute on function public.registrar_visita_e_concluir_planejamento(
  uuid, uuid, uuid, timestamptz, text, text, text, uuid
) to authenticated;

revoke all on function public.reordenar_rota(
  uuid, date, bigint, uuid[]
) from public, anon;
grant execute on function public.reordenar_rota(
  uuid, date, bigint, uuid[]
) to authenticated;

revoke all on function public.remover_planejamento(
  uuid, uuid, bigint
) from public, anon;
grant execute on function public.remover_planejamento(
  uuid, uuid, bigint
) to authenticated;
