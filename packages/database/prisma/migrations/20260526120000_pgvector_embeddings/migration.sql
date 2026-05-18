CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "EmbeddingDocument" ADD COLUMN IF NOT EXISTS "embeddingVector" vector(1536);

CREATE INDEX IF NOT EXISTS "EmbeddingDocument_embeddingVector_ivfflat_idx"
  ON "EmbeddingDocument"
  USING ivfflat ("embeddingVector" vector_cosine_ops)
  WITH (lists = 100);
