alter table xh_users
  add column if not exists password_cipher text;
