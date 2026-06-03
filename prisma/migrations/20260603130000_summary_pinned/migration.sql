-- Pin summaries in history sidebar
ALTER TABLE `Summary`
  ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `pinnedAt` DATETIME(3) NULL;

CREATE INDEX `Summary_userId_pinned_pinnedAt_idx` ON `Summary`(`userId`, `pinned`, `pinnedAt`);
