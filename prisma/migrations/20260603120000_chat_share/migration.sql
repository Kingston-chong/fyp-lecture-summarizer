-- CreateTable
CREATE TABLE `ChatShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `summaryId` INTEGER NOT NULL,
    `shareToken` VARCHAR(64) NOT NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChatShare_summaryId_key`(`summaryId`),
    UNIQUE INDEX `ChatShare_shareToken_key`(`shareToken`),
    INDEX `ChatShare_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChatShare` ADD CONSTRAINT `ChatShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatShare` ADD CONSTRAINT `ChatShare_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
