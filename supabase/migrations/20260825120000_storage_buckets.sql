-- 20260825120000_storage_buckets
-- Buckets de imagens. Ver docs/08-storage.md
--
-- Ambos PRIVADOS. São fotos de menores de idade: nada de URL pública adivinhável.
-- O acesso se dá por URLs assinadas geradas no servidor, sempre depois de o
-- Route Handler / Server Action já ter autorizado quem pediu.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('candidate-photos', 'candidate-photos', false, 262144,
   array['image/webp', 'image/jpeg', 'image/png']),
  ('student-photos', 'student-photos', false, 262144,
   array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nenhuma política é criada em storage.objects.
--
-- Isso é deliberado: anon e authenticated ficam sem qualquer acesso, e as duas
-- operações que a aplicação precisa continuam funcionando porque não dependem
-- de RLS — o upload passa pelo servidor com service_role, e a leitura usa URL
-- assinada, que carrega a própria autorização.
--
-- O limite de 256 KB por objeto é a segunda barreira do redimensionamento feito
-- no navegador (400x400 WebP, ~50 KB). Um cliente adulterado esbarra aqui.
