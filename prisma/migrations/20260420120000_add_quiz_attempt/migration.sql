-- CreateTable
CREATE TABLE `QuizAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `quizSetId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `totalQuestions` INTEGER NOT NULL,
    `answers` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuizAttempt_quizSetId_idx`(`quizSetId`),
    INDEX `QuizAttempt_userId_quizSetId_idx`(`userId`, `quizSetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuizAttempt` ADD CONSTRAINT `QuizAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizAttempt` ADD CONSTRAINT `QuizAttempt_quizSetId_fkey` FOREIGN KEY (`quizSetId`) REFERENCES `QuizSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
