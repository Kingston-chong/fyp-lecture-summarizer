-- Allow anonymous shared-quiz submissions (name-only, no account).
ALTER TABLE `QuizAttempt` MODIFY `userId` INTEGER NULL;
