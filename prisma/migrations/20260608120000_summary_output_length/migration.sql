-- Dashboard summarize output length preference (short | medium | detailed)
ALTER TABLE `Summary` ADD COLUMN `outputLength` VARCHAR(16) NOT NULL DEFAULT 'medium';
