-- AlterTable
ALTER TABLE `QuizSet` ADD COLUMN `closesAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `QuizAttempt` ADD COLUMN `respondentLabel` VARCHAR(120) NULL;
