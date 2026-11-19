CREATE TABLE "User" ("id" TEXT NOT NULL,"discordId" TEXT NOT NULL,"username" TEXT NOT NULL,"avatar" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "User_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Bot" ("id" TEXT NOT NULL,"ownerId" TEXT NOT NULL,"name" TEXT NOT NULL,"runtime" TEXT NOT NULL,"entrypoint" TEXT NOT NULL,"sourcePath" TEXT,"tokenCipher" TEXT,"status" TEXT NOT NULL DEFAULT 'stopped',"workerId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Bot_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
CREATE INDEX "Bot_ownerId_idx" ON "Bot"("ownerId");
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
