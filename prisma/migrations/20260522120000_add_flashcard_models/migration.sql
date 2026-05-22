-- CreateTable
CREATE TABLE `FlashcardSet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `summaryId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `settings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FlashcardSet_userId_idx`(`userId`),
    INDEX `FlashcardSet_summaryId_idx`(`summaryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Flashcard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `flashcardSetId` INTEGER NOT NULL,
    `front` TEXT NOT NULL,
    `back` TEXT NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `Flashcard_flashcardSetId_idx`(`flashcardSetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FlashcardSet` ADD CONSTRAINT `FlashcardSet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashcardSet` ADD CONSTRAINT `FlashcardSet_summaryId_fkey` FOREIGN KEY (`summaryId`) REFERENCES `Summary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Flashcard` ADD CONSTRAINT `Flashcard_flashcardSetId_fkey` FOREIGN KEY (`flashcardSetId`) REFERENCES `FlashcardSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
