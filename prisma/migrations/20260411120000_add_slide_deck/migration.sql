-- CreateTable
CREATE TABLE `SlideDeck` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `summaryId` INTEGER NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `alaiGenerationId` VARCHAR(128) NOT NULL,
    `pptxUrl` VARCHAR(2048) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SlideDeck_summaryId_idx`(`summaryId`),
    INDEX `SlideDeck_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SlideDeck` ADD CONSTRAINT `SlideDeck_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlideDeck` ADD CONSTRAINT `SlideDeck_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
