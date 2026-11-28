-- Show advance schedule and day-of-show road logistics on public.agent_signals.
alter table public.agent_signals
  add column if not exists load_in_time text,
  add column if not exists soundcheck_time text,
  add column if not exists doors_time text,
  add column if not exists set_time text,
  add column if not exists curfew_time text,
  add column if not exists venue_address text,
  add column if not exists parking_load_in_notes text,
  add column if not exists production_contact text,
  add column if not exists backline_wifi_notes text,
  add column if not exists guest_list_hospitality text;
