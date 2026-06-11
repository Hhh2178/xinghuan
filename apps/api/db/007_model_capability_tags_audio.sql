alter table xh_models drop constraint if exists xh_models_capability_check;
update xh_models set capability = 'chat' where capability = 'text';
alter table xh_models add constraint xh_models_capability_check check (capability in ('chat', 'image', 'video', 'audio'));

alter table xh_models add column if not exists capability_tags jsonb not null default '[]'::jsonb;
alter table xh_models add column if not exists test_state jsonb not null default '{}'::jsonb;

update xh_models
set capability_tags = (
  select jsonb_agg(distinct tag)
  from (
    select jsonb_array_elements_text(coalesce(nullif(capability_tags, '[]'::jsonb), '[]'::jsonb)) as tag
    union all
    select 'text_chat' where capability = 'chat'
    union all
    select 'image_generation' where capability = 'image' and model_id !~* 'edit|image-to-image'
    union all
    select 'image_edit' where capability = 'image' and model_id ~* 'edit|image-to-image'
    union all
    select 'video_generation' where capability = 'video'
    union all
    select 'tts' where capability = 'audio'
    union all
    select 'image_understanding' where capability = 'chat' and model_id ~* '(^|[-_/])vl($|[-_/])|qwen.*vl|vision|visual|omni'
    union all
    select 'video_understanding' where capability = 'chat' and model_id ~* 'video[_-]?understanding|video[_-]?chat|video[_-]?vl|qwen.*vl|omni'
    union all
    select 'reasoning' where capability = 'chat' and model_id ~* 'thinking|reason|reasoning|qwq|r1|deepseek-v4|glm-5\.1'
    union all
    select 'voice_clone' where capability = 'audio' and model_id ~* 'voice[_-]?clone|voiceclone'
    union all
    select 'voice_design' where capability = 'audio' and model_id ~* 'voice[_-]?design|voicedesign'
    union all
    select 'music_generation' where capability = 'audio' and model_id ~* 'suno|music|song'
  ) tags
  where tag is not null
)
where capability_tags = '[]'::jsonb;
