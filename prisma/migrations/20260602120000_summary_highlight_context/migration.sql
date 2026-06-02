-- Add summary vs chat scope for highlights (existing rows = summary body).

ALTER TABLE `SummaryHighlight`
  ADD COLUMN `context` VARCHAR(16) NOT NULL DEFAULT 'summary',
  ADD COLUMN `messageId` INTEGER NULL;

CREATE INDEX `SummaryHighlight_messageId_idx` ON `SummaryHighlight`(`messageId`);

ALTER TABLE `SummaryHighlight`
  ADD CONSTRAINT `SummaryHighlight_messageId_fkey`
  FOREIGN KEY (`messageId`) REFERENCES `ChatMessage`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
