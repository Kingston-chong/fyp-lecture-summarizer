-- AlterTable
ALTER TABLE `SlideDeck` ADD COLUMN `provider` VARCHAR(32) NULL,
    ADD COLUMN `providerDeckId` VARCHAR(256) NULL;
