-- AlterTable
ALTER TABLE `QuizSet` ADD COLUMN `published` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `QuizSet` ADD COLUMN `shareToken` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `QuizSet_shareToken_key` ON `QuizSet`(`shareToken`);
