-- Quiz sets are always created for a summary; drop orphans before NOT NULL.
DELETE FROM `QuizSet` WHERE `summaryId` IS NULL;

-- Replace SET NULL with CASCADE on summary delete (matches Prisma schema).
ALTER TABLE `QuizSet` DROP FOREIGN KEY `QuizSet_summaryId_fkey`;

ALTER TABLE `QuizSet` MODIFY `summaryId` INTEGER NOT NULL;

ALTER TABLE `QuizSet` ADD CONSTRAINT `QuizSet_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
