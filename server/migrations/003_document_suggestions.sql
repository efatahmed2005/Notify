ALTER TABLE document_previews ADD COLUMN suggested_title TEXT NOT NULL DEFAULT '';
ALTER TABLE document_previews ADD COLUMN key_phrases TEXT NOT NULL DEFAULT '[]';
