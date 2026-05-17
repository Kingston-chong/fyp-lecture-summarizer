-- Core app tables (idempotent: safe on fresh DB and when tables already exist from db push).

CREATE TABLE IF NOT EXISTS `Document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Summary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `summarizeFor` VARCHAR(191) NOT NULL,
    `prompt` VARCHAR(191) NULL,
    `output` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SummaryReference` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `summaryId` INTEGER NOT NULL,
    `marker` INTEGER NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `authors` VARCHAR(512) NULL,
    `year` INTEGER NULL,
    `venue` VARCHAR(256) NULL,
    `doi` VARCHAR(128) NULL,
    `url` VARCHAR(2048) NULL,
    `abstract` TEXT NULL,
    `provider` VARCHAR(32) NULL,
    `externalId` VARCHAR(128) NULL,
    `anchorIds` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SummaryReference_summaryId_idx`(`summaryId`),
    UNIQUE INDEX `SummaryReference_summaryId_marker_key`(`summaryId`, `marker`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SummaryHighlight` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `summaryId` INTEGER NOT NULL,
    `quote` VARCHAR(2000) NOT NULL,
    `color` VARCHAR(16) NOT NULL DEFAULT '#fef08a',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SummaryHighlight_summaryId_idx`(`summaryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ChatThread` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `summaryId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChatThread_userId_summaryId_key`(`userId`, `summaryId`),
    INDEX `ChatThread_summaryId_idx`(`summaryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ChatMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `threadId` INTEGER NOT NULL,
    `turn` INTEGER NOT NULL,
    `role` VARCHAR(16) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `modelLabel` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_threadId_idx`(`threadId`),
    UNIQUE INDEX `ChatMessage_threadId_turn_key`(`threadId`, `turn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SummaryDocument` (
    `summaryId` INTEGER NOT NULL,
    `documentId` INTEGER NOT NULL,

    PRIMARY KEY (`summaryId`, `documentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QuizSet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `summaryId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `settings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuizSet_userId_idx`(`userId`),
    INDEX `QuizSet_summaryId_idx`(`summaryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QuizQuestion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quizSetId` INTEGER NOT NULL,
    `question` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `options` JSON NULL,
    `answer` TEXT NOT NULL,
    `explanation` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `QuizQuestion_quizSetId_idx`(`quizSetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Document` ADD CONSTRAINT `Document_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Summary` ADD CONSTRAINT `Summary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SummaryReference` ADD CONSTRAINT `SummaryReference_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SummaryHighlight` ADD CONSTRAINT `SummaryHighlight_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SummaryHighlight` ADD CONSTRAINT `SummaryHighlight_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatThread` ADD CONSTRAINT `ChatThread_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatThread` ADD CONSTRAINT `ChatThread_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `ChatThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SummaryDocument` ADD CONSTRAINT `SummaryDocument_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SummaryDocument` ADD CONSTRAINT `SummaryDocument_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QuizSet` ADD CONSTRAINT `QuizSet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `QuizSet` ADD CONSTRAINT `QuizSet_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `QuizQuestion` ADD CONSTRAINT `QuizQuestion_quizSetId_fkey` FOREIGN KEY (`quizSetId`) REFERENCES `QuizSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
