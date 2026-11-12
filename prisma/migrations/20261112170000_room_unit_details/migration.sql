-- Each room of a room type can have its own photos and description:
-- { "<room name or number>": { "photos": ["https://…"], "description": "…" } }.
ALTER TABLE "room" ADD COLUMN "unitDetails" JSONB NOT NULL DEFAULT '{}';
