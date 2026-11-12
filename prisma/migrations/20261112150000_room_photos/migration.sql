-- Photos for each room type (lodges show a page per room type and per room).
ALTER TABLE "room" ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
