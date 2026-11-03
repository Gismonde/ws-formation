-- Fichiers audio (narration enregistrée) dans l'espace privé des médias de formation
UPDATE storage.buckets
SET allowed_mime_types = ARRAY(SELECT DISTINCT unnest(coalesce(allowed_mime_types, '{}') || ARRAY[
  'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/webm'
]))
WHERE id = 'formation-medias';
